import { BaseApiClient, pickConfig, readImageBlob } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelFile,
    ModelFileFormat,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
    TaskStatus,
} from '@aissets/core';

// ── RunningHub API 原始响应类型 ──

interface RhSubmitResponse {
    taskId: string;
    status: string;
    errorCode: string;
    errorMessage: string;
    results: RhResultItem[] | null;
    clientId: string;
    promptTips: string;
}

interface RhQueryResponse {
    taskId: string;
    status: string;
    errorCode: string;
    errorMessage: string;
    failedReason: Record<string, unknown> | null;
    usage: {
        consumeMoney: string | null;
        consumeCoins: string | null;
        taskCostTime: string;
        thirdPartyConsumeMoney: string | null;
    } | null;
    results: RhResultItem[] | null;
    clientId: string;
    promptTips: string;
}

interface RhResultItem {
    url: string;
    nodeId: string;
    outputType: string;
    text: string | null;
}

interface RhUploadResponse {
    code: number;
    message: string;
    data: {
        type: string;
        download_url: string;
        fileName: string;
        size: string;
    };
}

// ── 转换函数 ──

const STATUS_MAP: Record<string, TaskStatus> = {
    QUEUED: 'pending',
    RUNNING: 'processing',
    SUCCESS: 'completed',
    FAILED: 'failed',
};

const DEFAULT_MODEL = 'rhart-image-g-2';

const OUTPUT_TYPE_TO_FORMAT: Record<string, ModelFileFormat> = {
    png: 'glb',
    jpg: 'glb',
    jpeg: 'glb',
    webp: 'glb',
    mp4: 'glb',
    gif: 'glb',
    txt: 'glb',
    glb: 'glb',
    gltf: 'gltf',
    obj: 'obj',
    fbx: 'fbx',
    usdz: 'usdz',
    stl: 'stl',
    ply: 'ply',
};

function taskInfoFromSubmit(raw: RhSubmitResponse): TaskInfo {
    return {
        id: raw.taskId,
        status: STATUS_MAP[raw.status] ?? 'pending',
        error: raw.errorMessage || undefined,
        raw,
    };
}

function taskInfoFromQuery(raw: RhQueryResponse): TaskInfo {
    return {
        id: raw.taskId,
        status: STATUS_MAP[raw.status] ?? 'pending',
        error: raw.errorMessage || undefined,
        raw,
    };
}

class RunninghubClient extends BaseApiClient {
    static readonly symbol = 'runninghub';
    symbol = RunninghubClient.symbol;

    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://www.runninghub.cn';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        const opts = options as Record<string, unknown> | undefined;
        const model = (opts?.model as string) ?? DEFAULT_MODEL;
        const endpoint = `/openapi/v2/${model}/text-to-image`;

        const body: Record<string, unknown> = {};

        if (input.type === 'image') {
            body.imageUrls = [input.url];
        } else {
            body.prompt = input.text;
        }

        if (opts?.aspectRatio) body.aspectRatio = opts.aspectRatio;
        if (opts?.resolution) body.resolution = opts.resolution;
        if (opts?.webhookUrl) body.webhookUrl = opts.webhookUrl;

        const raw = await this.request<RhSubmitResponse>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        if (raw.errorCode && raw.status === 'FAILED') {
            throw new Error(
                `[${RunninghubClient.symbol}] API error[${raw.errorCode}]: ${raw.errorMessage}`,
            );
        }

        return taskInfoFromSubmit(raw);
    }

    async status(taskId: string): Promise<TaskInfo> {
        const raw = await this.request<RhQueryResponse>('/openapi/v2/query', {
            method: 'POST',
            body: JSON.stringify({ taskId }),
        });
        return taskInfoFromQuery(raw);
    }

    async result(taskId: string): Promise<ModelResult> {
        const raw = await this.request<RhQueryResponse>('/openapi/v2/query', {
            method: 'POST',
            body: JSON.stringify({ taskId }),
        });

        if (raw.status !== 'SUCCESS') {
            throw new Error(
                `[${RunninghubClient.symbol}] Task ${taskId} not completed, current status: ${raw.status}` +
                    (raw.errorMessage ? `: ${raw.errorMessage}` : ''),
            );
        }

        const files: ModelFile[] = [];
        const results = raw.results ?? [];

        for (const item of results) {
            const url = item.url ?? '';
            if (!url) continue;

            const format = OUTPUT_TYPE_TO_FORMAT[item.outputType?.toLowerCase() ?? ''] ?? 'glb';
            const filename = url.split('/').pop()?.split('?')[0];

            files.push({
                url,
                format,
                filename,
            });
        }

        return { taskId: raw.taskId, files };
    }

    async upload(source: string): Promise<string> {
        const blob = await readImageBlob(source);

        const form = new FormData();
        const filename = source.split('/').pop()?.split('?')[0] ?? 'image.png';
        form.append('file', blob, filename);

        const url = `${this.config.baseUrl?.replace(/\/$/, '')}/openapi/v2/media/upload/binary`;
        const headers: Record<string, string> = {};
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: form,
                signal: controller.signal,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`[${RunninghubClient.symbol}] Upload failed: HTTP ${res.status} ${text}`);
            }
            const data = (await res.json()) as RhUploadResponse;
            if (data.code !== 0) {
                throw new Error(`[${RunninghubClient.symbol}] Upload error[${data.code}]: ${data.message}`);
            }
            return data.data.download_url;
        } finally {
            clearTimeout(timer);
        }
    }
}

// ── 插件导出 ──

let client: RunninghubClient | null = null;

// document: https://www.runninghub.cn/runninghub-api-doc-cn
// reference: https://www.runninghub.cn/call-api
export const runninghub: PlatformPlugin = {
    name: RunninghubClient.symbol,
    description: 'RunningHub - AI image & 3D model generation platform',
    website: 'https://www.runninghub.cn',
    init(rawConfig) {
        client = new RunninghubClient(pickConfig(rawConfig, RunninghubClient.symbol));
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

export function ensure(): RunninghubClient {
    if (!client) throw new Error(`[${RunninghubClient.symbol}] Plugin not initialized`);
    return client;
}
