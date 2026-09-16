import {expect} from 'chai'
import nock from 'nock'

// Not TypeScript, not compiled — this is the exact file `init` copies into a user's workspace, so
// tests import it directly by relative path (Node resolves plain `.mjs` ESM imports natively,
// independent of the project's own ts-node/tsc pipeline).
import {buildApiUrl, extractPageId, main, stripHtml} from '../../resources/scripts/fetch-confluence.mjs'

async function runMain(url: string) {
  process.exitCode = undefined
  const logs: string[] = []
  const errors: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (message: string) => logs.push(message)
  console.error = (message: string) => errors.push(message)

  try {
    await main(url)
    return {errors, exitCode: process.exitCode, logs}
  } finally {
    console.log = originalLog
    console.error = originalError
    process.exitCode = undefined
  }
}

describe('fetch-confluence.mjs', () => {
describe('pure functions', () => {
  describe('extractPageId', () => {
    it('extracts the numeric page id from a Confluence Cloud URL', () => {
      expect(extractPageId('https://foo.atlassian.net/wiki/spaces/SPACE/pages/445776273/Title')).to.equal(
        '445776273',
      )
    })

    it('extracts the id when the page path has no trailing title segment', () => {
      expect(extractPageId('https://foo.atlassian.net/wiki/spaces/SPACE/pages/445776273')).to.equal('445776273')
    })

    it('returns undefined for a URL with no /pages/<id> segment', () => {
      expect(extractPageId('https://example.com/not-a-confluence-page')).to.equal(undefined)
    })
  })

  describe('buildApiUrl', () => {
    it('builds the content API URL from the page URL’s own origin', () => {
      expect(buildApiUrl('https://foo.atlassian.net/wiki/spaces/SPACE/pages/123/Title', '123')).to.equal(
        'https://foo.atlassian.net/wiki/rest/api/content/123?expand=body.view',
      )
    })

    it('uses whichever site the URL points at, not a fixed configured host', () => {
      expect(buildApiUrl('https://bar.atlassian.net/wiki/spaces/S/pages/9/T', '9')).to.equal(
        'https://bar.atlassian.net/wiki/rest/api/content/9?expand=body.view',
      )
    })
  })

  describe('stripHtml', () => {
    it('turns block-level tags into line breaks and strips the rest', () => {
      const html = '<p>Hello</p><ul><li>Item one</li><li>Item two</li></ul><p>Done.</p>'
      expect(stripHtml(html)).to.equal('Hello\nItem one\nItem two\nDone.')
    })

    it('decodes common HTML entities', () => {
      expect(stripHtml('<p>Fish &amp; chips &lt;tasty&gt; &quot;quoted&quot;</p>')).to.equal(
        'Fish & chips <tasty> "quoted"',
      )
    })

    it('converts <br> into a line break', () => {
      expect(stripHtml('Line one<br>Line two')).to.equal('Line one\nLine two')
    })

    it('collapses excessive blank lines', () => {
      expect(stripHtml('<p>A</p><p></p><p></p><p>B</p>')).to.equal('A\n\nB')
    })
  })
})

describe('main', () => {
  const PAGE_URL = 'https://foo.atlassian.net/wiki/spaces/SPACE/pages/123/Title'

  beforeEach(() => {
    process.env.ATLASSIAN_EMAIL = 'me@example.com'
    process.env.ATLASSIAN_API_TOKEN = 'secret-token'
  })

  afterEach(() => {
    delete process.env.ATLASSIAN_EMAIL
    delete process.env.ATLASSIAN_API_TOKEN
    nock.cleanAll()
  })

  it('prints the cleaned page text on success (US3 Acceptance Scenario 1)', async () => {
    const scope = nock('https://foo.atlassian.net', {
      reqheaders: {authorization: `Basic ${Buffer.from('me@example.com:secret-token').toString('base64')}`},
    })
      .get('/wiki/rest/api/content/123')
      .query({expand: 'body.view'})
      .reply(200, {body: {view: {value: '<p>Hello there</p>'}}})

    const {errors, exitCode, logs} = await runMain(PAGE_URL)

    expect(scope.isDone()).to.equal(true)
    expect(exitCode).to.equal(undefined)
    expect(logs).to.deep.equal(['Hello there'])
    expect(errors).to.deep.equal([])
  })

  it('prints configuration guidance and exits non-zero when credentials are missing (US3 Acceptance Scenario 2)', async () => {
    delete process.env.ATLASSIAN_API_TOKEN
    const scope = nock('https://foo.atlassian.net').get(/.*/).reply(200, {})

    const {errors, exitCode} = await runMain(PAGE_URL)

    expect(exitCode).to.equal(1)
    expect(errors.join('\n')).to.include('ATLASSIAN_API_TOKEN')
    expect(scope.isDone()).to.equal(false)
  })

  it('reports an unrecognized URL without making a network request (US3 Acceptance Scenario 3)', async () => {
    const scope = nock('https://example.com').get(/.*/).reply(200, {})

    const {errors, exitCode} = await runMain('https://example.com/not-a-confluence-page')

    expect(exitCode).to.equal(1)
    expect(errors).to.deep.equal(['无法识别的 Confluence 页面地址'])
    expect(scope.isDone()).to.equal(false)
  })

  it('reports an authentication failure on HTTP 401 (US3 Acceptance Scenario 4)', async () => {
    nock('https://foo.atlassian.net').get('/wiki/rest/api/content/123').query(true).reply(401, 'unauthorized')

    const {errors, exitCode} = await runMain(PAGE_URL)

    expect(exitCode).to.equal(1)
    expect(errors).to.deep.equal(['认证失败，请检查 token/邮箱是否正确'])
  })

  it('reports a not-found failure on HTTP 404 (US3 Acceptance Scenario 5)', async () => {
    nock('https://foo.atlassian.net').get('/wiki/rest/api/content/123').query(true).reply(404, 'not found')

    const {errors, exitCode} = await runMain(PAGE_URL)

    expect(exitCode).to.equal(1)
    expect(errors).to.deep.equal(['页面不存在或没有访问权限'])
  })

  it('reports a friendly network error without a raw stack trace on connection failure', async () => {
    nock('https://foo.atlassian.net').get('/wiki/rest/api/content/123').query(true).replyWithError('boom')

    const {errors, exitCode} = await runMain(PAGE_URL)

    expect(exitCode).to.equal(1)
    expect(errors).to.deep.equal(['网络连接失败，请检查是否已连接公司内网/VPN 后重试'])
  })
})
})
