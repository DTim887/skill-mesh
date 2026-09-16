import {expect} from 'chai'
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {SKILL_TARGETS} from '../../src/lib/skill-targets.js'
import {createWorkspace} from '../../src/lib/workspace/create.js'

describe('workspace/create createWorkspace', () => {
  let root: string
  let templatePath: string
  let scriptPath: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'skillmesh-create-test-'))
    templatePath = path.join(root, 'template-SKILL.md')
    writeFileSync(templatePath, '帮助你（{{AGENT_NAME}}）判断该怎么做。\n', 'utf8')
    scriptPath = path.join(root, 'fixture-fetch-confluence.mjs')
    writeFileSync(scriptPath, '// fixture script\n', 'utf8')
  })

  afterEach(() => {
    rmSync(root, {force: true, recursive: true})
  })

  it('creates all four artifacts with correct content on success', async () => {
    const created = await createWorkspace(root, SKILL_TARGETS, templatePath, scriptPath)

    expect(created.sort()).to.deep.equal(
      [
        '.claude/skills/skillmesh/SKILL.md',
        '.cursor/skills/skillmesh/SKILL.md',
        '.skillmesh/registry.json',
        '.skillmesh/scripts/fetch-confluence.mjs',
      ].sort(),
    )

    const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry).to.deep.equal({installed: [], 'schema_version': '1.0'})

    expect(readFileSync(path.join(root, '.skillmesh', 'scripts', 'fetch-confluence.mjs'), 'utf8')).to.equal(
      '// fixture script\n',
    )

    const claudeSkill = readFileSync(path.join(root, '.claude', 'skills', 'skillmesh', 'SKILL.md'), 'utf8')
    const cursorSkill = readFileSync(path.join(root, '.cursor', 'skills', 'skillmesh', 'SKILL.md'), 'utf8')
    expect(claudeSkill).to.equal('帮助你（Claude Code）判断该怎么做。\n')
    expect(cursorSkill).to.equal('帮助你（Cursor）判断该怎么做。\n')
  })

  it('does not touch pre-existing unrelated content under .cursor/', async () => {
    mkdirSync(path.join(root, '.cursor', 'rules'), {recursive: true})
    writeFileSync(path.join(root, '.cursor', 'rules', 'my-rule.mdc'), 'existing content', 'utf8')

    await createWorkspace(root, SKILL_TARGETS, templatePath, scriptPath)

    expect(readFileSync(path.join(root, '.cursor', 'rules', 'my-rule.mdc'), 'utf8')).to.equal('existing content')
    expect(existsSync(path.join(root, '.cursor', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)
  })

  it('does not touch pre-existing unrelated content under .claude/ (symmetric case)', async () => {
    mkdirSync(path.join(root, '.claude', 'commands'), {recursive: true})
    writeFileSync(path.join(root, '.claude', 'commands', 'my-command.md'), 'existing content', 'utf8')

    await createWorkspace(root, SKILL_TARGETS, templatePath, scriptPath)

    expect(readFileSync(path.join(root, '.claude', 'commands', 'my-command.md'), 'utf8')).to.equal(
      'existing content',
    )
    expect(existsSync(path.join(root, '.claude', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)
  })

  it('rolls back every already-completed path when a later target rename fails, and leaves no partial state', async () => {
    // Force the Cursor target's rename to fail with a real OS-level error: pre-occupy its target
    // with a plain file, so renaming a directory onto it fails with ENOTDIR. `.skillmesh` and the
    // Claude target both land before this failure, per SKILL_TARGETS order, and must be rolled
    // back too — not just the one that actually failed.
    mkdirSync(path.join(root, '.cursor', 'skills'), {recursive: true})
    writeFileSync(path.join(root, '.cursor', 'skills', 'skillmesh'), 'this occupies the rename target')

    let thrown: unknown
    try {
      await createWorkspace(root, SKILL_TARGETS, templatePath, scriptPath)
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as NodeJS.ErrnoException).code).to.equal('ENOTDIR')

    expect(existsSync(path.join(root, '.skillmesh'))).to.equal(false)
    expect(existsSync(path.join(root, '.claude', 'skills', 'skillmesh'))).to.equal(false)

    // The pre-existing file at the Cursor target (not created by createWorkspace) is untouched.
    expect(readFileSync(path.join(root, '.cursor', 'skills', 'skillmesh'), 'utf8')).to.equal(
      'this occupies the rename target',
    )

    // No leftover temp staging directory.
    const leftoverTempDirs = readdirSync(root).filter((entry) => entry.startsWith('.skillmesh-init-'))
    expect(leftoverTempDirs).to.deep.equal([])
  })
})
