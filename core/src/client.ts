import type {
    PlatformConfig,
    GenerationInput,
    GenerationOptions,
    ModelResult,
    TaskInfo,
} from './types';

/**
 * 3D 模型生成平台的抽象基类。
 * 各 mod 模块继承此类，只需实现平台特定的 HTTP 调用细节。
 */
export abstract class BaseApiClient {
    protected config: PlatformConfig;

    constructor(config: PlatformConfig) {
        this.config = {
            timeout: 300_000,
            ...config,
        };
    }

    /** 提交生成任务 */
    abstract create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo>;

    /** 查询任务状态 */
    abstract status(taskId: string): Promise<TaskInfo>;

    /** 获取生成结果 */
    abstract result(taskId: string): Promise<ModelResult>;

    /** 等待任务完成并返回结果 */
    async expect(taskId: string, pollIntervalMs = 3000): Promise<ModelResult> {
        for (;;) {
            const task = await this.status(taskId);
            if (task.status === 'completed') {
                return this.result(taskId);
            }
            if (task.status === 'failed' || task.status === 'cancelled') {
                throw new Error(
                    `Task ${taskId} ended with status "${task.status}": ${task.error ?? 'unknown error'}`,
                );
            }
            await sleep(pollIntervalMs);
        }
    }

    /** 发送 HTTP 请求（子类可直接调用） */
    protected async request<T>(
        path: string,
        init: RequestInit & { method?: string } = {},
    ): Promise<T> {
        const url = this.config.baseUrl ? `${this.config.baseUrl.replace(/\/$/, '')}${path}` : path;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.config.headers,
            ...(init.headers as Record<string, string> | undefined),
        };
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const res = await fetch(url, {
                ...init,
                headers,
                signal: controller.signal,
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status} ${res.statusText}: ${body}`);
            }
            return (await res.json()) as T;
        } finally {
            clearTimeout(timer);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
