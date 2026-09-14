import {randomUUID} from 'node:crypto'
import {copyFile, mkdir, rename, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

const REGISTRY_CONTENT = `${JSON.stringify({installed: [], 'schema_version': '1.0'}, null, 2)}\n`

export async function createWorkspace(root: string, skillTemplatePath: string): Promise<string[]> {
  await mkdir(root, {recursive: true})

  const tmpRoot = path.join(root, `.skillmesh-init-${randomUUID()}`)
  const tmpSkillmesh = path.join(tmpRoot, 'skillmesh')
  const tmpClaudeSkillDir = path.join(tmpRoot, 'claude', 'skills', 'skillmesh')
  const finalSkillmesh = path.join(root, '.skillmesh')
  const finalClaude = path.join(root, '.claude')

  try {
    await mkdir(tmpSkillmesh, {recursive: true})
    await writeFile(path.join(tmpSkillmesh, 'registry.json'), REGISTRY_CONTENT, 'utf8')

    await mkdir(tmpClaudeSkillDir, {recursive: true})
    await copyFile(skillTemplatePath, path.join(tmpClaudeSkillDir, 'SKILL.md'))

    await rename(tmpSkillmesh, finalSkillmesh)

    try {
      await rename(path.join(tmpRoot, 'claude'), finalClaude)
    } catch (error) {
      // Best-effort rollback so a failed second rename doesn't leave a half-initialized
      // workspace that would incorrectly pass the "already initialized" check on retry.
      await rename(finalSkillmesh, tmpSkillmesh).catch(() => {})
      throw error
    }

    return ['.skillmesh/registry.json', '.claude/skills/skillmesh/SKILL.md']
  } finally {
    await rm(tmpRoot, {force: true, recursive: true}).catch(() => {})
  }
}
