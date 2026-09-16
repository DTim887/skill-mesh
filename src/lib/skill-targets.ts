export type SkillTarget = {
  agentName: string
  skillsDir: string
  tool: string
}

// The `agentName` value feeds `{{AGENT_NAME}}` in the meta-skill template (see
// lib/workspace/template.ts); keeping it alongside `tool`/`skillsDir` in one place means adding
// a third tool later only touches this list, not a second mapping somewhere else.
export const SKILL_TARGETS: SkillTarget[] = [
  {agentName: 'Claude Code', skillsDir: '.claude/skills', tool: 'claude'},
  {agentName: 'Cursor', skillsDir: '.cursor/skills', tool: 'cursor'},
]
