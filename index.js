// 莉娅工作区插件 —— Host 半（ESM，函数形式）
// 功能：注册 webServer 路由 /dsh-liya-workspace/summary，返回工作区档案统计 JSON，
// 供 Client 半的设置页 fetch 展示（host↔client 数据链路）。
// 工作区根目录可配置，不再硬编码本机路径，解析优先级：
//   设置页「莉娅工作区」的 workspaceRoot（即时生效）> cordis.yml config.workspaceRoot > DSH host 进程当前工作目录。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-liya-workspace'
export const inject = ['webServer', 'settings']

const wsSchema = Schema.object({
  workspaceRoot: Schema.string()
    .default('')
    .description('工作区根目录绝对路径；留空则使用 DSH host 进程的当前工作目录'),
})

function dirCount(root, rel) {
  try {
    return readdirSync(join(root, rel)).filter((n) => !n.startsWith('.')).length
  } catch {
    return 0
  }
}

function collectSummary(root) {
  const out = {
    root,
    map: '',
    memoryCount: 0,
    recordsCount: 0,
    diaryCount: 0,
    recentDiary: [],
  }
  try {
    const map = readFileSync(join(root, 'workspace/FILE-MAP.md'), 'utf8')
    out.map = map
      .split('\n')
      .filter((l) => l.includes('|') || l.includes('## '))
      .slice(0, 15)
      .join('\n')
      .slice(0, 900)
  } catch (err) {
    out.map = `FILE-MAP 读取失败: ${err.message}`
  }
  out.memoryCount = dirCount(root, 'workspace/memory')
  out.recordsCount = dirCount(root, 'workspace/records')
  try {
    const names = readdirSync(join(root, 'diary'))
      .filter((n) => n.startsWith('daily-'))
      .sort()
      .reverse()
      .slice(0, 5)
    out.diaryCount = names.length
    out.recentDiary = names
  } catch {
    out.diaryCount = 0
  }
  return out
}

export function apply(ctx, config) {
  const bootRoot = (config && typeof config.workspaceRoot === 'string' && config.workspaceRoot.trim()) || ''
  console.log('[dsh-liya-workspace] plugin loaded (host half), boot workspaceRoot=' + (bootRoot || process.cwd()))

  // 配置 namespace：用户可在 WebUI 设置页填写 workspaceRoot，保存即时生效
  try {
    ctx.settings.register('dsh-liya-workspace', wsSchema, { applies: 'live' })
    console.log('[dsh-liya-workspace] settings namespace registered: dsh-liya-workspace')
  } catch (e) {
    console.error('[dsh-liya-workspace] settings.register failed:', e)
  }

  // 解析当前生效的工作区根目录（每次请求实时读取，settings 改了立即生效）
  function currentRoot() {
    try {
      const section = ctx.settings.get('dsh-liya-workspace')
      if (section && typeof section.workspaceRoot === 'string' && section.workspaceRoot.trim() !== '') {
        return section.workspaceRoot.trim()
      }
    } catch { /* settings 服务不可用时静默回退 */ }
    return bootRoot || process.cwd()
  }

  ctx.webServer.register({
    kind: 'prefix',
    path: '/dsh-liya-workspace',
    handler: async (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(collectSummary(currentRoot())))
    },
  })
  console.log('[dsh-liya-workspace] route /dsh-liya-workspace/summary registered')
}
