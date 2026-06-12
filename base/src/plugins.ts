import type { PlatformPlugin } from '@aissets/core';
import { hi3d } from '@aissets/hi3d';
import { hunyuan3d } from '@aissets/hunyuan3d';
import { hyper3d } from '@aissets/hyper3d';
import { meshy } from '@aissets/meshy';
import { tripo3d } from '@aissets/tripo3d';

/** 所有已注册的平台插件 */
export const plugins: PlatformPlugin[] = [hi3d, hunyuan3d, hyper3d, meshy, tripo3d];

/** 按名称查找插件 */
export function getPlugin(name: string): PlatformPlugin | undefined {
    return plugins.find((p) => p.name === name);
}
