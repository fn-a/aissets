import { Command } from 'commander';
import type { AissetsConfig, GenerationInput, GenerationOptions, ModelFileFormat } from '@aissets/core';
import { loadConfig } from '@aissets/core';
import { getPlugin, plugins } from '@aissets/base';

const program = new Command();

program
    .name('aissets')
    .description('CLI tool for AI 3D model generation platforms')
    .version('0.1.0');

// ── 全局选项 ──
program.option('-c, --config <path>', 'Path to config file (default: ./config.json)');

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
    .option('-i, --image <url>', 'Input image URL')
    .option('-p, --prompt <text>', 'Input text prompt')
    .option('-f, --format <fmt>', 'Output format (glb, obj, etc.)', 'glb')
    .option('-o, --options <json>', 'Additional options as JSON string', '{}')
    .action(async (platformName: string, opts) => {
        const plugin = resolvePlugin(platformName);
        if (!plugin) return;

        const { input, options } = buildInput(opts);
        plugin.init(rawConfig());

        console.log(`Creating task on ${plugin.name}...`);
        const task = await plugin.create(input, options);
        console.log(JSON.stringify(task, null, 2));
    });

// ── status 命令：查询任务状态 ──
program
    .command('status <platform> <taskId>')
    .description('Check task status')
    .action(async (platformName: string, taskId: string) => {
        const plugin = resolvePlugin(platformName);
        if (!plugin) return;

        plugin.init(rawConfig());
        const task = await plugin.status(taskId);
        console.log(JSON.stringify(task, null, 2));
    });

// ── result 命令：获取生成结果 ──
program
    .command('result <platform> <taskId>')
    .description('Get generation result')
    .action(async (platformName: string, taskId: string) => {
        const plugin = resolvePlugin(platformName);
        if (!plugin) return;

        plugin.init(rawConfig());
        const result = await plugin.result(taskId);
        console.log(JSON.stringify(result, null, 2));
    });

// ── wait 命令：等待任务完成并获取结果 ──
program
    .command('wait <platform> <taskId>')
    .description('Wait for task to complete and get result')
    .option('--poll <ms>', 'Poll interval in milliseconds', '3000')
    .action(async (platformName: string, taskId: string, opts) => {
        const plugin = resolvePlugin(platformName);
        if (!plugin) return;

        plugin.init(rawConfig());
        const interval = parseInt(opts.poll, 10) || 3000;
        console.log(`Waiting for task ${taskId} (polling every ${interval}ms)...`);
        const result = await plugin.expect(taskId, interval);
        console.log(JSON.stringify(result, null, 2));
    });

program.parse();

// ── 辅助函数 ──

let _rawConfig: AissetsConfig | null | undefined;

function rawConfig(): AissetsConfig | null {
    if (_rawConfig === undefined) {
        _rawConfig = loadConfig(program.opts().config);
    }
    return _rawConfig;
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
