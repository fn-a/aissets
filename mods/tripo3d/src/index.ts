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

// ── Tripo3D API 原始响应类型 ──

interface Tripo3dResponse {
    id?: string;
    status?: string;
    output?: {
        task_id?: string;
        task_status?: string;
        progress?: number;
        results?: Tripo3dResultItem[];
        error?: { message?: string };
    };
    created_at?: number;
    finished_at?: number;
}

interface Tripo3dResultItem {
    pbr_model_url?: string;
    rendered_image_url?: string;
    model_url?: string;
    format?: string;
    type?: string;
}

// ── 转换函数 ──

const STATUS_MAP: Record<string, TaskStatus> = {
    PENDING: 'pending',
    RUNNING: 'processing',
    SUCCEEDED: 'completed',
    FAILED: 'failed',
    CANCELED: 'cancelled',
};

function taskStatus(raw: Tripo3dResponse): string {
    return raw.status ?? raw.output?.task_status ?? 'PENDING';
}

function taskInfo(raw: Tripo3dResponse): TaskInfo {
    return {
        id: raw.id ?? raw.output?.task_id ?? '',
        status: STATUS_MAP[taskStatus(raw)] ?? 'pending',
        progress: raw.output?.progress,
        createdAt: raw.created_at ? new Date(raw.created_at).toISOString() : undefined,
        finishedAt: raw.finished_at ? new Date(raw.finished_at).toISOString() : undefined,
        error: raw.output?.error?.message,
    };
}

const KNOWN_FORMATS = ['glb', 'gltf', 'obj', 'fbx', 'usdz', 'stl', 'ply'];

class Tripo3dClient extends BaseApiClient {
    constructor(config: PlatformConfig) {
        // https://api.tripo3d.ai
        config.baseUrl ||= 'https://api.tripo3d.com';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        let body: Record<string, unknown>;
        if (input.type === 'image') {
            body = { image_url: input.url, ...options };
        } else {
            body = { prompt: input.text, ...options };
        }

        const raw = await this.request<Tripo3dResponse>('/v1/tasks', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return taskInfo(raw);
    }

    async status(taskId: string): Promise<TaskInfo> {
        const raw = await this.request<Tripo3dResponse>(`/v1/tasks/${taskId}`);
        return taskInfo(raw);
    }

    async result(taskId: string): Promise<ModelResult> {
        const raw = await this.request<Tripo3dResponse>(`/v1/tasks/${taskId}`);
        if (raw.status !== 'SUCCEEDED' && raw.output?.task_status !== 'SUCCEEDED') {
            throw new Error(
                `Task ${taskId} not completed, current status: ${raw.status ?? raw.output?.task_status}`,
            );
        }
        const files: ModelFile[] = [];
        const results = raw.output?.results ?? [];

        for (const item of results) {
            const url = item.pbr_model_url ?? item.model_url ?? '';
            if (!url) continue;

            // 从 URL 或 type 字段推断格式
            let format = 'glb';
            const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
            if (KNOWN_FORMATS.includes(ext)) format = ext;
            else if (item.format && KNOWN_FORMATS.includes(item.format.toLowerCase())) {
                format = item.format.toLowerCase();
            }

            files.push({
                url,
                format: format as ModelFile['format'],
                filename: url.split('/').pop()?.split('?')[0],
            });
        }

        // 降级：如果 results 为空，尝试检查顶层 model_url
        if (files.length === 0) {
            const modelUrl = (raw as Record<string, unknown>).model_url as string;
            if (modelUrl) {
                files.push({
                    url: modelUrl,
                    format: 'glb',
                    filename: modelUrl.split('/').pop()?.split('?')[0],
                });
            }
        }

        return { taskId: raw.id ?? raw.output?.task_id ?? '', files };
    }
}

// ── 插件导出 ──

let client: Tripo3dClient | null = null;

// document: https://platform.tripo3d.com/docs/introduction
//           https://docs.tripo3d.ai/get-started/introduction.html
// reference: https://platform.tripo3d.com/docs/general
//            https://platform.tripo3d.ai/docs/quick-start
export const tripo3d: PlatformPlugin = {
    name: 'tripo3d',
    description: 'Tripo3D - AI 3D model generation (TripoSR)',
    // https://www.tripo3d.ai
    website: 'https://studio.tripo3d.com',
    init(rawConfig) {
        client = new Tripo3dClient(pickConfig(rawConfig, 'tripo3d'));
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

function ensure(): Tripo3dClient {
    if (!client) throw new Error('tripo3d plugin not initialized');
    return client;
}
