import {Errors} from '@oclif/core'
import {expect} from 'chai'
import nock from 'nock'

import {type Domain, fetchCatalog, findDomainById, matchDomains, runSearch} from '../../../src/lib/domain/catalog.js'

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

describe('domain/catalog', () => {
// Tests must not depend on config.ts's DEFAULT_CATALOG_URL matching CATALOG_HOST — pin the
// env var explicitly so nock's interceptors always match, regardless of the real default.
beforeEach(() => {
  process.env.SKILLMESH_CATALOG_URL = `${CATALOG_HOST}${CATALOG_PATH}`
})

afterEach(() => {
  nock.cleanAll()
  delete process.env.SKILLMESH_CATALOG_URL
  delete process.env.SKILLMESH_CATALOG_TOKEN
})

describe('fetchCatalog', () => {

  it('returns domains sorted by id on success', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {aaa: rawDomain({name: 'A'}), zzz: rawDomain({name: 'Z'})}})

    const domains = await fetchCatalog()
    expect(domains.map((domain) => domain.id)).to.deep.equal(['aaa', 'zzz'])
  })

  it('throws a friendly connection-error CLIError when the request fails', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).replyWithError('boom')

    try {
      await fetchCatalog()
      expect.fail('expected fetchCatalog to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      const cliError = error as Errors.CLIError
      expect(cliError.message).to.equal('无法连接到知识库目录，请检查网络（是否已连接公司内网/VPN）后重试')
      expect(cliError.oclif.exit).to.equal(1)
    }
  })

  it('throws a friendly connection-error CLIError on a non-2xx response', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(404, 'not found')

    try {
      await fetchCatalog()
      expect.fail('expected fetchCatalog to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal(
        '无法连接到知识库目录，请检查网络（是否已连接公司内网/VPN）后重试',
      )
    }
  })

  it('throws a friendly parse-error CLIError on malformed JSON', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, 'not-json{')

    try {
      await fetchCatalog()
      expect.fail('expected fetchCatalog to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal('知识库目录数据异常，无法读取，请联系管理员')
    }
  })

  it('throws a friendly parse-error CLIError when a record is missing required fields', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {broken: {name: '缺字段的记录'}}})

    try {
      await fetchCatalog()
      expect.fail('expected fetchCatalog to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal('知识库目录数据异常，无法读取，请联系管理员')
    }
  })

  it('attaches an Authorization header only when SKILLMESH_CATALOG_TOKEN is set', async () => {
    process.env.SKILLMESH_CATALOG_TOKEN = 'secret-token'
    const scope = nock(CATALOG_HOST, {reqheaders: {authorization: 'Bearer secret-token'}})
      .get(CATALOG_PATH)
      .reply(200, {domains: {}})

    await fetchCatalog()
    expect(scope.isDone()).to.equal(true)
  })
})

describe('findDomainById', () => {
  const domains: Domain[] = [
    {
      description: 'd',
      id: 'growth',
      maintainer: 'm',
      name: 'n',
      repository: 'r',
      tags: [],
      version: '1.0.0',
    },
    {
      description: 'd',
      id: 'ordering',
      maintainer: 'm',
      name: 'n',
      repository: 'r',
      tags: [],
      version: '1.0.0',
    },
  ]

  it('returns the domain whose id matches', () => {
    expect(findDomainById(domains, 'ordering')?.id).to.equal('ordering')
  })

  it('returns undefined when no domain matches', () => {
    expect(findDomainById(domains, 'does-not-exist')).to.equal(undefined)
  })
})

describe('matchDomains', () => {
  const domains: Domain[] = [
    {
      description: '增长团队的实验方法论与埋点规范',
      id: 'growth',
      maintainer: 'growth-team',
      name: '增长团队知识库',
      repository: 'https://example.internal/growth',
      tags: ['growth', 'experiment'],
      version: '1.0.0',
    },
    {
      description: 'CI/CD 与监控告警最佳实践',
      id: 'infra',
      maintainer: 'infra-team',
      name: '基础设施知识库',
      repository: 'https://example.internal/infra',
      tags: ['infra', 'monitoring'],
      version: '1.0.0',
    },
  ]

  it('matches by a substring in name', () => {
    expect(matchDomains(domains, '增长').map((domain) => domain.id)).to.deep.equal(['growth'])
  })

  it('matches by a substring in description', () => {
    expect(matchDomains(domains, '监控').map((domain) => domain.id)).to.deep.equal(['infra'])
  })

  it('matches by a tag', () => {
    expect(matchDomains(domains, 'experiment').map((domain) => domain.id)).to.deep.equal(['growth'])
  })

  it('requires every word to match somewhere (AND), not necessarily the same field', () => {
    expect(matchDomains(domains, '增长 实验').map((domain) => domain.id)).to.deep.equal(['growth'])
    expect(matchDomains(domains, '增长 监控').map((domain) => domain.id)).to.deep.equal([])
  })

  it('is case-insensitive', () => {
    expect(matchDomains(domains, 'GROWTH').map((domain) => domain.id)).to.deep.equal(['growth'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(matchDomains(domains, '火星殖民')).to.deep.equal([])
  })
})

describe('runSearch', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('returns matches when a keyword hits a domain, with total set to the full catalog size', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {
        domains: {
          growth: rawDomain({name: '增长团队知识库', tags: ['growth']}),
          infra: rawDomain({name: '基础设施知识库', tags: ['infra']}),
        },
      })

    const result = await runSearch('增长')
    expect(result.kind).to.equal('matches')
    expect(result.total).to.equal(2)
    expect(result.kind === 'matches' && result.domains).to.have.lengthOf(1)
  })

  it('returns no-match when the keyword hits nothing in a non-empty catalog, with total set to the full catalog size', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {growth: rawDomain({name: '增长团队知识库'})}})

    const result = await runSearch('火星殖民')
    expect(result.kind).to.equal('no-match')
    expect(result.total).to.equal(1)
  })

  it('returns all domains as matches when no keyword is given and the catalog is non-empty', async () => {
    nock(CATALOG_HOST)
      .get(CATALOG_PATH)
      .reply(200, {domains: {a: rawDomain({name: 'A'}), b: rawDomain({name: 'B'})}})

    const result = await runSearch()
    expect(result.kind).to.equal('matches')
    expect(result.kind === 'matches' && result.domains).to.have.lengthOf(2)
    expect(result.total).to.equal(2)
  })

  it('returns empty-catalog when the catalog has no domains, regardless of keyword', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, {domains: {}})

    const result = await runSearch()
    expect(result.kind).to.equal('empty-catalog')
    expect(result.total).to.equal(0)
  })

  it('returns empty-catalog rather than no-match when a keyword is given against an empty catalog', async () => {
    nock(CATALOG_HOST).get(CATALOG_PATH).reply(200, {domains: {}})

    const result = await runSearch('任意关键词')
    expect(result.kind).to.equal('empty-catalog')
  })
})
})
