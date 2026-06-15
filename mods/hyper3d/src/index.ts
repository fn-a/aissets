import { BaseApiClient, pickConfig } from '@aissets/core';
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

interface Hyper3dMeta {
    uuid: string;
    subscriptionKey: string;
}

// ── Hyper3D API 原始响应类型 ──

interface Hyper3dCreateResponse {
    uuid: string;
    error?: string;
    message?: string;
    jobs?: { uuids?: string[]; subscription_key?: string };
}

interface Hyper3dStatusResponse {
    error: string;
    message?: string;
    jobs?: Array<{ uuid?: string; status?: string }>;
}

interface Hyper3dDownloadResponse {
    error?: string;
    list?: Array<{ url: string; name?: string }>;
}

// ── 转换 ──

const STATUS_MAP: Record<string, TaskStatus> = {
    Waiting: 'pending',
    Generating: 'processing',
    Done: 'completed',
    Failed: 'failed',
};

class Hyper3dClient extends BaseApiClient {
    private baseUrl = '';
    private taskMeta = new Map<string, Hyper3dMeta>();

    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.hyper3d.ai';
        super(config);
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }

    /** 创建任务 — 使用 multipart/form-data */
    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        const form = new FormData();

        if (input.type === 'image') {
            // 图片转 3D：下载图片并以文件形式上传
            const blob = await this.fetchImage(input.url);
            form.append('images', blob, 'input.png');
        } else {
            // 文字转 3D
            form.append('prompt', input.text);
        }

        const tier = (options as Record<string, unknown> | undefined)?.tier as string | undefined;
        form.append('tier', tier ?? 'Gen-2');
        form.append('mesh_mode', 'Raw');
        form.append('material', 'PBR');

        if (options?.format) {
            form.append('target_format', options.format);
        }

        const meta = await this.sendForm<Hyper3dCreateResponse>('/api/v2/rodin', form);
        const uuid = meta.uuid;
        const subscriptionKey = meta.jobs?.subscription_key ?? '';
        this.taskMeta.set(uuid, { uuid, subscriptionKey });

        return { id: uuid, status: 'pending' };
    }

    /** 查询状态 — JSON POST with subscription_key */
    async status(taskId: string): Promise<TaskInfo> {
        const meta = this.taskMeta.get(taskId);
        const raw = await this.request<Hyper3dStatusResponse>('/api/v2/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ subscription_key: meta?.subscriptionKey ?? '' }),
        });

        const job = raw.jobs?.[0];
        return {
            id: taskId,
            status: STATUS_MAP[job?.status ?? ''] ?? 'pending',
            error: raw.error !== 'OK' ? raw.message : undefined,
        };
    }

    /** 下载结果 — JSON POST with task_uuid */
    async result(taskId: string): Promise<ModelResult> {
        const raw = await this.request<Hyper3dDownloadResponse>('/api/v2/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ task_uuid: taskId }),
        });

        const files: ModelFile[] = (raw.list ?? []).map((item) => {
            const ext = item.name?.split('.').pop()?.toLowerCase() ?? 'glb';
            return {
                url: item.url,
                format: (['glb', 'gltf', 'obj', 'fbx', 'usdz', 'stl', 'ply'].includes(ext)
                    ? ext
                    : 'glb') as ModelFile['format'],
                filename: item.name,
            };
        });

        return { taskId, files };
    }

    private async sendForm<T>(path: string, form: FormData): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {};
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout ?? 300_000);

        try {
            const res = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
            }
            return (await res.json()) as T;
        } finally {
            clearTimeout(timer);
        }
    }

    private async fetchImage(imageUrl: string): Promise<Blob> {
        const res = await fetch(imageUrl);
        if (!res.ok) {
            throw new Error(`Failed to fetch image: HTTP ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') ?? 'image/png';
        return new Blob([arrayBuffer], { type: contentType });
    }
}

// ── 插件导出 ──

let client: Hyper3dClient | null = null;

// document: https://developer.hyper3d.ai/
//           https://developer.hyper3d.ai/zh_cn
// reference: https://developer.hyper3d.ai/api-specification/overview_reset_v
//            https://developer.hyper3d.ai/zh_cn/api-specification/overview_reset_v
export const hyper3d: PlatformPlugin = {
    name: 'hyper3d',
    description: 'Hyper3D - AI 3D model generation',
    website: 'https://hyper3d.ai',
    init(rawConfig) {
        client = new Hyper3dClient(pickConfig(rawConfig, 'hyper3d'));
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

function ensure(): Hyper3dClient {
    if (!client) throw new Error('hyper3d plugin not initialized');
    return client;
}
