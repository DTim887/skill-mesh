import {randomUUID} from 'node:crypto'
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

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

// Atomically adds one new skill directory (a fresh path, e.g. `.claude/skills/<id>-knowledge/`)
// and appends one record to the existing `registry.json` — either both land, or neither does
// (FR-013). Builds everything in a hidden temp directory first, then performs the two renames as
// close together as possible: the skill directory (a brand-new path) first, the registry.json
// overwrite (an existing path) second — in that order, so that a record's presence in
// `registry.json` always implies its file actually landed (see research.md 决策 4 for the
// rationale and the residual-risk note if the process dies between the two renames).
export async function appendInstalledRecord(
  root: string,
  record: InstalledRecord,
  skillDirName: string,
  skillMarkdownContent: string,
): Promise<void> {
  const registry = await readRegistry(root)
  registry.installed.push(record)
  const newRegistryContent = `${JSON.stringify(registry, null, 2)}\n`

  const tmpRoot = path.join(root, `.skillmesh-add-${randomUUID()}`)
  const tmpSkillDir = path.join(tmpRoot, skillDirName)
  const tmpRegistryFile = path.join(tmpRoot, 'registry.json')
  const finalSkillDir = path.join(root, '.claude', 'skills', skillDirName)
  const finalRegistryFile = registryPath(root)

  try {
    await mkdir(tmpSkillDir, {recursive: true})
    await writeFile(path.join(tmpSkillDir, 'SKILL.md'), skillMarkdownContent, 'utf8')
    await writeFile(tmpRegistryFile, newRegistryContent, 'utf8')

    await mkdir(path.dirname(finalSkillDir), {recursive: true})
    await rename(tmpSkillDir, finalSkillDir)

    try {
      await rename(tmpRegistryFile, finalRegistryFile)
    } catch (error) {
      // Roll back the first rename so a failed second rename doesn't leave a skill directory on
      // disk with no corresponding registry record (which would then also block a retry, since
      // the directory would already exist at that path).
      await rm(finalSkillDir, {force: true, recursive: true}).catch(() => {})
      throw error
    }
  } finally {
    await rm(tmpRoot, {force: true, recursive: true}).catch(() => {})
  }
}
