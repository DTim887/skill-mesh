import {expect} from 'chai'

import type {DomainManifest} from '../../../src/lib/domain/manifest.js'

import {renderSkillMarkdown} from '../../../src/lib/domain/render.js'

describe('domain/render renderSkillMarkdown', () => {
  it('renders frontmatter and body for a single confluence knowledge source', () => {
    const manifest: DomainManifest = {
      description: 'Commerce Foundation Group Ordering 知识库',
      id: 'ordering',
      knowledgeSource: [
        {
          summary: '供 AI 判断何时该查这个知识库',
          type: 'confluence',
          url: 'https://internal-confluence.example/ordering',
        },
      ],
      maintainer: 'Unicorn',
      name: 'CommerceFoundation_Ordering',
      usageHint: '当用户询问下单/订单相关的业务问题时使用',
      version: '1.0.0',
    }

    const output = renderSkillMarkdown(manifest)

    expect(output).to.include('name: ordering-knowledge')
    expect(output).to.include(
      'description: Commerce Foundation Group Ordering 知识库。当用户询问下单/订单相关的业务问题时使用',
    )
    expect(output).to.include('# CommerceFoundation_Ordering')
    expect(output).to.include('**维护者**：Unicorn')
    expect(output).to.include('**版本**：1.0.0')
    expect(output).to.include('- **Confluence**：https://internal-confluence.example/ordering')
    expect(output).to.include('供 AI 判断何时该查这个知识库')
  })

  it('renders one list entry per knowledge source item, in order', () => {
    const manifest: DomainManifest = {
      description: 'd',
      id: 'multi',
      knowledgeSource: [
        {summary: 's1', type: 'confluence', url: 'https://example.com/1'},
        {summary: 's2', type: 'confluence', url: 'https://example.com/2'},
      ],
      maintainer: 'm',
      name: 'n',
      usageHint: 'u',
      version: '1.0.0',
    }

    const output = renderSkillMarkdown(manifest)
    const firstIndex = output.indexOf('https://example.com/1')
    const secondIndex = output.indexOf('https://example.com/2')

    expect(firstIndex).to.be.greaterThan(-1)
    expect(secondIndex).to.be.greaterThan(firstIndex)
  })

  it('falls back to the raw type string for an unrecognized knowledge source type', () => {
    const manifest: DomainManifest = {
      description: 'd',
      id: 'x',
      knowledgeSource: [{summary: 's', type: 'notion', url: 'https://example.com'}],
      maintainer: 'm',
      name: 'n',
      usageHint: 'u',
      version: '1.0.0',
    }

    expect(renderSkillMarkdown(manifest)).to.include('- **notion**：https://example.com')
  })
})
