import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { provisionLegacyPreset, provisionPreset } from '../src/preset.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshBin = join(repoRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
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
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Origin: new URL(baseUrl).origin,
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      payload: { args }
    })
  })
  const body = await response.json()
  assert(response.ok, `${method} returned HTTP ${response.status}: ${JSON.stringify(body)}`)
  assert(body.result?.ok === true, `${method} returned RPC failure: ${JSON.stringify(body)}`)
  return body.result.value
}

async function authenticate(url) {
  const response = await fetch(url, { redirect: 'manual' })
  assert(response.status === 303, `DSH token exchange returned HTTP ${response.status}`)
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie')
  assert(typeof setCookie === 'string', 'DSH token exchange did not return a session cookie')
  return setCookie.split(';', 1)[0]
}

async function main() {
  const home = await mkdtemp(join(process.env.TEMP ?? process.env.TMP ?? homedir(), 'dsh-agent-preset-smoke-'))
  let child
  const logs = []
  try {
    provisionPreset({ target: join(home, '.agent-presets', 'multi-model-orchestrator') })
    provisionLegacyPreset({ primaryTarget: join(home, '.agent-presets', 'multi-model-orchestrator') })

    const customRoot = join(home, 'custom-presets')
    await mkdir(join(customRoot, 'orchestrator'), { recursive: true })
    await cp(join(home, '.agent-presets', 'orchestrator', 'agent.cordis.yml'), join(customRoot, 'orchestrator', 'agent.cordis.yml'))
    await writeFile(join(customRoot, 'orchestrator', 'preset.yml'), 'name: User preset\ndescription: User-owned preset with the legacy id\n')

    const profile = join(home, 'profiles', 'web')
    execFileSync(process.execPath, [dshBin, '--profile', 'web', '--dump-default-config'], {
      cwd: repoRoot,
      env: { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' },
      stdio: 'ignore'
    })
    const profilePackage = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    profilePackage.dependencies = { 'dsh-multi-model-orchestrator': `link:${repoRoot}` }
    await writeFile(join(profile, 'package.json'), JSON.stringify(profilePackage, null, 2) + '\n')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await symlink(repoRoot, join(profile, 'node_modules', 'dsh-multi-model-orchestrator'), 'junction')
    await writeFile(join(profile, 'cordis.patch.yml'), `- id: agent-presets\n  config:\n    default: standard\n    roots:\n      - path: !!js dshHomePath('custom-presets')\n        trust: user\n- insert:\n    - id: multi-model-orchestrator-settings\n      name: dsh-multi-model-orchestrator\n      config:\n        agents: []\n        presetPath: !!js dshHomePath('.agent-presets/multi-model-orchestrator/agent.cordis.yml')\n`)

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
    const rosterWithUserOverride = await rpc(url, cookie, 'agentPresets/list', {})
    const primary = rosterWithUserOverride.presets.filter((preset) => preset.id === 'multi-model-orchestrator')
    const userLegacy = rosterWithUserOverride.presets.filter((preset) => preset.id === 'orchestrator')
    assert(primary.length === 1, `expected one primary preset, got ${JSON.stringify(rosterWithUserOverride.presets)}`)
    assert(userLegacy.length === 1 && userLegacy[0].name === 'User preset', `user-owned legacy id was hidden or altered: ${JSON.stringify(rosterWithUserOverride.presets)}`)

    await rm(join(customRoot, 'orchestrator'), { recursive: true, force: true })
    const roster = await rpc(url, cookie, 'agentPresets/list', {})
    assert(roster.presets.filter((preset) => preset.id === 'multi-model-orchestrator').length === 1, `primary preset missing: ${JSON.stringify(roster)}`)
    assert(roster.presets.every((preset) => preset.id !== 'orchestrator'), `managed legacy preset leaked into catalog: ${JSON.stringify(roster)}`)
    const legacy = await rpc(url, cookie, 'agentPresets/read', { agentPreset: 'orchestrator' })
    assert(legacy.agentPreset === 'orchestrator', `legacy preset did not resolve: ${JSON.stringify(legacy)}`)
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
