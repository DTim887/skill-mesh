#!/usr/bin/env node
// Fetches the text content of a Confluence page. Copied verbatim into a user's workspace by
// `skillmesh init` (`.skillmesh/scripts/fetch-confluence.mjs`) and invoked by Claude Code/Cursor
// when a Domain knowledge skill is triggered — see
// specs/005-cursor-skill-support/contracts/fetch-confluence-script.md for the full contract.
//
// This file runs standalone in the user's workspace (no node_modules, no build step), so it MUST
// stay dependency-free: only Node.js built-ins.
//
// Uses `node:https` rather than the global `fetch` for two reasons: `eslint-plugin-n` flags
// global `fetch` as still experimental for this project's declared `engines.node` range
// (>=20.0.0 — it doesn't leave experimental status until 22.17.0/21.0.0 depending on API
// surface, mirroring the same class of issue this project hit with `readline/promises`), and
// `createRequire` gets the CJS-path `https` module that `nock` (used by this file's own tests)
// actually patches — an ESM `import` of the same built-in would bypass that patch.
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

const require = createRequire(import.meta.url)
const https = require('node:https')

const HTML_ENTITIES = {
  '&#39;': "'",
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&nbsp;': ' ',
  '&quot;': '"',
}

const API_TOKEN_HELP_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens'

export function extractPageId(url) {
  const match = /\/pages\/(\d+)(?:\/|$)/.exec(url)
  return match ? match[1] : undefined
}

export function buildApiUrl(url, pageId) {
  const {origin} = new URL(url)
  return `${origin}/wiki/rest/api/content/${pageId}?expand=body.view`
}

// Not a full HTML parser — just enough cleanup to turn Confluence's rendered `body.view` HTML
// into readable text. Block-level tags become newlines before the rest of the tags are stripped;
// only the handful of HTML entities that actually show up in Confluence content are decoded.
// Layout (lists, tables, ...) is not preserved — see spec.md Assumptions.
export function stripHtml(html) {
  const withLineBreaks = html
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/(?:p|li|div|tr|h[1-6])>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '')

  let decoded = withLineBreaks
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.replaceAll(entity, char)
  }

  return decoded.replaceAll(/\n{3,}/g, '\n\n').trim()
}

function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {headers}, (response) => {
      const status = response.statusCode ?? 0
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => resolve({body, status}))
      response.on('error', reject)
    })

    request.on('error', reject)
  })
}

function printMissingCredentialsHelp(missing) {
  console.error(
    `缺少环境变量：${missing.join('、')}。\n` +
      `请先在 Atlassian 账号的安全设置里创建一个 API token（${API_TOKEN_HELP_URL}），\n` +
      '然后在 shell 里配置：\n' +
      '  export ATLASSIAN_EMAIL="你的 Atlassian 账号邮箱"\n' +
      '  export ATLASSIAN_API_TOKEN="刚创建的 API token"',
  )
}

export async function main(url) {
  const token = process.env.ATLASSIAN_API_TOKEN
  const email = process.env.ATLASSIAN_EMAIL

  const missing = [!email && 'ATLASSIAN_EMAIL', !token && 'ATLASSIAN_API_TOKEN'].filter(Boolean)
  if (missing.length > 0) {
    printMissingCredentialsHelp(missing)
    process.exitCode = 1
    return
  }

  const pageId = extractPageId(url)
  if (!pageId) {
    console.error('无法识别的 Confluence 页面地址')
    process.exitCode = 1
    return
  }

  const apiUrl = buildApiUrl(url, pageId)
  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  let result
  try {
    result = await getJson(apiUrl, {Authorization: `Basic ${auth}`})
  } catch {
    console.error('网络连接失败，请检查是否已连接公司内网/VPN 后重试')
    process.exitCode = 1
    return
  }

  if (result.status === 401) {
    console.error('认证失败，请检查 token/邮箱是否正确')
    process.exitCode = 1
    return
  }

  if (result.status === 404) {
    console.error('页面不存在或没有访问权限')
    process.exitCode = 1
    return
  }

  if (result.status < 200 || result.status >= 300) {
    console.error('网络连接失败，请检查是否已连接公司内网/VPN 后重试')
    process.exitCode = 1
    return
  }

  let body
  try {
    body = JSON.parse(result.body)
  } catch {
    console.error('该知识库内容格式异常，无法读取，请联系维护者')
    process.exitCode = 1
    return
  }

  const html = body?.body?.view?.value
  if (typeof html !== 'string') {
    console.error('该知识库内容格式异常，无法读取，请联系维护者')
    process.exitCode = 1
    return
  }

  console.log(stripHtml(html))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv[2])
}
