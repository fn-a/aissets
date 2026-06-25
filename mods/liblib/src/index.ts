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

// ── LibLib API 原始响应类型 ──

interface LiblibResponse<T = unknown> {
    code: number;
    msg: string;
    data: T;
}

interface LiblibCreateData {
    generateUuid: string;
}

interface LiblibImageData {
    imageUrl: string;
    seed: number;
    auditStatus: number;
}

interface LiblibStatusData {
    generateUuid: string;
    generateStatus: number;
    percentCompleted: number;
    generateMsg: string;
    pointsCost: number;
    accountBalance: number;
    images: LiblibImageData[];
}

// ── generateStatus 枚举 ──
// 1=等待执行 2=执行中 3=已生图 4=审核中 5=成功 6=失败 7=超时

const STATUS_MAP: Record<number, TaskStatus> = {
    1: 'pending',
    2: 'processing',
    3: 'processing',
    4: 'processing',
    5: 'completed',
    6: 'failed',
    7: 'failed',
};

// auditStatus: 1=待审核 2=审核中 3=审核通过 4=审核拦截 5=审核失败
const AUDIT_BLOCKED = new Set([4, 5]);

function taskInfoFromStatus(raw: LiblibStatusData): TaskInfo {
    return {
        id: raw.generateUuid,
        status: STATUS_MAP[raw.generateStatus] ?? 'pending',
        progress: Math.round(raw.percentCompleted * 100),
        error: raw.generateMsg || undefined,
        raw,
    };
}

class LiblibClient extends BaseApiClient {
    static readonly symbol = 'liblib';
    symbol = LiblibClient.symbol;

    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://openapi.liblibai.cloud';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        const opts = options as Record<string, unknown> | undefined;
        const generateParams: Record<string, unknown> = {};

        if (input.type === 'prompt') {
            generateParams.prompt = input.text;
        }

        if (opts?.negativePrompt) generateParams.negativePrompt = opts.negativePrompt;
        if (opts?.checkPointId) generateParams.checkPointId = opts.checkPointId;
        if (opts?.sampler != null) generateParams.sampler = opts.sampler;
        if (opts?.steps != null) generateParams.steps = opts.steps;
        if (opts?.cfgScale != null) generateParams.cfgScale = opts.cfgScale;
        if (opts?.width != null) generateParams.width = opts.width;
        if (opts?.height != null) generateParams.height = opts.height;
        if (opts?.imgCount != null) generateParams.imgCount = opts.imgCount;
        if (opts?.seed != null) generateParams.seed = opts.seed;
        if (opts?.randnSource != null) generateParams.randnSource = opts.randnSource;
        if (opts?.restoreFaces != null) generateParams.restoreFaces = opts.restoreFaces;
        if (opts?.additionalNetwork) generateParams.additionalNetwork = opts.additionalNetwork;
        if (opts?.hiResFixInfo) generateParams.hiResFixInfo = opts.hiResFixInfo;

        const body: Record<string, unknown> = { generateParams };
        if (opts?.templateUuid) body.templateUuid = opts.templateUuid;

        const res = await this.request<LiblibResponse<LiblibCreateData>>(
            '/api/generate/webui/text2img',
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        );

        if (res.code !== 0) {
            throw new Error(`[${LiblibClient.symbol}] API error[${res.code}]: ${res.msg}`);
        }

        return {
            id: res.data.generateUuid,
            status: 'pending',
            raw: res,
        };
    }

    async status(taskId: string): Promise<TaskInfo> {
        const res = await this.request<LiblibResponse<LiblibStatusData>>(
            '/api/generate/webui/status',
            {
                method: 'POST',
                body: JSON.stringify({ generateUuid: taskId }),
            },
        );

        if (res.code !== 0) {
            return {
                id: taskId,
                status: 'failed',
                error: res.msg,
                raw: res,
            };
        }

        return taskInfoFromStatus(res.data);
    }

    async result(taskId: string): Promise<ModelResult> {
        const res = await this.request<LiblibResponse<LiblibStatusData>>(
            '/api/generate/webui/status',
            {
                method: 'POST',
                body: JSON.stringify({ generateUuid: taskId }),
            },
        );

        if (res.code !== 0) {
            throw new Error(`[${LiblibClient.symbol}] API error[${res.code}]: ${res.msg}`);
        }

        const data = res.data;
        if (data.generateStatus !== 5) {
            throw new Error(
                `[${LiblibClient.symbol}] Task ${taskId} not completed, current status: ${data.generateStatus}` +
                    (data.generateMsg ? ` (${data.generateMsg})` : ''),
            );
        }

        const files: ModelFile[] = [];
        for (const img of data.images ?? []) {
            if (AUDIT_BLOCKED.has(img.auditStatus)) continue;
            if (!img.imageUrl) continue;

            const ext = img.imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'png';
            const filename = img.imageUrl.split('/').pop()?.split('?')[0];

            files.push({
                url: img.imageUrl,
                format: ext as ModelFile['format'],
                filename,
            });
        }

        return { taskId: data.generateUuid, files };
    }
}

// ── 插件导出 ──

let client: LiblibClient | null = null;

// document: https://www.liblib.art/teaching
// reference: https://www.liblib.art/apis
export const liblib: PlatformPlugin = {
    name: LiblibClient.symbol,
    description: 'LibLib - AI image generation platform',
    website: 'https://www.liblib.art',
    init(rawConfig) {
        client = new LiblibClient(pickConfig(rawConfig, LiblibClient.symbol));
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

function ensure(): LiblibClient {
    if (!client) throw new Error(`[${LiblibClient.symbol}] Plugin not initialized`);
    return client;
}
