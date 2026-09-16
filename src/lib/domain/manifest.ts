import {Errors} from '@oclif/core'

import {fetchText, HttpStatusError} from './catalog.js'

export type KnowledgeSourceEntry = {
  summary: string
  type: string
  url: string
}

export type DomainManifest = {
  description: string
  id: string
  knowledgeSource: KnowledgeSourceEntry[]
  maintainer: string
  name: string
  usageHint: string
  version: string
}

type RawKnowledgeSourceEntry = {
  summary?: unknown
  type?: unknown
  url?: unknown
}

type RawManifest = {
  description?: unknown
  id?: unknown
  knowledge_source?: unknown
  maintainer?: unknown
  name?: unknown
  usage_hint?: unknown
  version?: unknown
}

const CONNECTION_ERROR_MESSAGE = '无法连接到该 Domain 的知识库仓库，请检查网络（是否已连接公司内网/VPN）后重试'
const NOT_FOUND_MESSAGE_PREFIX = '未找到 v'
const NOT_FOUND_MESSAGE_SUFFIX = ' 对应的版本，请确认版本号或联系该 Domain 的维护者'
const PARSE_ERROR_MESSAGE = '该 Domain 的知识库内容格式异常，无法读取，请联系维护者'
const MISMATCH_MESSAGE = '这个 Domain 的内容和登记信息对不上，请联系维护者'

// Matches `https://github.com/<owner>/<repo>`, tolerating a trailing slash and/or `.git` suffix.
// Anything else (non-GitHub hosts, malformed URLs) is treated the same as a fetch failure — see
// research.md 决策 2.
const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/

export function parseGitHubRepository(repository: string): undefined | {owner: string; repo: string} {
  const match = GITHUB_REPO_PATTERN.exec(repository)
  return match ? {owner: match[1], repo: match[2]} : undefined
}

function toKnowledgeSourceEntry(raw: RawKnowledgeSourceEntry): KnowledgeSourceEntry | undefined {
  if (typeof raw.type !== 'string' || typeof raw.url !== 'string' || typeof raw.summary !== 'string') {
    return undefined
  }

  return {summary: raw.summary, type: raw.type, url: raw.url}
}

function toDomainManifest(raw: RawManifest): DomainManifest {
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.description !== 'string' ||
    typeof raw.version !== 'string' ||
    typeof raw.maintainer !== 'string' ||
    typeof raw.usage_hint !== 'string' ||
    !Array.isArray(raw.knowledge_source)
  ) {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'MANIFEST_PARSE_ERROR', exit: 1})
  }

  const knowledgeSource = raw.knowledge_source
    .map((entry: RawKnowledgeSourceEntry) => toKnowledgeSourceEntry(entry))
    .filter((entry): entry is KnowledgeSourceEntry => entry !== undefined)

  if (knowledgeSource.length === 0) {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'MANIFEST_PARSE_ERROR', exit: 1})
  }

  return {
    description: raw.description,
    id: raw.id,
    knowledgeSource,
    maintainer: raw.maintainer,
    name: raw.name,
    usageHint: raw.usage_hint,
    version: raw.version,
  }
}

export async function fetchManifest(repository: string, version: string): Promise<DomainManifest> {
  const parsed = parseGitHubRepository(repository)
  if (!parsed) {
    throw new Errors.CLIError(CONNECTION_ERROR_MESSAGE, {code: 'MANIFEST_FETCH_ERROR', exit: 1})
  }

  const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/v${version}/manifest.json`

  let body: string
  try {
    body = await fetchText(url)
  } catch (error) {
    // A real HTTP 404 means this specific tag/manifest doesn't exist — worth telling the user
    // which version it looked for. Anything else (DNS, connection refused, timeout, other status
    // codes) collapses into the same generic connection message `domain search` already uses.
    if (error instanceof HttpStatusError && error.statusCode === 404) {
      throw new Errors.CLIError(`${NOT_FOUND_MESSAGE_PREFIX}${version}${NOT_FOUND_MESSAGE_SUFFIX}`, {
        code: 'MANIFEST_VERSION_NOT_FOUND',
        exit: 1,
      })
    }

    throw new Errors.CLIError(CONNECTION_ERROR_MESSAGE, {code: 'MANIFEST_FETCH_ERROR', exit: 1})
  }

  let raw: RawManifest
  try {
    raw = JSON.parse(body) as RawManifest
  } catch {
    throw new Errors.CLIError(PARSE_ERROR_MESSAGE, {code: 'MANIFEST_PARSE_ERROR', exit: 1})
  }

  return toDomainManifest(raw)
}

// FR-006/FR-007: the manifest's own `id`/`version` must exactly match what was requested —
// otherwise the domain repository's content doesn't actually match what the catalog promised.
export function validateManifest(manifest: DomainManifest, expectedId: string, expectedVersion: string): void {
  if (manifest.id !== expectedId || manifest.version !== expectedVersion) {
    throw new Errors.CLIError(MISMATCH_MESSAGE, {code: 'MANIFEST_MISMATCH', exit: 9})
  }
}
