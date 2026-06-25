# aissets

> [English Documentation](README.md)

AI 3D 模型生成命令行工具 — 一行命令即可在多个 AI 平台创建、查询、下载 3D 资产。

## 支持平台

| 平台         | 描述                                         |
| ------------ | -------------------------------------------- |
| `meshy`      | Meshy - AI 3D 模型生成                       |
| `tripo3d`    | Tripo3D - AI 3D 生成 (TripoSR)               |
| `hi3d`       | Hi3D - 3D 模型生成                           |
| `hyper3d`    | Hyper3D - AI 3D 模型生成                     |
| `liblib`     | LibLib - AI 图像生成                         |
| `runninghub` | RunningHub - AI 图像 & 3D 模型生成            |

## 安装

```bash
npm install -g aissets
```

## 快速开始

### 1. 配置 API Key

在工作目录下创建 `config.json`，各平台模块将自行读取所属配置段。

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

使用 `-c` 指定自定义配置文件路径：

```bash
aissets -c /path/to/config.json create meshy -i image.png
```

### 2. 一键生成

```bash
# 随机选取一个平台
aissets run -p "一辆红色跑车"

# 指定平台
aissets run meshy -i https://example.com/input.png -f obj

# 所有平台都跑一遍
aissets run -p "描述文字" --all

# 自定义下载目录和轮询间隔
aissets run tripo3d -p "描述文字" -d ./output --poll 5000
```

### 3. 分步操作

```bash
# 创建任务
# 图片转 3D
aissets create meshy -i https://example.com/image.png -f glb
# 文字转 3D
aissets create tripo3d -p "一辆红色跑车" -f obj
# 附加参数
aissets create meshy -i input.png -f glb -o '{"quality":"high"}'

# 查询状态
aissets status meshy <task-id>

# 获取结果（自动下载到 assets/<平台>/）
aissets result meshy <task-id>
aissets result meshy <task-id> -d ./output

# 等待完成后下载
aissets wait meshy <task-id> --poll 5000
```

### 4. 列出平台

```bash
aissets list
```

## 命令

| 命令 | 说明 |
| ---- | ---- |
| `run [平台]` | 一键全链路：创建 → 等待 → 下载 |
| `create <平台>` | 提交生成任务 |
| `status <平台> <任务ID>` | 查询任务状态 |
| `result <平台> <任务ID>` | 获取结果并下载文件 |
| `wait <平台> <任务ID>` | 轮询至完成并下载 |
| `list` | 列出可用平台 |

## 选项

| 选项                    | 适用命令 | 说明 |
| ----------------------- | -------- | ---- |
| `-i, --image <url>`     | `run`, `create` | 输入图片 URL |
| `-p, --prompt <text>`   | `run`, `create` | 文字提示词 |
| `-f, --format <fmt>`    | `run`, `create` | 输出格式 (glb/obj/fbx...)，默认 glb |
| `-o, --options <json>`  | `create`       | 额外平台参数，JSON 字符串 |
| `-d, --download <dir>`  | `run`, `result`, `wait` | 下载目录（默认: ./assets） |
| `--poll <ms>`           | `run`, `wait`  | 轮询间隔（默认: 3000） |
| `--all`                 | `run`          | 在所有平台上运行（覆盖 [平台] 参数） |
| `-c, --config <path>`   | 全局           | 配置文件路径（默认: ./config.json） |
| `-h, --help`            | 全局           | 显示帮助 |
| `-V, --version`         | 全局           | 输出版本 |

下载文件按平台分目录存放：`assets/meshy/`、`assets/tripo3d/` 等。

## License

MIT
