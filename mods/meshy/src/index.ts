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

type MeshyTaskType = 'text-to-3d' | 'image-to-3d';

// ── Meshy API 原始响应类型 ──

interface MeshyTask {
    id: string;
    status: string;
    progress?: number;
    model_urls?: Record<string, string>;
    thumbnail_url?: string;
    consumed_credits?: number;
    created_at?: number;
    finished_at?: number;
}

// ── 转换函数 ──

const STATUS_MAP: Record<string, TaskStatus> = {
    PENDING: 'pending',
    IN_PROGRESS: 'processing',
    SUCCEEDED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'failed',
    CANCELED: 'cancelled',
};

function taskInfo(raw: MeshyTask): TaskInfo {
    return {
        id: raw.id,
        status: STATUS_MAP[raw.status] ?? 'pending',
        progress: raw.progress,
        createdAt: raw.created_at ? new Date(raw.created_at).toISOString() : undefined,
        finishedAt: raw.finished_at ? new Date(raw.finished_at).toISOString() : undefined,
    };
}

/** 根据任务类型返回正确的 API 路径前缀 */
function taskPath(taskTypes: Map<string, MeshyTaskType>, taskId: string): string {
    const t = taskTypes.get(taskId) ?? 'text-to-3d';
    return t === 'image-to-3d' ? '/openapi/v1/image-to-3d' : '/openapi/v2/text-to-3d';
}

class MeshyClient extends BaseApiClient {
    /** 记录每个任务的类型，status/result 需要路由到正确的端点 */
    private taskTypes = new Map<string, MeshyTaskType>();

    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.meshy.ai';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        let endpoint: string;
        let body: Record<string, unknown>;
        let taskType: MeshyTaskType;

        if (input.type === 'image') {
            taskType = 'image-to-3d';
            endpoint = '/openapi/v1/image-to-3d';
            body = { image_url: input.url, ...options };
        } else {
            taskType = 'text-to-3d';
            endpoint = '/openapi/v2/text-to-3d';
            body = { mode: 'preview', prompt: input.text, ...options };
        }

        const raw = await this.request<MeshyTask>(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(body),
        });

        this.taskTypes.set(raw.id, taskType);
        return taskInfo(raw);
    }

    async status(taskId: string): Promise<TaskInfo> {
        const raw = await this.request<MeshyTask>(`${taskPath(this.taskTypes, taskId)}/${taskId}`);
        return taskInfo(raw);
    }

    async result(taskId: string): Promise<ModelResult> {
        const raw = await this.request<MeshyTask>(`${taskPath(this.taskTypes, taskId)}/${taskId}`);
        if (raw.status !== 'SUCCEEDED') {
            throw new Error(`Task ${taskId} not completed, current status: ${raw.status}`);
        }
        const files: ModelFile[] = [];
        if (raw.model_urls) {
            for (const [fmt, url] of Object.entries(raw.model_urls)) {
                const format = fmt === 'pre_remeshed_glb' ? 'glb' : fmt;
                const filename = url.split('/').pop()?.split('?')[0];
                files.push({ url, format: format as ModelFile['format'], filename });
            }
        }
        return { taskId: raw.id, files };
    }
}

// ── 插件导出 ──

let client: MeshyClient | null = null;

// document: https://docs.meshy.ai/en
//           https://docs.meshy.ai/zh
// reference: https://docs.meshy.ai/en/api/text-to-3d
//            https://docs.meshy.ai/zh/api/text-to-3d
export const meshy: PlatformPlugin = {
    name: 'meshy',
    description: 'Meshy - AI 3D model generation platform',
    website: 'https://www.meshy.ai',
    init(rawConfig) {
        client = new MeshyClient(pickConfig(rawConfig, 'meshy'));
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

function ensure(): MeshyClient {
    if (!client) throw new Error('meshy plugin not initialized');
    return client;
}
