# liya-workspace-plugin · 工作区档案速览插件

在 DeepSeek Harness WebUI 设置里新增「莉娅工作区」子设置页，实时展示工作区档案速览：
FILE-MAP 摘要、`memory` / `records` / `diary` 目录统计、最近日记列表。

## 结构

| 文件 | 作用 |
|:-----|:-----|
| `index.js` | Host 半：注册 webServer 路由 `/liya-workspace/summary`，实时读工作区档案统计 |
| `client.js` | Client 半（手写 bundle）：设置页 `settings.section` 注册 + fetch 展示 + 极简 markdown 渲染 |
| `cordis.patch.yml` | 插件挂载行（insert 进配置树） |

## 安装

```powershell
# 方式一：本地目录（开发期，改源码重启即生效）
dsh plugin --profile web add <本目录>

# 方式二：tgz 包（交付/分发，可移植）
pnpm pack
dsh plugin --profile web add <本目录>/liya-workspace-plugin-<版本号>.tgz
```

> `dsh` 请替换为阁下 DSH 安装对应的 CLI 调用方式。

装完**重启 WebUI**（完全退出再打开）生效。卸载：
`dsh plugin --profile web remove liya-workspace-plugin`

## 配置工作区根目录

插件需要知道工作区根目录（其下应包含 `workspace/`、`diary/` 等目录），解析优先级：

1. **设置页**：设置 → 莉娅工作区 → `workspaceRoot` 字段，填写绝对路径，保存**即时生效**（推荐）
2. **cordis.yml**：插件条目 `config.workspaceRoot` 作为启动兜底
3. **进程工作目录**：两者都为空时使用 DSH host 进程的当前工作目录

## 数据链路

host（`ctx.webServer` 路由）→ JSON → client（`fetch('/liya-workspace/summary')`）→ 渲染。

## 验证

- 路由：`Invoke-WebRequest http://127.0.0.1:<port>/liya-workspace/summary` → 200 + JSON
- 设置页：设置 → 莉娅工作区 → 档案速览 + FILE-MAP markdown 渲染
