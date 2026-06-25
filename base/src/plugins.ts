import type { PlatformPlugin } from '@aissets/core';
import { hi3d } from '@aissets/hi3d';
import { hyper3d } from '@aissets/hyper3d';
import { liblib } from '@aissets/liblib';
import { meshy } from '@aissets/meshy';
import { runninghub } from '@aissets/runninghub';
import { tripo3d } from '@aissets/tripo3d';

/** 所有已注册的平台插件 */
export const plugins: PlatformPlugin[] = [hi3d, hyper3d, liblib, meshy, runninghub, tripo3d];

/** 按名称查找插件 */
export function getPlugin(name: string): PlatformPlugin | undefined {
    return plugins.find((p) => p.name === name);
}
