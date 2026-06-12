import { BaseApiClient, pickConfig } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
} from '@aissets/core';

class Tripo3dClient extends BaseApiClient {
    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.tripo3d.ai';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        return this.request<TaskInfo>('/v1/tasks', {
            method: 'POST',
            body: JSON.stringify({ input, ...options }),
        });
    }

    async status(taskId: string): Promise<TaskInfo> {
        return this.request<TaskInfo>(`/v1/tasks/${taskId}`);
    }

    async result(taskId: string): Promise<ModelResult> {
        return this.request<ModelResult>(`/v1/tasks/${taskId}/result`);
    }
}

let client: Tripo3dClient | null = null;

export const tripo3d: PlatformPlugin = {
    name: 'tripo3d',
    description: 'Tripo3D - AI 3D model generation (TripoSR)',
    website: "https://www.tripo3d.ai",
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
