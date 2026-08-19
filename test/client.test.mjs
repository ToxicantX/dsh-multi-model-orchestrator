import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { hideLegacyPresetFromCatalog, LEGACY_PRESET_DESCRIPTION, LEGACY_PRESET_ID } from '../client/presetCatalog.ts'
import { agentCountWarning, catalogOptions, cleanAgents, createAgentDraft, validateAgents, withRenderKey } from '../client/state.ts'
import { AGENT_WARNING_THRESHOLD, DEFAULT_AGENT_DESCRIPTION, MAX_AGENT_COUNT } from '../src/config.js'

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

test('enforces the Agent cap and exposes the soft warning threshold', () => {
  const maximum = Array.from({ length: MAX_AGENT_COUNT }, (_, index) => input('agent-' + index))
  assert.equal(validateAgents(maximum), undefined)
  assert.match(validateAgents([...maximum, input('overflow')]), /must not exceed 32/)
  assert.equal(agentCountWarning(AGENT_WARNING_THRESHOLD), false)
  assert.equal(agentCountWarning(AGENT_WARNING_THRESHOLD + 1), true)
  assert.equal(agentCountWarning(MAX_AGENT_COUNT + 1), false)
})

test('hides the legacy preset from client catalog responses and restores the API', async () => {
  const response = {
    result: {
      ok: true,
      value: {
        presets: [{ id: 'standard' }, { id: 'multi-model-orchestrator' }, { id: LEGACY_PRESET_ID, description: LEGACY_PRESET_DESCRIPTION }],
        authorable: true,
      },
    },
  }
  const originalList = async () => response
  const api = { list: originalList }
  const restore = hideLegacyPresetFromCatalog(api)
  const filtered = await api.list({})
  assert.deepEqual(filtered.result.value.presets.map(preset => preset.id), ['standard', 'multi-model-orchestrator'])
  assert.deepEqual(response.result.value.presets.map(preset => preset.id), ['standard', 'multi-model-orchestrator', LEGACY_PRESET_ID])
  assert.notEqual(filtered, response)
  restore()
  assert.equal(api.list, originalList)
  assert.equal(await api.list({}), response)

  const userPresetResponse = { result: { ok: true, value: { presets: [{ id: LEGACY_PRESET_ID, description: 'User preset' }] } } }
  const userApi = { async list() { return userPresetResponse } }
  hideLegacyPresetFromCatalog(userApi)
  assert.deepEqual((await userApi.list({})).result.value.presets, userPresetResponse.result.value.presets)

  const failed = { result: { ok: false, error: { message: 'unavailable' } } }
  const failedApi = { async list() { return failed } }
  hideLegacyPresetFromCatalog(failedApi)
  assert.equal(await failedApi.list({}), failed)
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
  assert.match(bundle, /llm[.]models/)
  assert.match(bundle, /connection[.]api[.]agentPresets/)
  assert.match(bundle, /CanvasText/)
})
