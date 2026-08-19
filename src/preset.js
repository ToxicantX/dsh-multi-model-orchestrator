import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PRESET_MARKER = '.dsh-multi-model-orchestrator.json'
export const PRESET_MARKER_SCHEMA = 1
export const PRESET_MANAGED_BY = 'dsh-multi-model-orchestrator'
export const DEFAULT_PRESET_ID = 'multi-model-orchestrator'
export const LEGACY_PRESET_ID = 'orchestrator'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultSourceDir = join(packageRoot, 'preset')
const managedFiles = ['agent.cordis.yml', 'preset.yml']
// v0.5.0 predates the marker; exact bundle hashes allow one safe managed upgrade.
const knownUnmarkedBundles = [{
  'agent.cordis.yml': '82344873a4682182237d8db43e339eb59f90d0687e4ed59516f260a235e45e4b',
  'preset.yml': 'ded7e5cabec065f2d37e52bda8ecf4d8bcc1eda0ddc2900e5464e48f9902cb80',
}]

function hash(content) {
  return createHash('sha256').update(content).digest('hex')
}

function validatePresetId(presetId) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(presetId)) throw new Error('Invalid preset id: ' + presetId)
}

function markerError(target, detail) {
  return new Error('Refusing to modify preset target ' + target + ': ' + detail + ' Use --force to replace it.')
}

function readOptional(path) {
  try { return readFileSync(path) } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

export function provisionPreset({ target, presetId = DEFAULT_PRESET_ID, force = false, sourceDir = defaultSourceDir, legacyBundles = knownUnmarkedBundles } = {}) {
  validatePresetId(presetId)
  if (!target) throw new Error('Preset target is required')
  const sources = Object.fromEntries(managedFiles.map(name => {
    const content = readFileSync(join(sourceDir, name))
    return [name, { content, hash: hash(content) }]
  }))
  const markerPath = join(target, PRESET_MARKER)
  const existing = Object.fromEntries(Object.keys(sources).map(name => [name, readOptional(join(target, name))]))
  const markerBytes = readOptional(markerPath)
  let marker
  if (markerBytes !== undefined) {
    try { marker = JSON.parse(markerBytes.toString('utf8')) } catch { if (!force) throw markerError(target, 'the management marker is invalid.') }
    const validMarker = marker?.schema === PRESET_MARKER_SCHEMA
      && marker?.managedBy === PRESET_MANAGED_BY
      && typeof marker?.files === 'object'
      && marker.files !== null
      && managedFiles.every(name => typeof marker.files[name] === 'string' && /^[a-f0-9]{64}$/u.test(marker.files[name]))
    if (!validMarker) {
      if (!force) throw markerError(target, 'the management marker is foreign or invalid.')
      marker = undefined
    }
  }
  const present = Object.entries(existing).filter(([, content]) => content !== undefined)
  const changed = []
  let adopted = false
  let migrated = false
  if (force) {
    changed.push(...Object.keys(sources), PRESET_MARKER)
  } else if (marker) {
    for (const [name, content] of present) {
      if (marker.files[name] !== hash(content)) throw markerError(target, name + ' has changed since it was managed.')
    }
    for (const name of Object.keys(sources)) if (existing[name] === undefined || hash(existing[name]) !== sources[name].hash) changed.push(name)
  } else if (present.length === 0) {
    changed.push(...Object.keys(sources), PRESET_MARKER)
  } else {
    const matchesSource = present.every(([name, content]) => content.equals(sources[name].content))
    const legacyBundle = matchesSource ? undefined : legacyBundles.find(bundle => present.every(([name, content]) => bundle[name] === hash(content)))
    if (!matchesSource && legacyBundle === undefined) {
      const mismatched = present.find(([name, content]) => !content.equals(sources[name].content))
      throw markerError(target, mismatched[0] + ' does not match the packaged preset.')
    }
    adopted = present.length === Object.keys(sources).length
    migrated = legacyBundle !== undefined
    for (const name of Object.keys(sources)) {
      if (existing[name] === undefined || !existing[name].equals(sources[name].content)) changed.push(name)
    }
    changed.push(PRESET_MARKER)
  }
  const markerContent = JSON.stringify({ schema: PRESET_MARKER_SCHEMA, managedBy: PRESET_MANAGED_BY, files: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, value.hash])) }) + '\n'
  if (changed.length > 0 || force) {
    mkdirSync(target, { recursive: true })
    for (const name of Object.keys(sources)) if (force || existing[name] === undefined || changed.includes(name)) writeFileSync(join(target, name), sources[name].content)
    if (force || changed.includes(PRESET_MARKER) || marker) writeFileSync(markerPath, markerContent)
  }
  return { target, changed, adopted, migrated, marker: markerPath }
}

export function defaultPresetTarget(presetId = DEFAULT_PRESET_ID) {
  validatePresetId(presetId)
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), '.agent-presets', presetId)
}

export function provisionLegacyPreset({ primaryTarget, sourceDir = defaultSourceDir } = {}) {
  if (!primaryTarget) throw new Error('Primary preset target is required')
  const target = join(dirname(primaryTarget), LEGACY_PRESET_ID)
  if (!existsSync(target)) {
    return { ...provisionPreset({ target, presetId: LEGACY_PRESET_ID, sourceDir }), skipped: false }
  }
  const markerBytes = readOptional(join(target, PRESET_MARKER))
  if (markerBytes === undefined) return { target, changed: [], skipped: true, reason: 'existing-unmanaged' }
  let marker
  try { marker = JSON.parse(markerBytes.toString('utf8')) } catch {
    return { target, changed: [], skipped: true, reason: 'invalid-marker' }
  }
  const validMarker = marker?.schema === PRESET_MARKER_SCHEMA
    && marker?.managedBy === PRESET_MANAGED_BY
    && typeof marker?.files === 'object'
    && marker.files !== null
    && managedFiles.every(name => typeof marker.files[name] === 'string' && /^[a-f0-9]{64}$/u.test(marker.files[name]))
  if (!validMarker) return { target, changed: [], skipped: true, reason: 'foreign-marker' }
  for (const name of managedFiles) {
    const content = readOptional(join(target, name))
    if (content !== undefined && marker.files[name] !== hash(content)) {
      return { target, changed: [], skipped: true, reason: 'managed-content-changed' }
    }
  }
  return { ...provisionPreset({ target, presetId: LEGACY_PRESET_ID, sourceDir }), skipped: false }
}
