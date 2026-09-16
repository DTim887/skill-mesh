// The meta-skill template has exactly one substitution point (the "who am I" sentence), so a
// plain substring replace is all that's needed — pulling in a templating engine for this would be
// solving a problem the project doesn't have.
export function renderMetaSkillTemplate(template: string, agentName: string): string {
  return template.replaceAll('{{AGENT_NAME}}', agentName)
}
