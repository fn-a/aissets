import { BaseApiClient, pickConfig, readImageBlob } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelFile,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
    TaskStatus,
} from '@aissets/core';

/**
 * Hi3D API Client (Math Magic).
 *
 * Auth: Basic (client_id:client_secret) → Bearer token.
 * Image-to-3D only — no text-to-3D support.
 */

const BASE_PATH = '/open-api/v1';

/** 输出格式 int → 扩展名 */
const FORMAT_MAP: Record<number, string> = {
    1: 'obj',
    2: 'glb',
    3: 'stl',
    4: 'fbx',
    5: 'usdz',
};

/** 支持的 format 字符串 → int */
const FORMAT_INT: Record<string, number> = {
    obj: 1,
    glb: 2,
    stl: 3,
    fbx: 4,
    usdz: 5,
};

/** 任务状态映射 */
const STATE_MAP: Record<string, TaskStatus> = {
    created: 'pending',
    queueing: 'pending',
    processing: 'processing',
    success: 'completed',
    failed: 'failed',
};

// ── API 响应类型 ──

interface Hi3dTokenResponse {
    code: number;
    message?: string;
    msg?: string;
    data: { accessToken: string; tokenType: string; nonce?: string };
}

interface Hi3dCreateResponse {
    code: number;
    msg?: string;
    data: { task_id: string };
}

interface Hi3dQueryResponse {
    code: number;
    msg?: string;
    data: {
        task_id: string;
        state: string;
        id?: string;
        url?: string;
        cover_url?: string;
    };
}

class Hi3dClient extends BaseApiClient {
    static symbol = 'hi3d';
    symbol = Hi3dClient.symbol;

    private token: string | null = null;
    private expiry = 0;
    private baseUrl = '';

    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.hitem3d.ai';
        super(config);
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }

    // ── 认证 ──

    /** 从 apiKey 解析 client_id:client_secret，获取 Bearer token 并缓存 */
    private async auth(): Promise<string> {
        if (this.token && Date.now() < this.expiry - 60_000) {
            return this.token;
        }
        const key = this.config.apiKey ?? '';
        const colon = key.indexOf(':');
        const clientId = colon >= 0 ? key.substring(0, colon) : key;
        const clientSecret = colon >= 0 ? key.substring(colon + 1) : '';

        const basic = btoa(`${clientId}:${clientSecret}`);
        const url = `${this.baseUrl}${BASE_PATH}/auth/token`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Basic ${basic}`,
            },
            body: '{}',
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`[${this.symbol}] Auth failed: HTTP ${res.status} ${res.statusText}: ${text}`);
        }

        const raw = (await res.json()) as Hi3dTokenResponse;
        this.token = raw.data.accessToken;
        // JWT 假设 1h 有效期，提前 1 分钟刷新
        this.expiry = Date.now() + 3_540_000;
        return this.token;
    }

    // ── 任务操作 ──

    async create(input: GenerationInput, _options?: GenerationOptions): Promise<TaskInfo> {
        const token = await this.auth();
        const form = new FormData();

        // 默认参数
        const fmt = _options?.format ?? 'glb';
        const model = 'hitem3dv2.0';
        form.append('request_type', '3');
        form.append('model', model);
        form.append('resolution', '1536');
        form.append('format', String(FORMAT_INT[fmt] ?? 2));

        // 图片上传
        if (input.type === 'image') {
            const blob = await readImageBlob(input.url);
            form.append('images', blob, 'input.png');
        } else {
            throw new Error(`[${this.symbol}] Only supports image-to-3D generation`);
        }

        const raw = await this.sendForm<Hi3dCreateResponse>(
            `${BASE_PATH}/submit-task`,
            form,
            token,
        );
        if (raw.code !== 200) {
            throw new Error(`[${this.symbol}] API error[${raw.code}]: ${raw.msg}`);
        }
        return { id: raw.data.task_id, status: 'pending', raw: raw };
    }

    async status(taskId: string): Promise<TaskInfo> {
        const token = await this.auth();
        const raw = await this.authedReq<Hi3dQueryResponse>(
            `${BASE_PATH}/query-task?task_id=${encodeURIComponent(taskId)}`,
            token,
        );
        return {
            id: raw.data?.task_id ?? '',
            status: STATE_MAP[raw.data?.state ?? ''] ?? 'pending',
            error: raw.code !== 200 ? raw.msg : undefined,
            raw: raw,
        };
    }

    async result(taskId: string): Promise<ModelResult> {
        const token = await this.auth();
        const raw = await this.authedReq<Hi3dQueryResponse>(
            `${BASE_PATH}/query-task?task_id=${encodeURIComponent(taskId)}`,
            token,
        );
        if (raw.data?.state !== 'success') {
            throw new Error(`[${this.symbol}] Task ${taskId} not completed, current state: ${raw.data?.state}`);
        }
        const files: ModelFile[] = [];
        const url = raw.data?.url;
        if (url) {
            const fn = url.split('/').pop()?.split('?')[0] ?? 'model.glb';
            const ext = fn.split('.').pop()?.toLowerCase() ?? 'glb';
            files.push({ url, format: ext as ModelFile['format'], filename: fn });
        }
        return { taskId: raw.data?.task_id ?? '', files };
    }

    // ── 内部请求 ──

    private async authedReq<T>(path: string, token: string): Promise<T> {
        const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
        };
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout ?? 300_000);
        try {
            const res = await fetch(url, { headers, signal: controller.signal });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`[${this.symbol}] HTTP ${res.status} ${res.statusText}: ${text}`);
            }
            return (await res.json()) as T;
        } finally {
            clearTimeout(timer);
        }
    }


    private async sendForm<T>(path: string, form: FormData, token: string): Promise<T> {
        const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
        };
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout ?? 300_000);
        try {
            const res = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`[${this.symbol}] HTTP ${res.status} ${res.statusText}: ${text}`);
            }
            return (await res.json()) as T;
        } catch (err) {
            console.error(`[${this.symbol}] POST ${url} → ${err}`);
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

}

// ── 插件导出 ──

let client: Hi3dClient | null = null;

// document: https://docs.hi3d.ai/en/api/getting-started/introduction
//           https://docs.hi3d.ai/zh/api/getting-started/introduction
// reference: https://docs.hi3d.ai/en/api/api-reference/overview
//            https://docs.hi3d.ai/zh/api/api-reference/overview
export const hi3d: PlatformPlugin = {
    name: Hi3dClient.symbol,
    description: 'Hi3D - 3D model generation',
    website: 'https://www.hi3d.ai',
    init(rawConfig) {
        client = new Hi3dClient(pickConfig(rawConfig, Hi3dClient.symbol));
    },
    create(input, options) {
        return ensure().create(input, options);
    },
    status(taskId) {
        return ensure().status(taskId);
    },
    result(taskId) {
        return ensure().result(taskId);
    },
    expect(taskId, pollMs) {
        return ensure().expect(taskId, pollMs);
    },
};

function ensure(): Hi3dClient {
    if (!client) throw new Error(`[${Hi3dClient.symbol}] Plugin not initialized`);
    return client;
}
