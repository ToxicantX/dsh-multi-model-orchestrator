import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const identifier = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)'
const prerelease = '(?:-' + identifier + '(?:\\.' + identifier + ')*)?'
const build = '(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?'
const TAG = new RegExp('^v(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)' + prerelease + build + '$', 'u')

export function validateRelease(tag, packageVersion, changelog) {
  if (typeof tag !== 'string' || !TAG.test(tag)) {
    throw new Error('release tag must be a v-prefixed SemVer value')
  }
  if (tag.slice(1) !== packageVersion) {
    throw new Error('release tag ' + tag + ' does not match package version ' + packageVersion)
  }
  const prefix = '## [' + packageVersion + '] - '
  const entry = changelog.split(/\r?\n/u).find(line => line.startsWith(prefix))
  if (entry === undefined || entry.slice(prefix.length) === 'Unreleased') {
    throw new Error('CHANGELOG.md needs a dated entry for version ' + packageVersion)
  }
  const date = entry.slice(prefix.length)
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error('CHANGELOG.md has an invalid release date for version ' + packageVersion)
  }
  const parsed = new Date(date + 'T00:00:00.000Z')
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('CHANGELOG.md has an invalid release date for version ' + packageVersion)
  }
  return { tag, version: packageVersion, date }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    console.error('Usage: pnpm release:check v<version>')
    process.exitCode = 1
    return
  }
  try {
    const root = dirname(dirname(fileURLToPath(import.meta.url)))
    const [packageText, changelog] = await Promise.all([
      readFile(resolve(root, 'package.json'), 'utf8'),
      readFile(resolve(root, 'CHANGELOG.md'), 'utf8'),
    ])
    const packageJson = JSON.parse(packageText)
    const result = validateRelease(args[0], packageJson.version, changelog)
    console.log('Release ' + result.tag + ' matches package.json and CHANGELOG.md (' + result.date + ').')
  } catch (error) {
    console.error('Release check failed: ' + (error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await main()
