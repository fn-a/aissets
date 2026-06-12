# aissets

> [English Documentation](README.md)

AI 3D 模型生成命令行工具 — 一行命令即可在多个 AI 平台创建、查询、下载 3D 资产。

## 支持平台

| 平台         | 描述                                 |
| ------------ | ------------------------------------ |
| `meshy`      | Meshy - AI 3D 模型生成               |
| `tripo3d`    | Tripo3D - AI 3D 生成 (TripoSR)       |
| `hi3d`       | Hi3D - 3D 模型生成                   |
| `hyper3d`    | Hyper3D - AI 3D 模型生成             |
| `hunyuan3d`  | Hunyuan3D - 腾讯混元 3D              |

## 安装

```bash
npm install -g aissets
```

## 快速开始

### 1. 配置 API Key

在工作目录下创建 `config.json`，各平台模块将自行读取所属配置段。

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

可用 `-c` 指定自定义配置文件路径：

```bash
aissets -c /path/to/config.json create meshy -i image.png
```

### 2. 列出可用平台

```bash
aissets list
```

### 3. 创建生成任务

```bash
# 图片转 3D
aissets create meshy -i https://example.com/image.png -f glb

# 文字转 3D
aissets create tripo3d -p "一辆红色跑车" -f obj

# 附加参数
aissets create meshy -i input.png -f glb -o '{"quality":"high"}'
```

参数:

| 参数                  | 描述                              |
| --------------------- | --------------------------------- |
| `-i, --image <url>`   | 输入图片 URL                       |
| `-p, --prompt <text>` | 文字提示词                         |
| `-f, --format <fmt>`  | 输出格式 (glb/obj/fbx...)，默认 glb |
| `-o, --options <json>`| 额外平台参数，JSON 字符串           |

### 4. 查询任务状态

```bash
aissets status meshy <task-id>
```

### 5. 获取生成结果

```bash
aissets result meshy <task-id>
```

### 6. 等待并自动获取结果

```bash
aissets wait meshy <task-id> --poll 5000
```

### 全局选项

| 参数                   | 描述            |
| ---------------------- | --------------- |
| `-c, --config <path>`  | 配置文件路径（默认: ./config.json） |
| `-h, --help`           | 显示帮助        |
| `-V, --version`        | 输出版本        |

## License

MIT
