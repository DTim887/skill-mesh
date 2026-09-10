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

  it('prints name and description when the keyword matches a domain (US1)', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {
        domains: {
          growth: rawDomain({
            description: '增长团队的实验方法论与埋点规范',
            name: '增长团队知识库',
            tags: ['growth', 'experiment'],
          }),
        },
      })

    const {error, stdout} = await runCommand(['domain', 'search', '增长'])

    expect(error).to.equal(undefined)
    expect(stdout).to.contain('增长团队知识库')
    expect(stdout).to.contain('增长团队的实验方法论与埋点规范')
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
