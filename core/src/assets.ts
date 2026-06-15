import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ModelResult } from './types';

/**
 * 下载 ModelResult 中的所有文件到本地目录。
 * 返回本地文件路径列表。
 */
export async function downloadFiles(result: ModelResult, dir: string): Promise<string[]> {
    mkdirSync(dir, { recursive: true });
    const paths: string[] = [];
    const seen = new Set<string>();

    for (const file of result.files) {
        if (seen.has(file.url)) continue;
        seen.add(file.url);

        const filename = file.filename ?? file.url.split('/').pop()?.split('?')[0] ?? 'model';
        const dest = join(dir, filename);
        await downloadFetch(file.url, dest);
        paths.push(dest);
    }

    return paths;
}

async function downloadFetch(url: string, dest: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
        throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
    }
    await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}
