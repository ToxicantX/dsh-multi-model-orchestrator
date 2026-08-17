import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { install, parseArgs, renderTemplate } from '../src/install.mjs'

test('parses four role route options', () => {
  assert.deepEqual(parseArgs(['--agent-a-provider', 'alpha', '--agent-a-model', 'model-a', '--agent-b-provider', 'beta', '--agent-b-model', 'model-b']), {
    presetId: 'multi-model-orchestrator', force: false, agentAProvider: 'alpha', agentAModel: 'model-a', agentBProvider: 'beta', agentBModel: 'model-b',
  })
})

test('quotes route values and rejects missing roles', () => {
  const source = 'provider: __AGENT_A_PROVIDER__\nmodel: __AGENT_A_MODEL__\nprovider: __AGENT_B_PROVIDER__\nmodel: __AGENT_B_MODEL__\n'
  const rendered = renderTemplate(source, { agentAProvider: 'vendor:a', agentAModel: 'model/a', agentBProvider: 'vendor-b', agentBModel: 'model b' })
  assert.equal(rendered, 'provider: \"vendor:a\"\nmodel: \"model/a\"\nprovider: \"vendor-b\"\nmodel: \"model b\"\n')
  assert.throws(() => renderTemplate(source, {}), /Missing required option/)
})

test('installs a provider-neutral preset without secrets or local paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-'))
  try {
    const target = join(root, 'preset')
    await install({ target, agentAProvider: 'provider-a', agentAModel: 'model-a', agentBProvider: 'provider-b', agentBModel: 'model-b' })
    const output = await readFile(join(target, 'agent.cordis.yml'), 'utf8')
    assert.match(output, /toolName: subagent_a/)
    assert.match(output, /provider: \"provider-a\"/)
    assert.match(output, /model: \"model-b\"/)
    assert.doesNotMatch(output, /__AGENT_|api.?key|D:\\DevTools|gpt-5\.6|grok-4\.6|Luna MAX/iu)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
