import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { catalogOptions, cleanAgents, validateAgents } from '../client/state.ts'

test('flattens only configured catalog provider and model identifiers', () => {
  assert.deepEqual(catalogOptions([{ id: 'openai', name: 'OpenAI route', models: [{ id: 'model-a', name: 'Model A' }] }]), [
    { provider: 'openai', providerName: 'OpenAI route', model: 'model-a', modelName: 'Model A' },
  ])
})

test('validates IDs, uniqueness, model selection, and max tokens', () => {
  assert.equal(validateAgents([{ id: 'reviewer', provider: 'grok', model: 'grok-4.6', description: '' }]), undefined)
  assert.match(validateAgents([{ id: 'Bad ID', provider: 'grok', model: 'm', description: '' }]), /invalid ID/)
  assert.match(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '' }, { id: 'a', provider: 'p', model: 'm', description: '' }]), /unique/)
  assert.match(validateAgents([{ id: 'a', provider: '', model: '', description: '' }]), /select a model/)
  assert.match(validateAgents([{ id: 'a', provider: 'p', model: 'm', description: '', maxTokens: 0 }]), /positive integer/)
})

test('settings payload contains no credential or endpoint fields', async () => {
  const agents = cleanAgents([{ id: 'a', provider: 'route', model: 'model', description: ' Role ', maxTokens: 4096 }])
  assert.deepEqual(agents, [{ id: 'a', provider: 'route', model: 'model', description: 'Role', maxTokens: 4096 }])
  const serialized = JSON.stringify({ agents })
  assert.doesNotMatch(serialized, /apiKey|baseURL|credential/i)
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(bundle, /discoverModels|credentials[.]|apiKeyEnv|baseURL/)
  assert.match(bundle, /\/plugins\/dsh-multi-model-orchestrator\/settings/)
  assert.doesNotMatch(bundle, /settings[.](?:replace|describe)/)
  assert.match(bundle, /llm[.]models/)
  assert.match(bundle, /CanvasText/)
})
