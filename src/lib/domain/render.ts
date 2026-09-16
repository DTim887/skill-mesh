import type {DomainManifest, KnowledgeSourceEntry} from './manifest.js'

// 本期 knowledge_source 只会出现 confluence 这一种取值（spec.md Assumptions）；未识别的类型直接
// 展示原始 type 字符串作为兜底，不拒绝渲染。
const TYPE_LABELS: Record<string, string> = {
  confluence: 'Confluence',
}

// Each entry gets its own self-contained "what this source is + how to actually fetch it" block
// (not just a link), per spec FR-011 — a manifest with multiple sources repeats this whole
// structure once per entry rather than sharing one fetch instruction across all of them.
function renderKnowledgeSourceEntry(entry: KnowledgeSourceEntry): string {
  const label = TYPE_LABELS[entry.type] ?? entry.type
  return `- **${label}**：${entry.url}
  ${entry.summary}

需要查阅上述知识来源的具体内容时，运行：

\`\`\`bash
node .skillmesh/scripts/fetch-confluence.mjs "${entry.url}"
\`\`\`

首次使用前需要配置好 \`ATLASSIAN_API_TOKEN\`（在 Atlassian 账号安全设置里创建 API token）和
\`ATLASSIAN_EMAIL\`（Atlassian 账号邮箱）这两个环境变量；如果没配置，脚本会打印具体的配置引导。`
}

export function renderSkillMarkdown(manifest: DomainManifest): string {
  const knowledgeSourceLines = manifest.knowledgeSource.map((entry) => renderKnowledgeSourceEntry(entry)).join('\n\n')

  return `---
name: ${manifest.id}-knowledge
description: ${manifest.description}。${manifest.usageHint}
---

# ${manifest.name}

**维护者**：${manifest.maintainer}
**版本**：${manifest.version}

## 知识来源

${knowledgeSourceLines}
`
}
