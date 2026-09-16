import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {resetAsk, resetInteractiveTerminalOverride, setAsk, setInteractiveTerminalOverride} from '../../../src/lib/workspace/confirm.js'

const CATALOG_HOST = 'https://internal-git-host.example'
const CATALOG_PATH = '/raw/org/skill-mesh/main/registry/catalog.json'
const RAW_HOST = 'https://raw.githubusercontent.com'
const REPOSITORY = 'https://github.com/DTim887/skill-mesh-ordering'

function rawCatalog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    domains: {
      ordering: {
        description: 'Commerce Foundation Group Ordering 知识库',
        maintainer: 'Unicorn',
        name: 'CommerceFoundation_Ordering',
        repository: REPOSITORY,
        tags: ['commerce foundation', 'ordering'],
        version: '1.0.0',
        ...overrides,
      },
    },
  }
}

function rawManifest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    description: 'Commerce Foundation Group Ordering 知识库',
    id: 'ordering',
    'knowledge_source': [
      {
        summary: '供 AI 判断何时该查这个知识库',
        type: 'confluence',
        url: 'https://internal-confluence.example/ordering',
      },
    ],
    maintainer: 'Unicorn',
    name: 'CommerceFoundation_Ordering',
    'usage_hint': '当用户询问下单/订单相关的业务问题时使用',
    version: '1.0.0',
    ...overrides,
  }
}

function withFixedAnswer(answer: string) {
  let calls = 0
  const ask = async () => {
    calls += 1
    return answer
  }

  return {ask, callCount: () => calls}
}

const SKILL_PATH_SEGMENTS = ['.claude', 'skills', 'ordering-knowledge', 'SKILL.md']

describe('domain add', () => {
  let originalCwd: string
  let workDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    workDir = mkdtempSync(path.join(tmpdir(), 'skillmesh-domain-add-acceptance-'))
    process.chdir(workDir)
    mkdirSync(path.join(workDir, '.skillmesh'))
    writeFileSync(
      path.join(workDir, '.skillmesh', 'registry.json'),
      `${JSON.stringify({installed: [], 'schema_version': '1.0'}, null, 2)}\n`,
      'utf8',
    )
    setInteractiveTerminalOverride(() => true)
    process.env.SKILLMESH_CATALOG_URL = `${CATALOG_HOST}${CATALOG_PATH}`
  })

  afterEach(() => {
    process.chdir(originalCwd)
    resetAsk()
    resetInteractiveTerminalOverride()
    delete process.env.SKILLMESH_CATALOG_URL
    nock.cleanAll()
  })

  it('installs a domain for the first time when the user confirms (US1)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json').reply(200, rawManifest())
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error, stdout} = await runCommand(['domain', 'add', 'ordering'])

    expect(error).to.equal(undefined)
    const skillPath = path.join(workDir, ...SKILL_PATH_SEGMENTS)
    expect(existsSync(skillPath)).to.equal(true)
    const skillContent = readFileSync(skillPath, 'utf8')
    expect(skillContent).to.include('# CommerceFoundation_Ordering')
    expect(skillContent).to.include('**版本**：1.0.0')

    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed).to.have.lengthOf(1)
    expect(registry.installed[0]).to.deep.include({
      id: 'ordering',
      repository: REPOSITORY,
      type: 'domain',
      version: '1.0.0',
    })
    expect(registry.installed[0].files).to.deep.equal(['.claude/skills/ordering-knowledge/SKILL.md'])
    expect(stdout).to.include('安装完成')
  })

  it('makes no disk changes when the user declines the confirmation (US1)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json').reply(200, rawManifest())
    const {ask} = withFixedAnswer('n')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering'])

    expect(error).to.equal(undefined)
    expect(existsSync(path.join(workDir, ...SKILL_PATH_SEGMENTS))).to.equal(false)
    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed).to.deep.equal([])
  })

  it('exits 7 and makes no network requests when the current directory is not a workspace (US1)', async () => {
    // Remove the workspace marker created in beforeEach.
    process.chdir(originalCwd)
    workDir = mkdtempSync(path.join(tmpdir(), 'skillmesh-domain-add-no-workspace-'))
    process.chdir(workDir)

    const catalogScope = nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering'])

    expect(error?.oclif?.exit).to.equal(7)
    expect(callCount()).to.equal(0)
    expect(catalogScope.isDone()).to.equal(false)
  })

  it('exits 8 when the id does not exist in the catalog (US1)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'does-not-exist'])

    expect(error?.oclif?.exit).to.equal(8)
    expect(callCount()).to.equal(0)
    expect(existsSync(path.join(workDir, '.claude'))).to.equal(false)
  })

  it('exits 6 and makes no network requests when the terminal is not interactive (US1)', async () => {
    setInteractiveTerminalOverride(() => false)
    const catalogScope = nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering'])

    expect(error?.oclif?.exit).to.equal(6)
    expect(callCount()).to.equal(0)
    expect(catalogScope.isDone()).to.equal(false)
  })

  it('exits 10 and makes no changes when the domain is already installed (US2)', async () => {
    const existingRegistry = {
      installed: [
        {
          files: ['.claude/skills/ordering-knowledge/SKILL.md'],
          id: 'ordering',
          'installed_at': '2026-09-01T00:00:00Z',
          repository: REPOSITORY,
          type: 'domain',
          version: '1.0.0',
        },
      ],
      'schema_version': '1.0',
    }
    writeFileSync(path.join(workDir, '.skillmesh', 'registry.json'), `${JSON.stringify(existingRegistry, null, 2)}\n`, 'utf8')

    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    const manifestScope = nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json').reply(200, rawManifest())
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering'])

    expect(error?.oclif?.exit).to.equal(10)
    expect(callCount()).to.equal(0)
    expect(manifestScope.isDone()).to.equal(true)

    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry).to.deep.equal(existingRegistry)
  })

  it('installs the explicitly specified version instead of the catalog default (US3)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    nock(RAW_HOST)
      .get('/DTim887/skill-mesh-ordering/v0.9.0/manifest.json')
      .reply(200, rawManifest({version: '0.9.0'}))
    const {ask} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering', '--tag', '0.9.0'])

    expect(error).to.equal(undefined)
    const registry = JSON.parse(readFileSync(path.join(workDir, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry.installed[0].version).to.equal('0.9.0')
  })

  it('exits 1 with a friendly message when the specified --tag does not exist (US3)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v9.9.9/manifest.json').reply(404, 'not found')
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering', '--tag', '9.9.9'])

    expect(error?.oclif?.exit).to.equal(1)
    expect(error?.message).to.include('未找到 v9.9.9 对应的版本')
    expect(callCount()).to.equal(0)
    expect(existsSync(path.join(workDir, '.claude'))).to.equal(false)
  })

  it('exits 9 with a friendly message when the fetched manifest id does not match (Edge Case)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, rawCatalog())
    nock(RAW_HOST)
      .get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json')
      .reply(200, rawManifest({id: 'wrong-id'}))
    const {ask, callCount} = withFixedAnswer('y')
    setAsk(ask)

    const {error} = await runCommand(['domain', 'add', 'ordering'])

    expect(error?.oclif?.exit).to.equal(9)
    expect(error?.message).to.equal('这个 Domain 的内容和登记信息对不上，请联系维护者')
    expect(callCount()).to.equal(0)
    expect(existsSync(path.join(workDir, '.claude'))).to.equal(false)
  })
})
