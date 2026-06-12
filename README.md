# aissets

> [中文文档](README.zh.md)

AI 3D model generation CLI tool — create, query, and download 3D assets from multiple AI platforms with a single command.

## Supported Platforms

| Platform   | Description                         |
| ---------- | ----------------------------------- |
| `meshy`    | Meshy - AI 3D model generation      |
| `tripo3d`  | Tripo3D - AI 3D generation (TripoSR)|
| `hi3d`     | Hi3D - 3D model generation          |
| `hyper3d`  | Hyper3D - AI 3D model generation    |
| `hunyuan3d`| Hunyuan3D - Tencent Hunyuan 3D      |

## Install

```bash
npm install -g aissets
```

## Quick Start

### 1. Configure API Keys

Create `config.json` in your working directory. Each platform module reads its own section from the config.

```json
{
  "default": {
    "timeout": 300000
  },
  "platforms": {
    "meshy": {
      "apiKey": "your-meshy-api-key",
      "baseUrl": "https://api.meshy.ai"
    },
    "tripo3d": {
      "apiKey": "your-tripo3d-api-key",
      "baseUrl": "https://api.tripo3d.ai"
    },
    "hi3d": {
      "apiKey": "your-hi3d-api-key",
      "baseUrl": "https://api.hitem3d.ai"
    },
    "hyper3d": {
      "apiKey": "your-hyper3d-api-key",
      "baseUrl": "https://api.hyper3d.ai"
    },
    "hunyuan3d": {
      "apiKey": "your-hunyuan3d-api-key",
      "baseUrl": "https://hunyuan.tencentcloudapi.com"
    }
  }
}
```

Use `-c` to specify a custom config path:

```bash
aissets -c /path/to/config.json create meshy -i image.png
```

### 2. List Available Platforms

```bash
aissets list
```

### 3. Create a Generation Task

```bash
# Image-to-3D
aissets create meshy -i https://example.com/image.png -f glb

# Text-to-3D
aissets create tripo3d -p "a red sports car" -f obj

# With extra options
aissets create meshy -i input.png -f glb -o '{"quality":"high"}'
```

Options:

| Option               | Description                              |
| -------------------- | ---------------------------------------- |
| `-i, --image <url>`  | Input image URL                          |
| `-p, --prompt <text>`| Text-to-3D prompt                        |
| `-f, --format <fmt>` | Output format (glb/obj/fbx...), default: glb |
| `-o, --options <json>`| Extra platform options as JSON          |

### 4. Check Task Status

```bash
aissets status meshy <task-id>
```

### 5. Get Result

```bash
aissets result meshy <task-id>
```

### 6. Wait and Auto-Get Result

```bash
aissets wait meshy <task-id> --poll 5000
```

### Global Options

| Option                | Description                  |
| --------------------- | ---------------------------- |
| `-c, --config <path>` | Config file path (default: ./config.json) |
| `-h, --help`          | Display help                 |
| `-V, --version`       | Output version               |

## License

MIT
