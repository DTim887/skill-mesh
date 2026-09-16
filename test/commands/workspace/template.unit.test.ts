import {expect} from 'chai'

import {renderMetaSkillTemplate} from '../../../src/lib/workspace/template.js'

describe('workspace/template renderMetaSkillTemplate', () => {
  it('replaces every occurrence of the placeholder with the given agent name', () => {
    const template = '帮助你（{{AGENT_NAME}}）判断该怎么做。你是 {{AGENT_NAME}}。'
    expect(renderMetaSkillTemplate(template, 'Claude Code')).to.equal(
      '帮助你（Claude Code）判断该怎么做。你是 Claude Code。',
    )
  })

  it('renders a different value for a different agent name from the same template', () => {
    const template = '帮助你（{{AGENT_NAME}}）判断该怎么做。'
    expect(renderMetaSkillTemplate(template, 'Cursor')).to.equal('帮助你（Cursor）判断该怎么做。')
  })

  it('returns the template unchanged when it contains no placeholder', () => {
    const template = '这段内容没有占位符。'
    expect(renderMetaSkillTemplate(template, 'Claude Code')).to.equal(template)
  })
})
