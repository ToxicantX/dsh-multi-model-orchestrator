import assert from 'node:assert/strict'
import test from 'node:test'
import { validateRelease } from '../src/release-check.mjs'

const dated = version => '# Changelog\n\n## [Unreleased]\n\n## [' + version + '] - 2026-08-19\n\n### Added\n\n- Release.\n'

test('accepts a stable tag matching a dated changelog entry', () => {
  assert.deepEqual(validateRelease('v0.5.0', '0.5.0', dated('0.5.0')), { tag: 'v0.5.0', version: '0.5.0', date: '2026-08-19' })
})

test('accepts valid prerelease and build identifiers', () => {
  assert.deepEqual(validateRelease('v1.2.3-rc.1+build.7', '1.2.3-rc.1+build.7', dated('1.2.3-rc.1+build.7')).version, '1.2.3-rc.1+build.7')
})

test('rejects malformed and non-prefixed tags', () => {
  for (const tag of ['0.5.0', 'v01.2.3', 'v1.2', 'v1.2.3-01', 'release-1.2.3']) {
    assert.throws(() => validateRelease(tag, '0.5.0', dated('0.5.0')), /v-prefixed SemVer/)
  }
})

test('rejects a tag that differs from package.json', () => {
  assert.throws(() => validateRelease('v0.5.1', '0.5.0', dated('0.5.0')), /does not match package version/)
})

test('rejects a missing or Unreleased-only changelog entry', () => {
  assert.throws(() => validateRelease('v0.5.0', '0.5.0', '# Changelog\n\n## [Unreleased]\n'), /needs a dated entry/)
  assert.throws(() => validateRelease('v0.5.0', '0.5.0', '# Changelog\n\n## [0.5.0] - Unreleased\n'), /needs a dated entry/)
})

test('rejects an invalid calendar date', () => {
  assert.throws(() => validateRelease('v0.5.0', '0.5.0', '## [0.5.0] - 2026-02-30\n'), /invalid release date/)
})
