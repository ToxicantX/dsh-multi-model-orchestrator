import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { catalogOptions, cleanAgents, createAgentDraft, validateAgents, withRenderKey } from '../client/state.ts'
import { DEFAULT_AGENT_DESCRIPTION, MAX_AGENT_COUNT } from '../src/config.js'

const input = (id, overrides = {}) => ({ id, provider: 'p', model: 'm', description: '', ...overrides })

test('creates stable Agent draft keys with the shared default responsibility', () => {
  const first = createAgentDraft()
  const second = createAgentDraft()
  assert.deepEqual({ ...first, renderKey: undefined }, {
    id: '',
    provider: '',
    model: '',
    description: DEFAULT_AGENT_DESCRIPTION,
    reasoningEffort: undefined,
    maxTokens: undefined,
    renderKey: undefined,
  })
  assert.match(first.renderKey, /^agent-\d+$/u)
  assert.notEqual(first.renderKey, second.renderKey)
  assert.notEqual(withRenderKey(input('loaded')).renderKey, first.renderKey)
  assert.match(DEFAULT_AGENT_DESCRIPTION, /inspect your diff/)
  assert.match(DEFAULT_AGENT_DESCRIPTION, /never claim completion when a required check fails/)
})

test('flattens model identifiers and detached reasoning metadata', () => {
  const groups = [{ id: 'openai', name: 'OpenAI route', models: [{
    id: 'model-a',
    name: 'Model A',
    reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' },
  }] }]
  const options = catalogOptions(groups)
  assert.deepEqual(options, [{
    provider: 'openai',
    providerName: 'OpenAI route',
    model: 'model-a',
    modelName: 'Model A',
    reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' },
  }])
  groups[0].models[0].reasoning.efforts[0].name = 'Changed'
  assert.equal(options[0].reasoning.efforts[0].name, 'High')
})

test('validates normalized IDs, models, reasoning, and token limits', () => {
  assert.equal(validateAgents([input(' reviewer ')]), undefined)
  assert.match(validateAgents([input('Bad ID')]), /invalid ID/)
  assert.match(validateAgents([input(' a '), input('a')]), /unique/)
  assert.match(validateAgents([input('a', { provider: '', model: '' })]), /select a model/)
  assert.match(validateAgents([input('a', { maxTokens: 0 })]), /positive integer/)

  const options = catalogOptions([{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }] }])
  assert.equal(validateAgents([input('a', { reasoningEffort: 'high' })], options), undefined)
  assert.match(validateAgents([input('a', { reasoningEffort: 'low' })], options), /unsupported reasoning effort/)
  assert.match(validateAgents([input('a', { model: 'removed' })], options), /no longer available/)
  assert.match(validateAgents([input('a')], []), /no longer available/)
})

test('enforces the three-Agent cap at the exact boundaries', () => {
  assert.equal(MAX_AGENT_COUNT, 3)
  const maximum = Array.from({ length: MAX_AGENT_COUNT }, (_, index) => input('agent-' + index))
  assert.equal(validateAgents(maximum), undefined)
  assert.match(validateAgents([...maximum, input('overflow')]), /must not exceed 3/)
})

test('explains the active limit for an oversized legacy roster', async () => {
  const [section, client] = await Promise.all([
    readFile(new URL('../client/SettingsOrchestratorSection.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../client/index.ts', import.meta.url), 'utf8'),
  ])
  assert.match(section, /agents[.]length > MAX_AGENT_COUNT.*legacyAgentLimit/u)
  assert.match(client, /Only the first 3 are active; remove the extras before saving[.]/u)
  assert.match(client, /当前仅启用前 3 个；请删除多余 Agent 后保存。/u)
})

test('settings payload strips render keys and credential-like fields', async () => {
  const agents = cleanAgents([{
    id: ' a ',
    provider: 'route',
    model: 'model',
    description: ' Role ',
    reasoningEffort: 'high',
    maxTokens: 4096,
    renderKey: 'internal-only',
  }])
  assert.deepEqual(agents, [{ id: 'a', provider: 'route', model: 'model', description: 'Role', reasoningEffort: 'high', maxTokens: 4096 }])
  const serialized = JSON.stringify({ agents })
  assert.doesNotMatch(serialized, /renderKey|apiKey|baseURL|credential/i)
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(bundle, /discoverModels|credentials[.]|apiKeyEnv|baseURL/)
  assert.match(bundle, /\/plugins\/dsh-multi-model-orchestrator\/settings/)
  assert.doesNotMatch(bundle, /settings[.](?:replace|describe)/)
  assert.match(bundle, /models[.]modelCatalog/)
  assert.doesNotMatch(bundle, /remote[.]agentPresets/)
  assert.doesNotMatch(bundle, /connection[.]api|llm[.]models/)
  assert.match(bundle, /CanvasText/)
})
