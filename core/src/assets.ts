import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'node:fs';
import { basename, extname, join, parse } from 'node:path';
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

        const filename = file.filename ?? (basename(file.url.split('?')[0]) || 'model');
        const dest = uniqueFilePath(dir, filename);
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

    const contentLength = Number(res.headers.get('content-length') ?? 0);
    const reader = res.body.getReader();
    const out = createWriteStream(dest);
    let received = 0;
    let lastPct = -1;

    const label = basename(dest);
    console.log(`Downloading ${label}...`);

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            out.write(Buffer.from(value));

            if (contentLength > 0) {
                const pct = Math.round((received / contentLength) * 100);
                if (pct >= lastPct + 10) {
                    lastPct = pct;
                    console.log(`  ${label} ${pct}% (${displayByteSize(received)} / ${displayByteSize(contentLength)})`);
                }
            }
        }
        console.log(`Download ${label} done (${displayByteSize(received)})`);
    } finally {
        out.end();
        reader.releaseLock();
    }
}

function uniqueFilePath(dir: string, name: string): string {
    const { name: base, ext } = parse(name);
    let dest = join(dir, `${base}${ext}`);
    if (!existsSync(dest)) return dest;
    const ts = Date.now();
    dest = join(dir, `${base}_${ts}${ext}`);
    if (!existsSync(dest)) return dest;
    for (let i = 1; ; i++) {
        dest = join(dir, `${base}_${ts}_${i}${ext}`);
        if (!existsSync(dest)) return dest;
    }
}

function displayByteSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const IMAGE_MIME: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
};

export async function readImageBlob(source: string): Promise<Blob> {
    // 读取图片为 Blob，支持 URL 和本地文件路径。
    if (/^https?:\/\//i.test(source)) {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`Failed to fetch ${source}: HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const ct = res.headers.get('content-type') ?? 'image/png';
        return new Blob([buf], { type: ct });
    }

    const buf = readFileSync(source);
    const ext = extname(source).toLowerCase();
    const mime = IMAGE_MIME[ext] ?? 'application/octet-stream';
    return new Blob([buf], { type: mime });
}