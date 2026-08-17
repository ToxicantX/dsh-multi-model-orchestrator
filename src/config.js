export const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/u

function requiredString(value, label, maxLength = 512) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Missing required field: ' + label)
  const clean = value.trim()
  if (/\r|\n|\0/u.test(clean)) throw new Error('Invalid newline in ' + label)
  if (clean.length > maxLength) throw new Error(label + ' exceeds ' + maxLength + ' characters')
  return clean
}

export function normalizeAgents(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('agents must be a non-empty array')
  const ids = new Set()
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error('agents[' + index + '] must be an object')
    const id = requiredString(entry.id, 'agents[' + index + '].id', 48)
    if (!AGENT_ID.test(id)) throw new Error('Invalid agent id: ' + id)
    if (ids.has(id)) throw new Error('Duplicate agent id: ' + id)
    ids.add(id)
    const provider = requiredString(entry.provider, 'agents[' + index + '].provider')
    const model = requiredString(entry.model, 'agents[' + index + '].model')
    const fallback = 'You are the ' + id + ' specialist. Own the assigned scope, inspect the actual repository, work rigorously, run focused verification, and report concrete results, risks, and unresolved questions to the primary orchestrator.'
    const description = entry.description === undefined ? fallback : requiredString(entry.description, 'agents[' + index + '].description', 2000)
    if (entry.maxTokens !== undefined && (!Number.isSafeInteger(entry.maxTokens) || entry.maxTokens < 1)) {
      throw new Error('agents[' + index + '].maxTokens must be a positive safe integer')
    }
    return { id, provider, model, description, ...(entry.maxTokens === undefined ? {} : { maxTokens: entry.maxTokens }) }
  })
}
