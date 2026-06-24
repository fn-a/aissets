// ── 配置类型 ──

/** 各平台 API 配置 */
export interface PlatformConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    headers?: Record<string, string>;
}

/** 默认配置 */
export interface DefaultConfig {
    timeout?: number;
    headers?: Record<string, string>;
}

/** 全局配置 */
export interface AissetsConfig {
    default?: DefaultConfig;
    platforms?: Record<string, PlatformConfig>;
}

// ── 3D 模型通用类型 ──

/** 模型文件格式 */
export type ModelFileFormat = 'glb' | 'gltf' | 'obj' | 'fbx' | 'usdz' | 'stl' | 'ply';

/** 模型生成任务状态 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** 模型生成任务基本信息 */
export interface TaskInfo {
    id: string;
    status: TaskStatus;
    progress?: number;
    /** 任务创建时间 (ISO 8601) */
    createdAt?: string;
    /** 任务完成时间 (ISO 8601) */
    finishedAt?: string;
    error?: string;
    raw: unknown;
}

/** 单个生成的模型文件 */
export interface ModelFile {
    url: string;
    format: ModelFileFormat;
    filename?: string;
}

/** 模型生成结果 */
export interface ModelResult {
    taskId: string;
    files: ModelFile[];
}

/** 图片/提示词输入类型 */
export type GenerationInput = { type: 'image'; url: string } | { type: 'prompt'; text: string };

/** 模型生成选项 */
export interface GenerationOptions {
    format?: ModelFileFormat;
    [key: string]: unknown;
}

// ── 插件接口类型 ──

/** 插件模块导出接口 */
export interface PlatformPlugin {
    /** 平台名称，用作 CLI 命令名 */
    name: string;
    /** 平台描述 */
    description: string;
    /** 平台网站 */
    website: string;
    /** 初始化插件，模块自行从配置中提取所需字段 */
    init(rawConfig: AissetsConfig | null): void;
    /** 提交模型生成任务 */
    create(input: GenerationInput, options?: GenerationOptions): Promise<TaskInfo>;
    /** 查询任务状态 */
    status(taskId: string): Promise<TaskInfo>;
    /** 获取生成结果 */
    result(taskId: string): Promise<ModelResult>;
    /** 等待任务完成并返回结果 */
    expect(taskId: string, pollIntervalMs?: number): Promise<ModelResult>;
}
