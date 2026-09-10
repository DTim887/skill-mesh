import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const CATALOG_HOST = 'https://internal-git-host.example'
const CATALOG_PATH = '/raw/org/skill-mesh/main/registry/catalog.json'

function rawDomain(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    description: 'd',
    maintainer: 'm',
    name: 'n',
    repository: 'r',
    tags: ['t'],
    version: '1.0.0',
    ...overrides,
  }
}

describe('domain search', () => {
  // Tests must not depend on config.ts's DEFAULT_CATALOG_URL matching CATALOG_HOST — pin the
  // env var explicitly so nock's interceptors always match, regardless of the real default.
  beforeEach(() => {
    process.env.SKILLMESH_CATALOG_URL = `${CATALOG_HOST}${CATALOG_PATH}`
  })

  afterEach(() => {
    nock.cleanAll()
    delete process.env.SKILLMESH_CATALOG_URL
  })

  it('prints name, description, tags, version and team when the keyword matches a domain (US1)', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {
        domains: {
          growth: rawDomain({
            description: '增长团队的实验方法论与埋点规范',
            maintainer: 'growth-team',
            name: '增长团队知识库',
            tags: ['growth', 'experiment'],
            version: '2.1.0',
          }),
        },
      })

    const {error, stdout} = await runCommand(['domain', 'search', '增长'])

    expect(error).to.equal(undefined)
    expect(stdout).to.contain('增长团队知识库')
    expect(stdout).to.contain('增长团队的实验方法论与埋点规范')
    expect(stdout).to.contain('growth, experiment')
    expect(stdout).to.contain('2.1.0')
    expect(stdout).to.contain('growth-team')
  })

  it('shows the welcome banner with the total catalog count only on an interactive TTY', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {
        domains: {
          a: rawDomain({name: 'Domain A'}),
          b: rawDomain({name: 'Domain B'}),
        },
      })

    const original = process.stdout.isTTY
    process.stdout.isTTY = true
    let stdout: string
    try {
      ;({stdout} = await runCommand(['domain', 'search']))
    } finally {
      process.stdout.isTTY = original
    }

    expect(stdout).to.contain('============体验神奇，科技无限============')
    expect(stdout).to.contain('欢迎访问领域知识库，目前注册的知识库有 2 个')
  })

  it('omits the welcome banner when stdout is not an interactive TTY', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {a: rawDomain({name: 'Domain A'})}})

    const {stdout} = await runCommand(['domain', 'search'])

    expect(stdout).to.not.contain('体验神奇')
    expect(stdout).to.not.contain('欢迎访问领域知识库')
  })

  it('lists every domain when no keyword is given and the catalog is non-empty (US2)', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {
        domains: {
          a: rawDomain({description: 'desc-a', name: 'Domain A'}),
          b: rawDomain({description: 'desc-b', name: 'Domain B'}),
        },
      })

    const {error, stdout} = await runCommand(['domain', 'search'])

    expect(error).to.equal(undefined)
    expect(stdout).to.contain('Domain A')
    expect(stdout).to.contain('Domain B')
  })

  it('shows the empty-catalog message when no keyword is given and the catalog is empty (US2)', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, {domains: {}})

    const {error, stdout} = await runCommand(['domain', 'search'])

    expect(error).to.equal(undefined)
    expect(stdout).to.contain('目前还没有知识库上架')
  })

  it('shows the no-match message when the keyword matches nothing in a non-empty catalog (US3)', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {growth: rawDomain({name: '增长团队知识库'})}})

    const {error, stdout} = await runCommand(['domain', 'search', '火星殖民'])

    expect(error).to.equal(undefined)
    expect(stdout).to.contain('未找到匹配的 Domain 知识库')
  })

  it('shows a friendly connection message and exits non-zero on network failure', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).replyWithError('boom')

    const {error} = await runCommand(['domain', 'search'])

    // The oclif error-rendering pipeline (bin/run.js -> handle()) is what prints a thrown
    // CLIError to the user; runCommand() only captures it, it does not render it. So the
    // user-facing text is asserted on `error.message` here, not on captured stdout/stderr.
    expect(error).to.not.equal(undefined)
    expect(error?.oclif?.exit).to.equal(1)
    expect(error?.message).to.equal('无法连接到知识库目录，请检查网络（是否已连接公司内网/VPN）后重试')
    expect(error?.message).to.not.match(/\b\d{3}\b/) // no raw HTTP status codes leaking through
  })
})
