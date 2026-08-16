# liya-workspace-plugin · 莉娅工作区插件

在 DeepSeek Harness WebUI 设置里新增「莉娅工作区」子设置页，实时展示工作区档案速览
（FILE-MAP 摘要、memory/records/diary 统计、最近日记）。

## 结构

| 文件 | 作用 |
|:-----|:-----|
| `index.js` | Host 半：注册 webServer 路由 `/liya-workspace/summary`，实时读工作区档案统计 |
| `client.js` | Client 半（手写 bundle）：设置页 `settings.section` 注册 + fetch 展示 + 极简 markdown 渲染 |
| `cordis.patch.yml` | 插件挂载行（insert 进配置树） |

## 安装

```powershell
# 方式一：本地目录（开发期，改源码重启即生效）
node "E:\DeepSeek Harness\resources\host\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile web add <本目录>

# 方式二：tgz 包（交付/分发，可移植；产物集中在 workspace\dsh-plugins\dist\）
pnpm pack --pack-destination E:\DCIM\DSH-Liya\workspace\dsh-plugins\dist
node "E:\DeepSeek Harness\resources\host\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile web add E:\DCIM\DSH-Liya\workspace\dsh-plugins\dist\liya-workspace-plugin-0.1.0.tgz
```

装完**重启 WebUI**（完全退出再打开）生效。卸载：
`node "...bin.js" plugin --profile web remove liya-workspace-plugin`

## 数据链路

host（`ctx.webServer` 路由）→ JSON → client（`fetch('/liya-workspace/summary')`）→ 渲染。
工作区根路径硬编码在 `index.js` 的 `WORKSPACE_ROOT`（TODO：后续改 Config 字段）。

## 验证

- 路由：`Invoke-WebRequest http://127.0.0.1:<port>/liya-workspace/summary` → 200 + JSON
- 设置页：设置 → 莉娅工作区 → 档案速览 + FILE-MAP markdown 渲染
