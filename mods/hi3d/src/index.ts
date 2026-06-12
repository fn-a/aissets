import { BaseApiClient, pickConfig } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
} from '@aissets/core';

class Hi3dClient extends BaseApiClient {
    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.hitem3d.ai';
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

let client: Hi3dClient | null = null;

export const hi3d: PlatformPlugin = {
    name: 'hi3d',
    description: 'Hi3D - 3D model generation',
    website: "https://www.hi3d.ai",
    init(rawConfig) {
        client = new Hi3dClient(pickConfig(rawConfig, 'hi3d'));
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
    if (!client) throw new Error('hi3d plugin not initialized');
    return client;
}
