import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { catalogOptions, cleanAgents, createAgentDraft, validateAgents } from '../client/state.ts'
import { DEFAULT_AGENT_DESCRIPTION } from '../src/config.js'

test('creates an Agent draft with the shared default development responsibility', () => {
  assert.deepEqual(createAgentDraft(), {
    id: '',
    provider: '',
    model: '',
    description: DEFAULT_AGENT_DESCRIPTION,
    reasoningEffort: undefined,
    maxTokens: undefined,
  })
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

test('validates IDs, uniqueness, model selection, and max tokens', () => {
  assert.equal(validateAgents([{ id: 'reviewer', provider: 'grok', model: 'grok-4.6', description: '' }]), undefined)
  assert.match(validateAgents([{ id: 'Bad ID', provider: 'grok', model: 'm', description: '' }]), /invalid ID/)
  assert.match(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '' }, { id: 'a', provider: 'p', model: 'm', description: '' }]), /unique/)
  assert.match(validateAgents([{ id: 'a', provider: '', model: '', description: '' }]), /select a model/)
  assert.match(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '', maxTokens: 0 }]), /positive integer/)
  const options = catalogOptions([{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }] }])
  assert.equal(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '', reasoningEffort: 'high' }], options), undefined)
  assert.match(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '', reasoningEffort: 'low' }], options), /unsupported reasoning effort/)
})

test('settings payload contains no credential or endpoint fields', async () => {
  const agents = cleanAgents([{ id: 'a', provider: 'route', model: 'model', description: ' Role ', reasoningEffort: 'high', maxTokens: 4096 }])
  assert.deepEqual(agents, [{ id: 'a', provider: 'route', model: 'model', description: 'Role', reasoningEffort: 'high', maxTokens: 4096 }])
  const serialized = JSON.stringify({ agents })
  assert.doesNotMatch(serialized, /apiKey|baseURL|credential/i)
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(bundle, /discoverModels|credentials[.]|apiKeyEnv|baseURL/)
  assert.match(bundle, /\/plugins\/dsh-multi-model-orchestrator\/settings/)
  assert.doesNotMatch(bundle, /settings[.](?:replace|describe)/)
  assert.match(bundle, /llm[.]models/)
  assert.match(bundle, /CanvasText/)
})
