import { cp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { provisionLegacyPreset, provisionPreset } from '../src/preset.js'
import { specialistPersona } from '../agent.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = process.env.DSH_SMOKE_RUNTIME
const dshBin = join(runtimeRoot ?? join(repoRoot, 'node_modules', '@deepseek-ai', 'dsh'), 'lib', 'bin.js')
const timeoutMs = 90_000

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function diagnostics(logs) {
  return logs.join('').replace(/(dsh web: http:\/\/127\.0\.0\.1:\d+\/\?token=)[^\s\r\n]+/gu, '$1[redacted]')
}

async function waitForUrl(child, logs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const match = logs.join('').match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s\r\n]+)/u)
    if (match !== null) return match[1]
    if (child.exitCode !== null) throw new Error(`DSH exited with code ${child.exitCode}\n${diagnostics(logs)}`)
    await delay(100)
  }
  throw new Error(`Timed out waiting for DSH web URL\n${diagnostics(logs)}`)
}

async function rpc(baseUrl, cookie, method, args) {
  const endpoint = `${new URL(baseUrl).origin}/api/${method}`
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const rpcId = `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Origin: new URL(baseUrl).origin,
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method,
        payload: { args }
      })
    })
    const text = await response.text()
    if (response.status === 404) {
      await delay(100)
      continue
    }
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`${method} returned invalid JSON (HTTP ${response.status}): ${JSON.stringify(text)}`)
    }
    assert(response.ok, `${method} returned HTTP ${response.status}: ${JSON.stringify(body)}`)
    assert(body.rpcId === rpcId, `${method} returned mismatched RPC id: ${JSON.stringify(body)}`)
    assert(body.result?.ok === true, `${method} returned RPC failure: ${JSON.stringify(body)}`)
    return body.result.value
  }
  throw new Error(`Timed out waiting for ${method}`)
}

async function authenticate(url) {
  const response = await fetch(url, { redirect: 'manual' })
  assert(response.status === 303, `DSH token exchange returned HTTP ${response.status}`)
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie')
  assert(typeof setCookie === 'string', 'DSH token exchange did not return a session cookie')
  return setCookie.split(';', 1)[0]
}

async function probeRequest(url, cookie, sessionId, previous = 0) {
  const startedAt = Date.now()
  let observed = []
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${new URL(url).origin}/plugins/orchestrator-smoke`, { headers: { Cookie: cookie } })
    assert(response.ok, `prompt probe returned HTTP ${response.status}`)
    observed = await response.json()
    const failure = observed.find(request => request.sessionId === sessionId && request.failure !== undefined)
    assert(failure === undefined, 'probe turn failed: ' + JSON.stringify(failure?.failure))
    const requests = observed.filter(request => request.sessionId === sessionId && request.purpose === undefined)
    if (requests.length > previous) return requests.at(-1)
    await delay(100)
  }
  throw new Error('Timed out waiting for the assembled model request: ' + JSON.stringify(observed.map(({ sessionId, purpose, model }) => ({ sessionId, purpose, model }))))
}

function checkContext(request, workspace) {
  const text = JSON.stringify(request)
  assert(text.includes('smoke-project-instructions'), 'project AGENTS.md missing from model request')
  assert(text.includes('smoke-context-skill'), 'skill catalog missing from model request')
  assert(request.messages.some(message => message.source?.kind === 'time-context'), 'time context missing from model request')
  assert(!text.includes('{{model}}'), 'model variable was not interpolated')
  assert(text.replace(/\\+/gu, '/').toLowerCase().includes(workspace.replaceAll('\\', '/').toLowerCase()), 'working directory missing from model context')
}

async function main() {
  const home = await mkdtemp(join(process.env.TEMP ?? process.env.TMP ?? homedir(), 'dsh-agent-preset-smoke-'))
  let child
  const logs = []
  const backupId = 'multi-model-orchestrator.desktop-backup-mt2vuo26-86131799-1d2a-468b-862d-5abf932b4a89'
  const agents = Array.from({ length: 5 }, (_, index) => ({
    id: `smoke-${index}`,
    provider: 'smoke-provider',
    model: `smoke-model-${index}`,
    description: `Own smoke scope ${index}.`,
    persona: `Specialist ${index} acceptance prompt.`,
  }))
  try {
    provisionPreset({ target: join(home, '.agent-presets', 'multi-model-orchestrator') })
    provisionLegacyPreset({ primaryTarget: join(home, '.agent-presets', 'multi-model-orchestrator') })

    const profile = join(home, 'profiles', 'web')
    const workspace = join(home, 'workspace')
    await mkdir(join(workspace, '.agents', 'skills', 'smoke-context-skill'), { recursive: true })
    await writeFile(join(workspace, 'AGENTS.md'), '# Instructions\nsmoke-project-instructions\n')
    await writeFile(join(workspace, '.agents', 'skills', 'smoke-context-skill', 'SKILL.md'), '---\nname: smoke-context-skill\ndescription: Verify skill context in model requests.\n---\nProbe skill body.\n')
    const probeRoot = join(home, 'probe')
    await mkdir(probeRoot, { recursive: true })
    await cp(join(repoRoot, 'scripts', 'fixtures', 'prompt-probe.js'), join(probeRoot, 'index.js'))
    await writeFile(join(probeRoot, 'package.json'), JSON.stringify({ name: 'dsh-orchestrator-smoke', type: 'module', main: './index.js' }))
    const llmEntry = createRequire(await realpath(dshBin)).resolve('@deepseek-ai/dsh-llm')
    await mkdir(join(probeRoot, 'node_modules', '@deepseek-ai'), { recursive: true })
    await symlink(dirname(dirname(llmEntry)), join(probeRoot, 'node_modules', '@deepseek-ai', 'dsh-llm'), 'junction')
    let pluginRoot = repoRoot
    if (runtimeRoot !== undefined) {
      pluginRoot = join(home, 'plugin')
      const manifest = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
      await mkdir(pluginRoot, { recursive: true })
      for (const file of manifest.files) await cp(join(repoRoot, file), join(pluginRoot, file), { recursive: true })
      for (const dependency of Object.keys(manifest.peerDependencies)) {
        const target = join(pluginRoot, 'node_modules', dependency)
        await mkdir(dirname(target), { recursive: true })
        await symlink(join(runtimeRoot, 'node_modules', dependency), target, 'junction')
      }
    }
    execFileSync(process.execPath, [dshBin, '--profile', 'web', '--dump-default-config'], {
      cwd: repoRoot,
      env: { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' },
      stdio: 'ignore'
    })
    const profilePackage = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    profilePackage.dependencies = { 'dsh-multi-model-orchestrator': `link:${pluginRoot}`, 'dsh-orchestrator-smoke': `link:${probeRoot}` }
    await writeFile(join(profile, 'package.json'), JSON.stringify(profilePackage, null, 2) + '\n')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await symlink(pluginRoot, join(profile, 'node_modules', 'dsh-multi-model-orchestrator'), 'junction')
    await symlink(probeRoot, join(profile, 'node_modules', 'dsh-orchestrator-smoke'), 'junction')
    const pluginPatch = (await readFile(join(repoRoot, 'cordis.patch.yml'), 'utf8')).replace('agents: []', `agents: ${JSON.stringify(agents)}`)
    const backupPatch = `- insert:\n    - id: preset-upgrade-backup\n      name: '@deepseek-ai/dsh-agent-preset'\n      config:\n        id: ${backupId}\n        name: Multi-model orchestrator\n        plugins:\n          - id: backup-composition\n            name: dsh-multi-model-orchestrator/preset-loader\n`
    await writeFile(join(profile, 'cordis.patch.yml'), `- id: agent-preset-registry\n  config:\n    default: standard\n${pluginPatch}\n${backupPatch}\n- insert:\n    - id: orchestrator-smoke\n      name: dsh-orchestrator-smoke\n`)

    child = spawn(process.execPath, [dshBin, '--profile', 'web', '--port', '0', '--no-open'], {
      cwd: repoRoot,
      env: { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout.on('data', (chunk) => logs.push(chunk.toString()))
    child.stderr.on('data', (chunk) => logs.push(chunk.toString()))
    const url = await waitForUrl(child, logs)
    const cookie = await authenticate(url)
    const settingsResponse = await fetch(`${new URL(url).origin}/plugins/dsh-multi-model-orchestrator/settings`, { headers: { Cookie: cookie, Origin: new URL(url).origin } })
    assert(settingsResponse.status === 200, `plugin settings route unavailable: HTTP ${settingsResponse.status}`)
    const settings = await settingsResponse.json()
    assert(Array.isArray(settings.agents), `plugin settings response is invalid: ${JSON.stringify(settings)}`)
    assert(settings.agents.length === agents.length && settings.agents.every((agent, index) =>
      agent.id === agents[index].id && agent.model === agents[index].model && agent.persona === agents[index].persona
    ), 'configured specialist models or prompts were not preserved')
    const settingsUpdateResponse = await fetch(`${new URL(url).origin}/plugins/dsh-multi-model-orchestrator/settings`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        Origin: new URL(url).origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ agents })
    })
    assert(settingsUpdateResponse.status === 200, `plugin settings update failed: HTTP ${settingsUpdateResponse.status}`)
    const roster = await rpc(url, cookie, 'agentPresets/list', {})
    assert(roster.presets.filter((preset) => preset.id === 'multi-model-orchestrator').length === 1, `primary preset missing: ${JSON.stringify(roster)}`)
    assert(roster.presets.every((preset) => preset.id !== 'orchestrator'), `managed legacy preset leaked into catalog: ${JSON.stringify(roster)}`)
    assert(roster.presets.every(preset => preset.id !== backupId), 'upgrade backup leaked into the preset picker')
    const primary = roster.presets.find((preset) => preset.id === 'multi-model-orchestrator')
    assert(primary.broken === undefined, `primary preset failed to activate: ${JSON.stringify(primary)}`)
    assert(roster.presets.every(preset => !preset.id.startsWith('multi-model-specialist-')), 'internal specialists leaked into the preset picker')
    const legacy = await rpc(url, cookie, 'session/create', { request: { cwd: workspace, agentPreset: 'orchestrator' } })
    assert(typeof legacy.sessionId === 'string', 'legacy preset stopped resolving')
    const backup = await rpc(url, cookie, 'session/create', { request: { cwd: workspace, agentPreset: backupId } })
    assert(typeof backup.sessionId === 'string', 'hidden backup stopped resolving')
    const session = await rpc(url, cookie, 'session/create', { request: { cwd: workspace, agentPreset: 'multi-model-orchestrator' } })
    assert(typeof session.sessionId === 'string', `session creation failed: ${JSON.stringify(session)}`)
    const second = await rpc(url, cookie, 'session/create', { request: { cwd: repoRoot, agentPreset: 'multi-model-orchestrator' } })
    assert(second.sessionId !== session.sessionId, 'separate sessions must not share an identity')
    await rpc(url, cookie, 'session/selectModel', { request: { sessionId: session.sessionId, provider: 'smoke-provider', model: 'smoke-model-0' } })
    await rpc(url, cookie, 'session/prompt', { request: { sessionId: session.sessionId, requestId: 'probe-main', mode: 'queue', content: [{ type: 'text', text: 'Inspect the context.' }], clientTimeZone: 'Asia/Shanghai' } })
    const request = await probeRequest(url, cookie, session.sessionId)
    checkContext(request, workspace)
    const primaryText = JSON.stringify(request)
    assert(primaryText.includes('primary coding orchestrator powered by the smoke-model-0 model'), 'primary persona missing or incorrect model name')
    assert(primaryText.includes('subagent_smoke-4'), 'fifth specialist missing from model context')
    assert(primaryText.includes('run_code'), 'Code Mode presentation was lost')
    assert(primaryText.includes('present'), 'result presentation tool was lost')
    assert(!primaryText.includes('You are in plan mode.'), 'plan rules leaked into ordinary mode')
    const planResponse = await fetch(`${new URL(url).origin}/plugins/orchestrator-smoke`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.sessionId }),
    })
    assert(planResponse.ok, 'could not enter plan mode')
    await rpc(url, cookie, 'session/prompt', { request: { sessionId: session.sessionId, requestId: 'probe-plan', mode: 'queue', content: [{ type: 'text', text: 'Inspect plan context.' }], clientTimeZone: 'Asia/Shanghai' } })
    const planned = await probeRequest(url, cookie, session.sessionId, 1)
    assert(JSON.stringify(planned).includes('user approves your plan through exit_plan_mode'), 'plan approval guidance missing from model request')
    assert(JSON.stringify(planned.tools) === JSON.stringify(request.tools), 'plan mode changed the tool catalog')
    if (runtimeRoot !== undefined) {
      const standard = await rpc(url, cookie, 'session/create', { request: { cwd: workspace, agentPreset: 'standard' } })
      await rpc(url, cookie, 'session/selectModel', { request: { sessionId: standard.sessionId, provider: 'smoke-provider', model: 'smoke-model-0' } })
      await rpc(url, cookie, 'session/prompt', { request: { sessionId: standard.sessionId, requestId: 'probe-standard', mode: 'queue', content: [{ type: 'text', text: 'Inspect standard context.' }], clientTimeZone: 'Asia/Shanghai' } })
      const standardRequest = await probeRequest(url, cookie, standard.sessionId)
      checkContext(standardRequest, workspace)
      for (const tool of standardRequest.tools ?? []) {
        if (['subagent', 'subagent_fork', 'workflow'].includes(tool.name)) continue
        assert(primaryText.includes(tool.name), 'standard tool missing from orchestrator: ' + tool.name)
      }
      const revision = createHash('sha256').update(specialistPersona(agents[0])).digest('hex')
      const childPreset = `multi-model-specialist-${agents[0].id}-${revision}`
      const specialist = await rpc(url, cookie, 'session/create', { request: { cwd: workspace, agentPreset: childPreset } })
      assert(typeof specialist.sessionId === 'string', 'specialist preset could not create its own session')
      await rpc(url, cookie, 'session/selectModel', { request: { sessionId: specialist.sessionId, provider: 'smoke-provider', model: 'smoke-model-0' } })
      await rpc(url, cookie, 'session/prompt', { request: { sessionId: specialist.sessionId, requestId: 'probe-child', mode: 'queue', content: [{ type: 'text', text: 'Inspect specialist context.' }], clientTimeZone: 'Asia/Shanghai' } })
      const specialistRequest = await probeRequest(url, cookie, specialist.sessionId)
      checkContext(specialistRequest, workspace)
      const specialistText = JSON.stringify(specialistRequest)
      assert(specialistText.includes(agents[0].persona), 'specialist persona missing from model request')
      assert(!specialistText.includes('primary coding orchestrator'), 'primary persona leaked into specialist request')
      assert(!specialistText.includes('subagent_smoke-'), 'specialist can delegate recursively')
    }
    console.log('agent preset smoke test passed')
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error)
    throw new Error(`${detail}\n\nDSH diagnostics:\n${diagnostics(logs)}`)
  } finally {
    if (child !== undefined && child.exitCode === null) {
      child.kill('SIGTERM')
      await delay(250)
      if (child.exitCode === null) child.kill('SIGKILL')
    }
    if (process.env.DSH_SMOKE_KEEP !== '1') await rm(home, { recursive: true, force: true })
    else console.error(`DSH smoke home: ${home}`)
  }
}

await main()
