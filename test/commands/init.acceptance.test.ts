import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {
  resetAsk,
  resetInteractiveTerminalOverride,
  setAsk,
  setInteractiveTerminalOverride,
} from '../../src/lib/workspace/confirm.js'

function withFixedAnswer(answer: string) {
  let calls = 0
  const ask = async () => {
    calls += 1
    return answer
  }

  return {ask, callCount: () => calls}
}

function withAnswerQueue(answers: string[]) {
  const remaining = [...answers]
  let calls = 0
  const ask = async () => {
    calls += 1
    return remaining.shift() ?? ''
  }

  return {ask, callCount: () => calls}
}

describe('init', () => {
  let originalCwd: string
  let workDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    workDir = mkdtempSync(path.join(tmpdir(), 'skillmesh-init-acceptance-'))
    process.chdir(workDir)
    setInteractiveTerminalOverride(() => true)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(workDir, {force: true, recursive: true})
    resetAsk()
    resetInteractiveTerminalOverride()
  })

  it('creates the workspace in the current directory when the user confirms (US1)', async () => {
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['init'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, '.skillmesh', 'registry.json'))).to.equal(true)
    expect(existsSync(path.join(workDir, '.skillmesh', 'scripts', 'fetch-confluence.mjs'))).to.equal(true)
    expect(existsSync(path.join(workDir, '.claude', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)
    expect(existsSync(path.join(workDir, '.cursor', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)

    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry).to.deep.equal({installed: [], 'schema_version': '1.0'})

    const claudeSkill = readFileSync(path.join(workDir, '.claude', 'skills', 'skillmesh', 'SKILL.md'), 'utf8')
    const cursorSkill = readFileSync(path.join(workDir, '.cursor', 'skills', 'skillmesh', 'SKILL.md'), 'utf8')
    expect(claudeSkill).to.include('Claude Code')
    expect(cursorSkill).to.include('Cursor')
  })

  it('succeeds and leaves pre-existing unrelated .cursor/ content untouched (US2)', async () => {
    mkdirSync(path.join(workDir, '.cursor', 'rules'), {recursive: true})
    writeFileSync(path.join(workDir, '.cursor', 'rules', 'my-rule.mdc'), 'existing content', 'utf8')

    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['init'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, '.cursor', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)
    expect(readFileSync(path.join(workDir, '.cursor', 'rules', 'my-rule.mdc'), 'utf8')).to.equal(
      'existing content',
    )
  })

  it('succeeds and leaves pre-existing unrelated .claude/ content untouched (symmetric case, US2)', async () => {
    mkdirSync(path.join(workDir, '.claude', 'commands'), {recursive: true})
    writeFileSync(path.join(workDir, '.claude', 'commands', 'my-command.md'), 'existing content', 'utf8')

    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['init'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, '.claude', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(true)
    expect(readFileSync(path.join(workDir, '.claude', 'commands', 'my-command.md'), 'utf8')).to.equal(
      'existing content',
    )
  })

  it('makes no disk changes and exits 0 when the user declines (US1)', async () => {
    const {ask} = withFixedAnswer('n')
    setAsk(ask)

    const {error} = await runCommand(['init'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, '.skillmesh'))).to.equal(false)
    expect(existsSync(path.join(workDir, '.claude'))).to.equal(false)
  })

  it('exits 6 and makes no disk changes when stdout/stdin is not an interactive terminal (FR-012)', async () => {
    setInteractiveTerminalOverride(() => false)
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['init'])

    expect(error).to.not.equal(undefined)
    expect(error?.oclif?.exit).to.equal(6)
    expect(callCount()).to.equal(0)
    expect(existsSync(path.join(workDir, '.skillmesh'))).to.equal(false)
  })

  it('exits 5 and never prompts when the target is already an initialized workspace (US3)', async () => {
    mkdirSync(path.join(workDir, '.skillmesh'))
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const before = existsSync(path.join(workDir, '.claude'))
    const {error} = await runCommand(['init'])

    expect(error).to.not.equal(undefined)
    expect(error?.oclif?.exit).to.equal(5)
    expect(callCount()).to.equal(0)
    expect(existsSync(path.join(workDir, '.claude'))).to.equal(before)
  })

  it('creates the workspace under a new NAME subdirectory when it does not yet exist (US2)', async () => {
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['init', 'myworkspace'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, 'myworkspace', '.skillmesh', 'registry.json'))).to.equal(true)
    expect(existsSync(path.join(workDir, 'myworkspace', '.claude', 'skills', 'skillmesh', 'SKILL.md'))).to.equal(
      true,
    )
  })

  it('asks an extra confirmation before reusing an existing NAME directory, then proceeds on yes (US2)', async () => {
    mkdirSync(path.join(workDir, 'already-exists'))
    const {ask, callCount} = withAnswerQueue(['y', 'y'])
    setAsk(ask)

    const {error} = await runCommand(['init', 'already-exists'])

    expect(error).to.equal(undefined)
    expect(callCount()).to.equal(2)
    expect(existsSync(path.join(workDir, 'already-exists', '.skillmesh', 'registry.json'))).to.equal(true)
  })

  it('makes no disk changes when the user declines the "directory already exists" confirmation (US2)', async () => {
    mkdirSync(path.join(workDir, 'already-exists'))
    const {ask, callCount} = withAnswerQueue(['n'])
    setAsk(ask)

    const {error} = await runCommand(['init', 'already-exists'])

    expect(error).to.equal(undefined)
    expect(callCount()).to.equal(1)
    expect(existsSync(path.join(workDir, 'already-exists', '.skillmesh'))).to.equal(false)
  })

  it('rejects an invalid NAME with exit 2 and never prompts (US2)', async () => {
    for (const badName of ['../escape', 'a/b', '..']) {
      const {ask, callCount} = withFixedAnswer('y')
      setAsk(ask)

      // eslint-disable-next-line no-await-in-loop
      const {error} = await runCommand(['init', badName])

      expect(error, `expected "${badName}" to be rejected`).to.not.equal(undefined)
      expect(error?.oclif?.exit, `expected "${badName}" to exit 2`).to.equal(2)
      expect(callCount(), `expected "${badName}" to never prompt`).to.equal(0)
    }
  })
})
