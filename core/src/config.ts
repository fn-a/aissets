import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AissetsConfig, PlatformConfig } from './types';

/**
 * 加载当前工作目录下的 config.json，不存在则返回 null。
 * main 程序只负责加载，不做任何合并或提取。
 */
export function loadConfig(path?: string): AissetsConfig | null {
    const target = path ? resolve(path) : resolve('config.json');
    try {
        return JSON.parse(readFileSync(target, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * 从原始配置中提取指定平台的 ApiConfig。
 * 各模块在 init() 中自行调用此函数决定如何取用配置。
 * 优先级: CLI overrides > 平台配置 > 默认配置 > 环境变量
 */
export function pickConfig(raw: AissetsConfig | null, platform: string): PlatformConfig {
    const platformCfg = raw?.platforms?.[platform] ?? {};
    const defaults = raw?.default ?? {};

    const baseUrl = platformCfg.baseUrl || '';

    const apiKey = platformCfg.apiKey || '';

    const timeout = platformCfg.timeout ?? defaults.timeout ?? 300_000;

    const headers: Record<string, string> = {
        ...defaults.headers,
        ...platformCfg.headers,
    };

    return { baseUrl, apiKey, timeout, headers };
}
