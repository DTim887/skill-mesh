import {Args, Command} from '@oclif/core'

import {type Domain, runSearch} from '../../lib/domain/catalog.js'

const BANNER_RULE = '============体验神奇，科技无限============'

function formatDomain(domain: Domain): string {
  return [
    `名称    ${domain.name}`,
    `描述    ${domain.description}`,
    `标签    ${domain.tags.join(', ')}`,
    `版本    ${domain.version}`,
    `团队    ${domain.maintainer}`,
  ].join('\n')
}

export default class DomainSearch extends Command {
  static override args = {
    keyword: Args.string({
      description: '搜索关键词，可包含多个词（用空格分隔）；不提供时列出全部已发布的知识库',
      required: false,
    }),
  }
  static override description = `在公司各部门/业务领域发布的知识库中搜索。

不带关键词时列出全部当前已发布、可安装的知识库。`
  static override examples = [
    {
      command: '<%= config.bin %> <%= command.id %> 增长',
      description: '搜索名称、描述或标签中包含"增长"的知识库',
    },
    {
      command: '<%= config.bin %> <%= command.id %>',
      description: '列出全部已发布的知识库',
    },
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(DomainSearch)

    const result = await runSearch(args.keyword)

    if (process.stdout.isTTY) {
      this.log(BANNER_RULE)
      this.log(`欢迎访问领域知识库，目前注册的知识库有 ${result.total} 个`)
      this.log('')
    }

    switch (result.kind) {
      case 'empty-catalog': {
        this.log('目前还没有知识库上架')
        break
      }

      case 'matches': {
        this.log(result.domains.map((domain) => formatDomain(domain)).join('\n\n'))
        break
      }

      case 'no-match': {
        this.log('未找到匹配的 Domain 知识库')
        break
      }
    }
  }
}
