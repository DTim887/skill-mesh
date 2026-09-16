import {Errors} from '@oclif/core'
import {randomUUID} from 'node:crypto'
import {existsSync} from 'node:fs'
import {mkdir, readdir, readFile, rm, rmdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import type {SkillTarget} from '../skill-targets.js'

import {type PendingRename, renameAllOrNothing} from '../workspace/atomic-rename.js'

const REGISTRY_PARSE_ERROR_MESSAGE = '安装记录异常，请联系维护者'

export type InstalledRecord = {
  files: string[]
  id: string
  'installed_at': string
  repository: string
  type: string
  version: string
}

export type Registry = {
  installed: InstalledRecord[]
  'schema_version': string
}

function registryPath(root: string): string {
  return path.join(root, '.skillmesh', 'registry.json')
}

export async function readRegistry(root: string): Promise<Registry> {
  const content = await readFile(registryPath(root), 'utf8')
  try {
    return JSON.parse(content) as Registry
  } catch {
    // Shared by `domain add` and `domain remove` — neither should ever surface a raw
    // `SyntaxError` for a corrupted registry.json (spec 006 FR-011).
    throw new Errors.CLIError(REGISTRY_PARSE_ERROR_MESSAGE, {code: 'REGISTRY_PARSE_ERROR', exit: 1})
  }
}

export function isDomainInstalled(registry: Registry, id: string): boolean {
  return registry.installed.some((record) => record.id === id)
}

export function findInstalledRecord(registry: Registry, id: string): InstalledRecord | undefined {
  return registry.installed.find((record) => record.id === id)
}

// Atomically adds one new skill directory per target (all fresh paths, e.g.
// `.claude/skills/<id>-knowledge/`, `.cursor/skills/<id>-knowledge/` — same content in each) and
// appends one record to the existing `registry.json` — either everything lands, or nothing does
// (FR-013/FR-004). Builds everything in a hidden temp directory first, then commits via
// `renameAllOrNothing`: the target skill directories (brand-new paths) first, in target-list
// order, the registry.json overwrite (an existing path) last — so that a record's presence in
// `registry.json` always implies every file actually landed (see research.md 决策 2/4 for the
// rationale and the residual-risk note if the process dies mid-commit).
export type SkillDocument = {
  content: string
  dirName: string
}

export async function appendInstalledRecord(
  root: string,
  record: InstalledRecord,
  targets: SkillTarget[],
  skill: SkillDocument,
): Promise<void> {
  const registry = await readRegistry(root)
  registry.installed.push(record)
  const newRegistryContent = `${JSON.stringify(registry, null, 2)}\n`

  const tmpRoot = path.join(root, `.skillmesh-add-${randomUUID()}`)
  const tmpRegistryFile = path.join(tmpRoot, 'registry.json')

  try {
    const targetRenames: PendingRename[] = await Promise.all(
      targets.map(async (target, index) => {
        const tmpDir = path.join(tmpRoot, `target-${index}`)
        await mkdir(tmpDir, {recursive: true})
        await writeFile(path.join(tmpDir, 'SKILL.md'), skill.content, 'utf8')
        return {finalPath: path.join(root, target.skillsDir, skill.dirName), tmpPath: tmpDir}
      }),
    )

    await writeFile(tmpRegistryFile, newRegistryContent, 'utf8')

    await renameAllOrNothing([...targetRenames, {finalPath: registryPath(root), tmpPath: tmpRegistryFile}])
  } finally {
    await rm(tmpRoot, {force: true, recursive: true}).catch(() => {})
  }
}

// Deletes every file in the record's `files` list (tolerating paths that are already missing —
// `rm(..., {force: true})` is a no-op rather than an error for those, see research.md 决策 2),
// cleans up any leaf directory that's now empty as a result, then atomically removes the record
// from registry.json (via the same `renameAllOrNothing` primitive, with a single entry — there's
// only ever one thing being committed here, unlike `appendInstalledRecord`'s multi-target case).
// Deletions run concurrently (决策 1: no ordering dependency between them, unlike renames). If any
// deletion of a file that actually exists fails for a real reason (not "already missing"), the
// whole operation aborts before touching registry.json, so a retry can safely pick up where it
// left off — already-deleted files are tolerated as "missing" on the next attempt.
export async function removeInstalledRecord(root: string, id: string): Promise<string[]> {
  const registry = await readRegistry(root)
  const record = findInstalledRecord(registry, id)
  if (!record) {
    throw new Errors.CLIError(`未安装：${id}`, {code: 'DOMAIN_REMOVE_NOT_INSTALLED', exit: 11})
  }

  const deletionResults = await Promise.all(
    record.files.map(async (relativeFilePath) => {
      const absolutePath = path.join(root, relativeFilePath)
      const existed = existsSync(absolutePath)
      if (existed) {
        await rm(absolutePath, {force: true})
      }

      const leafDir = path.dirname(absolutePath)
      try {
        const remaining = await readdir(leafDir)
        if (remaining.length === 0) {
          await rmdir(leafDir)
        }
      } catch {
        // The directory is already gone (e.g. a sibling file's cleanup already removed it), or
        // otherwise not there to clean up — nothing left to do.
      }

      return existed ? relativeFilePath : undefined
    }),
  )

  const deletedFiles = deletionResults.filter((file): file is string => file !== undefined)

  const updatedRegistry: Registry = {
    ...registry,
    installed: registry.installed.filter((entry) => entry.id !== id),
  }
  const newRegistryContent = `${JSON.stringify(updatedRegistry, null, 2)}\n`

  const tmpRegistryFile = path.join(root, `.skillmesh-remove-${randomUUID()}.json`)
  try {
    await writeFile(tmpRegistryFile, newRegistryContent, 'utf8')
    await renameAllOrNothing([{finalPath: registryPath(root), tmpPath: tmpRegistryFile}])
  } finally {
    await rm(tmpRegistryFile, {force: true}).catch(() => {})
  }

  return deletedFiles
}
