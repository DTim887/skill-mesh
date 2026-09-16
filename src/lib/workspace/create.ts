import {randomUUID} from 'node:crypto'
import {copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

import type {SkillTarget} from '../skill-targets.js'

import {type PendingRename, renameAllOrNothing} from './atomic-rename.js'
import {renderMetaSkillTemplate} from './template.js'

const REGISTRY_CONTENT = `${JSON.stringify({installed: [], 'schema_version': '1.0'}, null, 2)}\n`

// Builds `.skillmesh/` (registry.json + the shared fetch-confluence script) plus one rendered
// meta-skill `SKILL.md` per target (e.g. `.claude/skills/skillmesh/`, `.cursor/skills/skillmesh/`)
// in a hidden temp directory, then commits all of them via `renameAllOrNothing` — `.skillmesh`
// first (so its presence, checked by `isWorkspaceMarked`, always implies everything else landed
// too), each target next. Each rename targets only the leaf directory it needs
// (`<skillsDir>/skillmesh`), not the whole `.claude`/`.cursor` tree, so a workspace that already
// has unrelated content under `.claude/` or `.cursor/` (e.g. a project that already uses Cursor)
// is left untouched (FR-007).
export async function createWorkspace(
  root: string,
  targets: SkillTarget[],
  skillTemplatePath: string,
  fetchConfluenceScriptPath: string,
): Promise<string[]> {
  await mkdir(root, {recursive: true})

  const tmpRoot = path.join(root, `.skillmesh-init-${randomUUID()}`)

  try {
    const skillTemplate = await readFile(skillTemplatePath, 'utf8')

    const tmpSkillmesh = path.join(tmpRoot, 'skillmesh')
    await mkdir(path.join(tmpSkillmesh, 'scripts'), {recursive: true})
    await writeFile(path.join(tmpSkillmesh, 'registry.json'), REGISTRY_CONTENT, 'utf8')
    await copyFile(fetchConfluenceScriptPath, path.join(tmpSkillmesh, 'scripts', 'fetch-confluence.mjs'))

    const targetRenames: PendingRename[] = await Promise.all(
      targets.map(async (target, index) => {
        const tmpDir = path.join(tmpRoot, `target-${index}`)
        await mkdir(tmpDir, {recursive: true})
        await writeFile(
          path.join(tmpDir, 'SKILL.md'),
          renderMetaSkillTemplate(skillTemplate, target.agentName),
          'utf8',
        )
        return {finalPath: path.join(root, target.skillsDir, 'skillmesh'), tmpPath: tmpDir}
      }),
    )

    await renameAllOrNothing([{finalPath: path.join(root, '.skillmesh'), tmpPath: tmpSkillmesh}, ...targetRenames])

    return [
      '.skillmesh/registry.json',
      '.skillmesh/scripts/fetch-confluence.mjs',
      ...targets.map((target) => `${target.skillsDir}/skillmesh/SKILL.md`),
    ]
  } finally {
    await rm(tmpRoot, {force: true, recursive: true}).catch(() => {})
  }
}
