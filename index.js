// 莉娅工作区插件 —— Host 半（ESM，函数形式）
// 功能：注册 webServer 路由 /liya-workspace/summary，返回工作区档案统计 JSON，
// 供 Client 半的设置页 fetch 展示（host↔client 数据链路）。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// TODO: 部署变化的参数应走 Config 字段（cordis.yml 可改），入门版先硬编码。
const WORKSPACE_ROOT = 'E:/DCIM/DSH-Liya'

export const name = 'liya-workspace'
export const inject = ['webServer']

function dirCount(rel) {
  try {
    return readdirSync(join(WORKSPACE_ROOT, rel)).filter((n) => !n.startsWith('.')).length
  } catch {
    return 0
  }
}

function collectSummary() {
  const out = {
    root: WORKSPACE_ROOT,
    map: '',
    memoryCount: 0,
    recordsCount: 0,
    diaryCount: 0,
    recentDiary: [],
  }
  try {
    const map = readFileSync(join(WORKSPACE_ROOT, 'workspace/FILE-MAP.md'), 'utf8')
    out.map = map
      .split('\n')
      .filter((l) => l.includes('|') || l.includes('## '))
      .slice(0, 15)
      .join('\n')
      .slice(0, 900)
  } catch (err) {
    out.map = `FILE-MAP 读取失败: ${err.message}`
  }
  out.memoryCount = dirCount('workspace/memory')
  out.recordsCount = dirCount('workspace/records')
  try {
    const names = readdirSync(join(WORKSPACE_ROOT, 'diary'))
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

export function apply(ctx) {
  console.log('[liya-workspace] plugin loaded (host half)')

  ctx.webServer.register({
    kind: 'prefix',
    path: '/liya-workspace',
    handler: async (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(collectSummary()))
    },
  })
  console.log('[liya-workspace] route /liya-workspace/summary registered')
}
