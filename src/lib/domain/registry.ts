import {randomUUID} from 'node:crypto'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

import type {SkillTarget} from '../skill-targets.js'

import {type PendingRename, renameAllOrNothing} from '../workspace/atomic-rename.js'

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
  return JSON.parse(content) as Registry
}

export function isDomainInstalled(registry: Registry, id: string): boolean {
  return registry.installed.some((record) => record.id === id)
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
