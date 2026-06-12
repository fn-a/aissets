import { BaseApiClient, pickConfig } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
} from '@aissets/core';

class Hyper3dClient extends BaseApiClient {
    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.hyper3d.ai';
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

let client: Hyper3dClient | null = null;

export const hyper3d: PlatformPlugin = {
    name: 'hyper3d',
    description: 'Hyper3D - AI 3D model generation',
    website: "https://hyper3d.ai",
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
