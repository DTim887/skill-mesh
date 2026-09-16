import {Errors} from '@oclif/core'
import {HttpsProxyAgent} from 'https-proxy-agent'
import {createRequire} from 'node:module'

import {getCatalogConfig} from './config.js'

// `nock` (used in tests) monkeypatches the CJS `http`/`https` modules; an ESM `import` of those
// built-ins captures a namespace that bypasses that patch, so `nock` silently fails to intercept
// requests made through it. `createRequire` gets the same modules via the CJS path nock actually
// patches, while still keeping full type information via `typeof import(...)`.
const require = createRequire(import.meta.url)
const http: typeof import('node:http') = require('node:http')
const https: typeof import('node:https') = require('node:https')

export type Domain = {
  description: string
  id: string
  maintainer: string
  name: string
  repository: string
  tags: string[]
  version: string
}

export type SearchResult =
  | {domains: Domain[]; kind: 'matches'; total: number}
  | {kind: 'empty-catalog'; total: number}
  | {kind: 'no-match'; total: number}

type RawDomain = {
  description?: unknown
  maintainer?: unknown
  name?: unknown
  repository?: unknown
  tags?: unknown
  version?: unknown
}

type RawCatalog = {
  domains?: Record<string, RawDomain>
  schema_version?: unknown
}

const CONNECTION_ERROR_MESSAGE = '无法连接到知识库目录，请检查网络（是否已连接公司内网/VPN）后重试'
const PARSE_ERROR_MESSAGE = '知识库目录数据异常，无法读取，请联系管理员'

function toDomain(id: string, raw: RawDomain): Domain {
  if (
    typeof raw.name !== 'string' ||
    typeof raw.description !== 'string' ||
    typeof raw.repository !== 'string' ||
    typeof raw.version !== 'string' ||
    typeof raw.maintainer !== 'string'
  ) {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'CATALOG_PARSE_ERROR', exit: 1})
  }

  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : []

  return {
    description: raw.description,
    id,
    maintainer: raw.maintainer,
    name: raw.name,
    repository: raw.repository,
    tags,
    version: raw.version,
  }
}

// Node's http/https modules ignore HTTPS_PROXY/https_proxy by default (unlike curl or browsers),
// so on a network that requires a proxy to reach the internet, direct requests fail or are
// unreliable even though the target is genuinely reachable via the configured proxy.
function resolveProxyUrl(targetUrl: string, env: NodeJS.ProcessEnv): string | undefined {
  if (targetUrl.startsWith('http://')) {
    return env.HTTP_PROXY || env.http_proxy
  }

  return env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
}

// Thrown by `fetchText` when a response actually came back with a non-2xx status — distinct from
// a connection-level failure (DNS, refused, timeout, ...) where no status was ever received.
// `manifest.ts` uses `statusCode` to tell "this specific tag doesn't exist" (404) apart from a
// generic network problem; `catalog.ts` itself doesn't need the distinction and keeps collapsing
// both into one friendly message.
export class HttpStatusError extends Error {
  constructor(public statusCode: number) {
    super(`unexpected status ${statusCode}`)
  }
}

// Shared with `manifest.ts` (domain repository manifest fetches use the exact same proxy-aware,
// nock-compatible HTTP GET as the catalog itself), not catalog-specific despite living here.
export function fetchText(url: string, token?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https
    const headers = token ? {Authorization: `Bearer ${token}`} : undefined
    const proxyUrl = resolveProxyUrl(url, process.env)
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined

    const request = client.get(url, {agent, headers}, (response) => {
      const status = response.statusCode ?? 0
      if (status < 200 || status >= 300) {
        response.resume()
        reject(new HttpStatusError(status))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => resolve(body))
      response.on('error', reject)
    })

    request.on('error', reject)
  })
}

export async function fetchCatalog(): Promise<Domain[]> {
  const {token, url} = getCatalogConfig()

  let body: string
  try {
    body = await fetchText(url, token)
  } catch {
    throw new Errors.CLIError(CONNECTION_ERROR_MESSAGE, {code: 'CATALOG_CONNECTION_ERROR', exit: 1})
  }

  let raw: RawCatalog
  try {
    raw = JSON.parse(body) as RawCatalog
  } catch {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'CATALOG_PARSE_ERROR', exit: 1})
  }

  if (!raw.domains || typeof raw.domains !== 'object') {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'CATALOG_PARSE_ERROR', exit: 1})
  }

  return Object.entries(raw.domains)
    .map(([id, domain]) => toDomain(id, domain))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function findDomainById(domains: Domain[], id: string): Domain | undefined {
  return domains.find((domain) => domain.id === id)
}

export function matchDomains(domains: Domain[], keyword: string): Domain[] {
  const terms = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0)

  return domains.filter((domain) => {
    const haystack = [domain.name, domain.description, ...domain.tags].join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export async function runSearch(keyword?: string): Promise<SearchResult> {
  const domains = await fetchCatalog()
  const total = domains.length

  if (total === 0) {
    return {kind: 'empty-catalog', total}
  }

  if (!keyword) {
    return {domains, kind: 'matches', total}
  }

  const matched = matchDomains(domains, keyword)

  if (matched.length === 0) {
    return {kind: 'no-match', total}
  }

  return {domains: matched, kind: 'matches', total}
}
