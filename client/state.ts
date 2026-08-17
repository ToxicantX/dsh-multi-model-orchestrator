export const SETTINGS_NAMESPACE = 'multi-model-orchestrator'
export const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/u

export function catalogOptions(groups) {
  return groups.flatMap(group => group.models.map(model => ({
    provider: group.id,
    providerName: group.name,
    model: model.id,
    modelName: model.name,
  })))
}

export function validateAgents(agents) {
  const ids = new Set()
  for (const [index, agent] of agents.entries()) {
    if (!AGENT_ID.test(agent.id)) return 'Agent ' + (index + 1) + ' has an invalid ID.'
    if (ids.has(agent.id)) return 'Agent IDs must be unique.'
    ids.add(agent.id)
    if (!agent.provider || !agent.model) return 'Every agent must select a model.'
    if (agent.maxTokens !== undefined && (!Number.isSafeInteger(agent.maxTokens) || agent.maxTokens < 1)) return 'Max tokens must be a positive integer.'
  }
}

export function cleanAgents(agents) {
  return agents.map(agent => ({
    id: agent.id.trim(),
    provider: agent.provider,
    model: agent.model,
    ...(agent.description.trim() === '' ? {} : { description: agent.description.trim() }),
    ...(agent.maxTokens === undefined ? {} : { maxTokens: agent.maxTokens }),
  }))
}
