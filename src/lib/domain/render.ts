import type {DomainManifest, KnowledgeSourceEntry} from './manifest.js'

// 本期 knowledge_source 只会出现 confluence 这一种取值（spec.md Assumptions）；未识别的类型直接
// 展示原始 type 字符串作为兜底，不拒绝渲染。
const TYPE_LABELS: Record<string, string> = {
  confluence: 'Confluence',
}

function renderKnowledgeSourceEntry(entry: KnowledgeSourceEntry): string {
  const label = TYPE_LABELS[entry.type] ?? entry.type
  return `- **${label}**：${entry.url}\n  ${entry.summary}`
}

export function renderSkillMarkdown(manifest: DomainManifest): string {
  const knowledgeSourceLines = manifest.knowledgeSource.map((entry) => renderKnowledgeSourceEntry(entry)).join('\n')

  return `---
name: ${manifest.id}-knowledge
description: ${manifest.description}。${manifest.usageHint}
---

# ${manifest.name}

${manifest.description}

**维护者**：${manifest.maintainer}
**版本**：${manifest.version}

## 知识来源

${knowledgeSourceLines}
`
}
