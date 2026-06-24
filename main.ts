import { Command } from 'commander';
import { join } from 'node:path';
import type {
    AissetsConfig,
    GenerationInput,
    GenerationOptions,
    ModelFileFormat,
} from '@aissets/core';
import { downloadFiles, loadConfig } from '@aissets/core';
import { getPlugin, plugins } from '@aissets/base';

// ── 常量选项定义 ──

const OPT = {
    IMAGE:    ['-i, --image <url>',     'Input image URL'] as const,
    PROMPT:   ['-p, --prompt <text>',   'Input text prompt'] as const,
    FORMAT:   ['-f, --format <fmt>',    'Output format (glb, obj, etc.)', 'glb'] as const,
    DOWNLOAD: ['-d, --download <dir>',  'Download root directory (default: ./assets)', 'assets'] as const,
    POLL:     ['--poll <ms>',           'Poll interval in milliseconds', '3000'] as const,
    EXTRA:    ['-o, --options <json>',  'Extra platform options as JSON', '{}'] as const,
} as const;

let cached: AissetsConfig | null | undefined;

const program = new Command();

program
    .name('aissets')
    .description('CLI tool for AI 3D model generation platforms')
    .version('0.1.0');

// ── 全局选项 ──
program.option('-c, --config <path>', 'Path to config file (default: ./config.json)');

// ── run 命令：一键生成全链路 ──
program
    .command('run [platform]')
    .description('One-shot 3D generation — full pipeline: create → wait → download')
    .option(...OPT.IMAGE)
    .option(...OPT.PROMPT)
    .option(...OPT.FORMAT)
    .option(...OPT.DOWNLOAD)
    .option(...OPT.POLL)
    .option('--all', 'Run on all available platforms', false)
    .action(async (platform: string | undefined, opts) => {
        const { input, options } = buildInput(opts);
        const targets = resolveTargets(platform, opts.all);

        console.log(
            `Running on ${targets.map((p) => p.name).join(', ')} (${targets.length} platform(s))\n`,
        );

        for (const plugin of targets) {
            console.log(`── ${plugin.name} ${'─'.repeat(40)}`);
            try {
                await pipeline(plugin, input, options, opts);
            } catch (e) {
                console.error(`  ✗ ${plugin.name} failed: ${(e as Error).message}`);
            }
            console.log();
        }

        console.log(`Done. ${targets.length} platform(s) processed.`);
    });

// ── list 命令：列出所有可用平台 ──
program
    .command('list')
    .description('List all available 3D generation platforms')
    .action(() => {
        console.log('Available platforms:\n');
        for (const p of plugins) {
            console.log(`  ${p.name.padEnd(14)} ${p.description}`);
        }
    });

// ── create 命令：提交生成任务 ──
program
    .command('create <platform>')
    .description('Create a 3D generation task')
    .option(...OPT.IMAGE)
    .option(...OPT.PROMPT)
    .option(...OPT.FORMAT)
    .option(...OPT.EXTRA)
    .action(async (platform: string, opts) => {
        const plugin = resolvePlugin(platform);
        if (!plugin) return;

        const { input, options } = buildInput(opts);
        plugin.init(gainConfig());

        console.log(`Creating task on ${plugin.name}...`);
        const task = await plugin.create(input, options);
        console.log(JSON.stringify(task, null, 2));
    });

// ── status 命令：查询任务状态 ──
program
    .command('status <platform> <taskId>')
    .description('Check task status')
    .action(async (platform: string, taskId: string) => {
        const plugin = resolvePlugin(platform);
        if (!plugin) return;

        plugin.init(gainConfig());
        const task = await plugin.status(taskId);
        console.log(JSON.stringify(task, null, 2));
    });

// ── result 命令：获取生成结果 ──
program
    .command('result <platform> <taskId>')
    .description('Get generation result')
    .option(...OPT.DOWNLOAD)
    .action(async (platform: string, taskId: string, opts) => {
        const plugin = resolvePlugin(platform);
        if (!plugin) return;

        plugin.init(gainConfig());
        const result = await plugin.result(taskId);
        console.log(JSON.stringify(result, null, 2));

        const dir = join(opts.download, platform);
        const paths = await downloadFiles(result, dir);
        console.log(`\nDownloaded ${paths.length} file(s) to ${dir}:`);
        for (const p of paths) console.log(`  ${p}`);
    });

// ── wait 命令：等待任务完成并获取结果 ──
program
    .command('wait <platform> <taskId>')
    .description('Wait for task to complete and get result')
    .option(...OPT.POLL)
    .option(...OPT.DOWNLOAD)
    .action(async (platform: string, taskId: string, opts) => {
        const plugin = resolvePlugin(platform);
        if (!plugin) return;

        plugin.init(gainConfig());
        const interval = parseInt(opts.poll, 10) || 3000;
        console.log(`Waiting for task ${taskId} (polling every ${interval}ms)...`);
        const result = await plugin.expect(taskId, interval);
        console.log(JSON.stringify(result, null, 2));

        const dir = join(opts.download, platform);
        const paths = await downloadFiles(result, dir);
        console.log(`\nDownloaded ${paths.length} file(s) to ${dir}:`);
        for (const p of paths) console.log(`  ${p}`);
    });

program.parse();

// ── 全链路流水线 ──

async function pipeline(
    plugin: ReturnType<typeof getPlugin>,
    input: GenerationInput,
    options: GenerationOptions,
    opts: Record<string, string>,
) {
    if (!plugin) return;
    plugin.init(gainConfig());

    console.log(`  Creating task...`);
    const task = await plugin.create(input, options);
    console.log(`  Task ID: ${task.id}`);

    const pollMs = parseInt(opts.poll, 10) || 3000;
    console.log(`  Waiting (polling every ${pollMs}ms)...`);
    const result = await plugin.expect!(task.id, pollMs);
    console.log(`  Got ${result.files.length} file(s)`);

    const dir = join(opts.download || 'assets', plugin.name);
    const paths = await downloadFiles(result, dir);
    console.log(`  Downloaded to ${dir}:`);
    for (const p of paths) console.log(`    ${p}`);
}

// ── 辅助函数 ──

function gainConfig(): AissetsConfig | null {
    if (cached === undefined) {
        cached = loadConfig(program.opts().config);
    }
    return cached;
}

function resolvePlugin(name: string) {
    const plugin = getPlugin(name);
    if (!plugin) {
        console.error(`Unknown platform: "${name}".`);
        console.error(`Use "aissets list" to see available platforms.`);
        return null;
    }
    return plugin;
}

function resolveTargets(platform?: string, all?: boolean) {
    if (all) return [...plugins];
    if (platform) {
        const p = getPlugin(platform);
        if (!p) throw new Error(`Unknown platform: "${platform}". Use "aissets list" to see available platforms.`);
        return [p];
    }
    return [plugins[Math.floor(Math.random() * plugins.length)]];
}

function buildInput(opts: Record<string, string>): {
    input: GenerationInput;
    options: GenerationOptions;
} {
    let input: GenerationInput;
    if (opts.image) {
        input = { type: 'image', url: opts.image };
    } else if (opts.prompt) {
        input = { type: 'prompt', text: opts.prompt };
    } else {
        throw new Error('Either --image or --prompt must be provided');
    }

    let extraOptions: Record<string, unknown> = {};
    try {
        extraOptions = JSON.parse(opts.options || '{}');
    } catch {
        throw new Error('Invalid JSON for --options');
    }

    return {
        input,
        options: {
            format: (opts.format || 'glb') as ModelFileFormat,
            ...extraOptions,
        },
    };
}
