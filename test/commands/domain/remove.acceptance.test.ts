import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {resetAsk, resetInteractiveTerminalOverride, setAsk, setInteractiveTerminalOverride} from '../../../src/lib/workspace/confirm.js'

const REPOSITORY = 'https://github.com/DTim887/skill-mesh-ordering'

function withFixedAnswer(answer: string) {
  let calls = 0
  const ask = async () => {
    calls += 1
    return answer
  }

  return {ask, callCount: () => calls}
}

function seedEmptyRegistry(workDir: string) {
  const registry = {installed: [], 'schema_version': '1.0'}
  writeFileSync(path.join(workDir, '.skillmesh', 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
}

function seedRegistry(workDir: string, files: string[]) {
  const registry = {
    installed: [
      {
        files,
        id: 'ordering',
        'installed_at': '2026-09-16T00:00:00Z',
        repository: REPOSITORY,
        type: 'domain',
        version: '1.0.0',
      },
    ],
    'schema_version': '1.0',
  }
  writeFileSync(path.join(workDir, '.skillmesh', 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
}

const CLAUDE_SKILL_SEGMENTS = ['.claude', 'skills', 'ordering-knowledge', 'SKILL.md']
const CURSOR_SKILL_SEGMENTS = ['.cursor', 'skills', 'ordering-knowledge', 'SKILL.md']

describe('domain remove', () => {
  let originalCwd: string
  let workDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    workDir = mkdtempSync(path.join(tmpdir(), 'skillmesh-domain-remove-acceptance-'))
    process.chdir(workDir)
    mkdirSync(path.join(workDir, '.skillmesh'))
    setInteractiveTerminalOverride(() => true)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    resetAsk()
    resetInteractiveTerminalOverride()
  })

  it('removes an installed domain across both tools and clears the registry record (US1)', async () => {
    mkdirSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS.slice(0, -1)), {recursive: true})
    mkdirSync(path.join(workDir, ...CURSOR_SKILL_SEGMENTS.slice(0, -1)), {recursive: true})
    writeFileSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS), 'claude content', 'utf8')
    writeFileSync(path.join(workDir, ...CURSOR_SKILL_SEGMENTS), 'cursor content', 'utf8')
    seedRegistry(workDir, [
      '.claude/skills/ordering-knowledge/SKILL.md',
      '.cursor/skills/ordering-knowledge/SKILL.md',
    ])
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error, stdout} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, '.claude', 'skills', 'ordering-knowledge'))).to.equal(false)
    expect(existsSync(path.join(workDir, '.cursor', 'skills', 'ordering-knowledge'))).to.equal(false)

    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed).to.deep.equal([])

    expect(stdout).to.include('已移除 ordering')
    expect(stdout).to.include('.claude/skills/ordering-knowledge/SKILL.md')
    expect(stdout).to.include('.cursor/skills/ordering-knowledge/SKILL.md')
  })

  it('lists the exact files to be deleted in the confirmation prompt (US1 Acceptance Scenario 2)', async () => {
    mkdirSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS.slice(0, -1)), {recursive: true})
    writeFileSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS), 'claude content', 'utf8')
    seedRegistry(workDir, ['.claude/skills/ordering-knowledge/SKILL.md'])
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {stdout} = await runCommand(['domain', 'remove', 'ordering'])

    expect(stdout).to.include('即将删除 ordering')
    expect(stdout).to.include('.claude/skills/ordering-knowledge/SKILL.md')
  })

  it('makes no disk changes when the user declines the confirmation (US1 Acceptance Scenario 3)', async () => {
    mkdirSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS.slice(0, -1)), {recursive: true})
    writeFileSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS), 'claude content', 'utf8')
    seedRegistry(workDir, ['.claude/skills/ordering-knowledge/SKILL.md'])
    const {ask} = withFixedAnswer('n')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS))).to.equal(true)
    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed).to.have.lengthOf(1)
  })

  it('exits 7 and makes no disk changes when the current directory is not a workspace', async () => {
    process.chdir(originalCwd)
    workDir = mkdtempSync(path.join(tmpdir(), 'skillmesh-domain-remove-no-workspace-'))
    process.chdir(workDir)

    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error?.oclif?.exit).to.equal(7)
    expect(callCount()).to.equal(0)
  })

  it('exits 11 and never prompts when the id is not installed', async () => {
    seedEmptyRegistry(workDir)
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error?.oclif?.exit).to.equal(11)
    expect(error?.message).to.equal('未安装：ordering，可以用 `skillmesh domain search` 确认装过哪些 domain')
    expect(callCount()).to.equal(0)
  })

  it('exits 6 and never prompts when the terminal is not interactive', async () => {
    setInteractiveTerminalOverride(() => false)
    seedRegistry(workDir, ['.claude/skills/ordering-knowledge/SKILL.md'])
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error?.oclif?.exit).to.equal(6)
    expect(callCount()).to.equal(0)
  })

  it('exits 1 with a friendly message when registry.json cannot be parsed', async () => {
    writeFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'not valid json', 'utf8')
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error?.oclif?.exit).to.equal(1)
    expect(error?.message).to.equal('安装记录异常，请联系维护者')
    expect(callCount()).to.equal(0)
  })

  it('tolerates an already-missing file and still completes the removal (US2 Acceptance Scenario 1)', async () => {
    mkdirSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS.slice(0, -1)), {recursive: true})
    writeFileSync(path.join(workDir, ...CLAUDE_SKILL_SEGMENTS), 'claude content', 'utf8')
    // The Cursor file is listed in the record but was never actually created.
    seedRegistry(workDir, [
      '.claude/skills/ordering-knowledge/SKILL.md',
      '.cursor/skills/ordering-knowledge/SKILL.md',
    ])
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error, stdout} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error).to.equal(undefined)
    // The confirmation prompt legitimately lists both files up front (it doesn't yet know which
    // are missing) — only the *success* section afterward should omit the never-existed one.
    const successSection = stdout.split('已移除 ordering')[1]
    expect(successSection).to.include('.claude/skills/ordering-knowledge/SKILL.md')
    expect(successSection).to.not.include('.cursor/skills/ordering-knowledge/SKILL.md')

    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed).to.deep.equal([])
  })

  it('deletes the known file but preserves a leaf directory holding other content (US2 Acceptance Scenario 2)', async () => {
    const claudeDir = path.join(workDir, '.claude', 'skills', 'ordering-knowledge')
    mkdirSync(claudeDir, {recursive: true})
    writeFileSync(path.join(claudeDir, 'SKILL.md'), 'claude content', 'utf8')
    writeFileSync(path.join(claudeDir, 'my-note.txt'), 'user content', 'utf8')
    seedRegistry(workDir, ['.claude/skills/ordering-knowledge/SKILL.md'])
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'remove', 'ordering'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(claudeDir, 'SKILL.md'))).to.equal(false)
    expect(existsSync(path.join(claudeDir, 'my-note.txt'))).to.equal(true)
  })
})
