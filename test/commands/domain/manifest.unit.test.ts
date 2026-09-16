import {Errors} from '@oclif/core'
import {expect} from 'chai'
import nock from 'nock'

import {fetchManifest, parseGitHubRepository, validateManifest} from '../../../src/lib/domain/manifest.js'

const RAW_HOST = 'https://raw.githubusercontent.com'

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

describe('domain/manifest', () => {
afterEach(() => {
  nock.cleanAll()
})

describe('parseGitHubRepository', () => {
  it('parses a plain github.com URL', () => {
    expect(parseGitHubRepository('https://github.com/DTim887/skill-mesh-ordering')).to.deep.equal({
      owner: 'DTim887',
      repo: 'skill-mesh-ordering',
    })
  })

  it('tolerates a trailing slash', () => {
    expect(parseGitHubRepository('https://github.com/DTim887/skill-mesh-ordering/')).to.deep.equal({
      owner: 'DTim887',
      repo: 'skill-mesh-ordering',
    })
  })

  it('tolerates a .git suffix', () => {
    expect(parseGitHubRepository('https://github.com/DTim887/skill-mesh-ordering.git')).to.deep.equal({
      owner: 'DTim887',
      repo: 'skill-mesh-ordering',
    })
  })

  it('returns undefined for a non-GitHub URL', () => {
    expect(parseGitHubRepository('https://internal-git-host.example/domain-growth-kb')).to.equal(undefined)
  })
})

describe('fetchManifest', () => {
  it('fetches and parses a valid manifest', async () => {
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json').reply(200, rawManifest())

    const manifest = await fetchManifest('https://github.com/DTim887/skill-mesh-ordering', '1.0.0')
    expect(manifest.id).to.equal('ordering')
    expect(manifest.knowledgeSource).to.have.lengthOf(1)
    expect(manifest.usageHint).to.equal('当用户询问下单/订单相关的业务问题时使用')
  })

  it('throws a friendly "version not found" CLIError on a 404', async () => {
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v9.9.9/manifest.json').reply(404, 'not found')

    try {
      await fetchManifest('https://github.com/DTim887/skill-mesh-ordering', '9.9.9')
      expect.fail('expected fetchManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal('未找到 v9.9.9 对应的版本，请确认版本号或联系该 Domain 的维护者')
    }
  })

  it('throws a friendly connection-error CLIError on a network failure', async () => {
    nock(RAW_HOST).get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json').replyWithError('boom')

    try {
      await fetchManifest('https://github.com/DTim887/skill-mesh-ordering', '1.0.0')
      expect.fail('expected fetchManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal(
        '无法连接到该 Domain 的知识库仓库，请检查网络（是否已连接公司内网/VPN）后重试',
      )
    }
  })

  it('throws the same connection-error CLIError when the repository URL is not GitHub-hosted', async () => {
    try {
      await fetchManifest('https://internal-git-host.example/domain-growth-kb', '1.0.0')
      expect.fail('expected fetchManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal(
        '无法连接到该 Domain 的知识库仓库，请检查网络（是否已连接公司内网/VPN）后重试',
      )
    }
  })

  it('throws a friendly parse-error CLIError when required manifest fields are missing', async () => {
    nock(RAW_HOST)
      .get('/DTim887/skill-mesh-ordering/v1.0.0/manifest.json')
      .reply(200, {id: 'ordering'})

    try {
      await fetchManifest('https://github.com/DTim887/skill-mesh-ordering', '1.0.0')
      expect.fail('expected fetchManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal('该 Domain 的知识库内容格式异常，无法读取，请联系维护者')
    }
  })
})

describe('validateManifest', () => {
  it('passes when id and version both match', () => {
    const manifest = {
      description: 'd',
      id: 'ordering',
      knowledgeSource: [],
      maintainer: 'm',
      name: 'n',
      usageHint: 'u',
      version: '1.0.0',
    }
    expect(() => validateManifest(manifest, 'ordering', '1.0.0')).to.not.throw()
  })

  it('throws a friendly mismatch CLIError when the id does not match', () => {
    const manifest = {
      description: 'd',
      id: 'wrong-id',
      knowledgeSource: [],
      maintainer: 'm',
      name: 'n',
      usageHint: 'u',
      version: '1.0.0',
    }

    try {
      validateManifest(manifest, 'ordering', '1.0.0')
      expect.fail('expected validateManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).message).to.equal('这个 Domain 的内容和登记信息对不上，请联系维护者')
      expect((error as Errors.CLIError).oclif.exit).to.equal(9)
    }
  })

  it('throws a friendly mismatch CLIError when the version does not match', () => {
    const manifest = {
      description: 'd',
      id: 'ordering',
      knowledgeSource: [],
      maintainer: 'm',
      name: 'n',
      usageHint: 'u',
      version: '0.9.0',
    }

    try {
      validateManifest(manifest, 'ordering', '1.0.0')
      expect.fail('expected validateManifest to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Errors.CLIError)
      expect((error as Errors.CLIError).oclif.exit).to.equal(9)
    }
  })
})
})
