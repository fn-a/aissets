# aissets

> [中文文档](README.zh.md)

AI 3D model generation CLI tool — create, query, and download 3D assets from multiple AI platforms with a single command.

## Supported Platforms

| Platform     | Description                                    |
| ------------ | ---------------------------------------------- |
| `meshy`      | Meshy - AI 3D model generation                 |
| `tripo3d`    | Tripo3D - AI 3D generation                     |
| `hi3d`       | Hi3D - 3D model generation                     |
| `hyper3d`    | Hyper3D - AI 3D model generation               |
| `liblib`     | LibLib - AI image generation                   |
| `runninghub` | RunningHub - AI image & 3D model generation    |

## Install

```bash
npm install -g aissets
```

## Quick Start

### 1. Configure API Keys

Create `config.json` in your working directory. Each platform module reads its own section from the config.

```json
{
    "default": { "timeout": 300000 },
    "platforms": {
        "meshy":      { "apiKey": "your-key", "baseUrl": "https://api.meshy.ai" },
        "tripo3d":    { "apiKey": "your-key", "baseUrl": "https://api.tripo3d.com" },
        "hi3d":       { "apiKey": "client_id:client_secret", "baseUrl": "https://api.hitem3d.ai" },
        "hyper3d":    { "apiKey": "your-key", "baseUrl": "https://api.hyper3d.ai" },
        "liblib":     { "apiKey": "your-key", "baseUrl": "https://openapi.liblibai.cloud" },
        "runninghub": { "apiKey": "your-key", "baseUrl": "https://www.runninghub.cn" }
    }
}
```

Use `-c` to specify a custom config path:

```bash
aissets -c /path/to/config.json create meshy -i image.png
```

### 2. One-Shot Generation

```bash
# Pick a random platform
aissets run -p "a red sports car"

# Specify the platform
aissets run meshy -i https://example.com/input.png -f obj

# Run on all platforms
aissets run -p "prompt" --all

# Custom download dir and poll interval
aissets run tripo3d -p "prompt" -d ./output --poll 5000
```

### 3. Step-by-Step Workflow

```bash
# Create a task
# Image-to-3D
aissets create meshy -i https://example.com/image.png -f glb
# Text-to-3D
aissets create tripo3d -p "a red sports car" -f obj
# With extra options
aissets create meshy -i input.png -f glb -o '{"quality":"high"}'

# Check status
aissets status meshy <task-id>

# Get result (auto-downloads to assets/<platform>/)
aissets result meshy <task-id>
aissets result meshy <task-id> -d ./output

# Wait for completion then download
aissets wait meshy <task-id> --poll 5000
```

### 4. List Platforms

```bash
aissets list
```

## Commands

| Command | Description |
| ------- | ----------- |
| `run [platform]` | One-shot full pipeline: create → wait → download |
| `create <platform>` | Submit a generation task |
| `status <platform> <taskId>` | Check task status |
| `result <platform> <taskId>` | Get result and download files |
| `wait <platform> <taskId>` | Poll until completion, then download |
| `list` | List available platforms |

## Options

| Option                 | Applies to | Description |
| ---------------------- | ---------- | ----------- |
| `-i, --image <url>`    | `run`, `create` | Input image URL |
| `-p, --prompt <text>`  | `run`, `create` | Text-to-3D prompt |
| `-f, --format <fmt>`   | `run`, `create` | Output format (glb/obj/fbx...), default: glb |
| `-o, --options <json>` | `create`       | Extra platform options as JSON |
| `-d, --download <dir>` | `run`, `result`, `wait` | Download dir (default: ./assets) |
| `--poll <ms>`          | `run`, `wait`  | Poll interval (default: 3000) |
| `--all`                | `run`          | Run on all platforms (overrides [platform]) |
| `-c, --config <path>`  | global         | Config file path (default: ./config.json) |
| `-h, --help`           | global         | Display help |
| `-V, --version`        | global         | Output version |

Downloaded files are organized by platform: `assets/meshy/`, `assets/tripo3d/`, etc.

## License

MIT
