import { BaseApiClient, pickConfig } from '@aissets/core';
import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelResult,
    PlatformPlugin,
    TaskInfo,
} from '@aissets/core';

class MeshyClient extends BaseApiClient {
    constructor(config: PlatformConfig) {
        config.baseUrl ||= 'https://api.meshy.ai';
        super(config);
    }

    async create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo> {
        return this.request<TaskInfo>('/openapi/v2/text-to-3d', {
            method: 'POST',
            body: JSON.stringify({ input, ...options }),
        });
    }

    async status(taskId: string): Promise<TaskInfo> {
        return this.request<TaskInfo>(`/openapi/v2/tasks/${taskId}`);
    }

    async result(taskId: string): Promise<ModelResult> {
        return this.request<ModelResult>(`/openapi/v2/tasks/${taskId}/result`);
    }
}

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
