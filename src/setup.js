#!/usr/bin/env node
/**
 * Generate the user preset that mounts the Qwen3.8 compaction backend inside
 * the agent preset's isolated compaction group, publish its display metadata
 * (`preset.yml` beside the composition), and set it as the default agent
 * preset.
 *
 * Reads the installed standard preset's `agent.cordis.yml`, swaps the
 * `compaction-basic` row for this package's backend (and pins its
 * `maxTokens`), and writes `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml`
 * (a dated backup replaces any earlier generated copy). The generated preset
 * is regenerated from the live installed preset on every run, so it tracks
 * DSH releases without a re-cut diff.
 *
 * Also merges `agent-presets: { default: qwen38-qol }` into
 * `~/.dsh/settings.yaml` (a dated backup of the file when it changed) so new
 * sessions use the preset automatically; an already-set default is left
 * untouched (idempotent re-runs).
 *
 * The display metadata (`preset.yml` next to the composition, which the
 * agent-preset picker reads for its name/description) is written with the
 * generated preset so the card does not read "no description".
 *
 * Usage:
 *   node src/setup.js [--src <preset agent.cordis.yml>]
 *   DSH_QWEN38_PRESET_SRC=<path> node src/setup.js
 *
 * @module dsh-qwen38-local-qol/setup
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The user preset directory, relative to the DSH home (`.agent-presets`). */
export const USER_PRESET_DIR = '.agent-presets'
/** The generated preset id (the directory name; shown in the GUI preset selector). */
export const PRESET_ID = 'qwen38-qol'
/** The backend row id inside the preset's compaction group. */
export const BACKEND_ROW_ID = 'compaction-basic'
/**
 * The package this backend row must name. The row targets the `./backend`
 * subpath, not the package root: the root entry is the function plugin (the
 * provider route registration), while the compaction row needs the package's
 * default-exported service class, which the exports map publishes under
 * `./backend`.
 */
export const BACKEND_PACKAGE = 'dsh-qwen38-local-qol/backend'
/** The stock config value pinned on the backend row (8192 truncates long local checkpoints; 16384 proved tight on the 125B line). */
export const BACKEND_MAX_TOKENS = 24576
/** The user settings file at the DSH home root. */
export const SETTINGS_FILE = 'settings.yaml'
/** The settings section that carries the default agent preset. */
export const AGENT_PRESETS_SECTION = 'agent-presets'
/** The key inside that section. */
export const DEFAULT_KEY = 'default'
/** The display-metadata file beside a preset's composition (the agent-preset picker reads name/description/order from it). */
export const PRESET_METADATA_FILE = 'preset.yml'
/** The description the generated preset publishes about itself (bilingual; the picker shows one unlocalized string for user presets). */
export const PRESET_DESCRIPTION = '标准模式 + 自定义压缩 · Standard mode + custom compaction'

/**
 * Resolve the DSH home directory.
 * @param env - environment to read; defaults to `process.env`.
 * @returns the absolute DSH home path.
 */
export function resolveDshHome(env = process.env) {
  const home = env.DSH_HOME && String(env.DSH_HOME).trim() !== '' ? String(env.DSH_HOME).trim() : join(homedir(), '.dsh')
  return home
}

/**
 * Find the `name:` line that belongs to the first `- id: compaction-basic`
 * block: the next line, at the same or deeper indent, starting with `name:`.
 * @param lines - the split preset text.
 * @param idLine - the index of the `- id: compaction-basic` line.
 * @returns the index of the name line.
 */
export function findNameLine(lines, idLine) {
  for (let i = idLine + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*- id:/.test(line)) throw new Error('dsh-qwen38-local-qol: setup: the compaction-basic row has no name: line')
    if (/^\s*name:/.test(line)) return i
  }
  throw new Error('dsh-qwen38-local-qol: setup: the compaction-basic row has no name: line')
}

/**
 * Rewrite the preset text so the compaction-basic row names this package's
 * backend and pins `maxTokens`. Strict anchors: exactly one `- id:
 * compaction-basic` row, exactly one following `name:` line; anything else
 * fails loud instead of writing a wrong preset.
 * @param text - the standard preset's agent.cordis.yml content.
 * @returns the rewritten preset text.
 */
export function transformPreset(text) {
  const lines = text.split('\n')
  const idLines = lines.map((line, i) => (/^\s*- id:\s*compaction-basic\s*$/.test(line) ? i : -1)).filter((i) => i !== -1)
  if (idLines.length === 0) {
    throw new Error('dsh-qwen38-local-qol: setup: no "- id: compaction-basic" row found; is the source preset a DSH agent preset?')
  }
  if (idLines.length > 1) {
    throw new Error(`dsh-qwen38-local-qol: setup: found ${idLines.length} "compaction-basic" rows; expected exactly one`)
  }
  const nameLine = findNameLine(lines, idLines[0])
  const indent = lines[nameLine].match(/^\s*/)[0]
  lines[nameLine] = `${indent}name: ${BACKEND_PACKAGE}`

  // Pin maxTokens unless the block already carries a config section.
  const blockEnd = lines.findIndex((line, i) => i > nameLine && /^\s*- id:/.test(line))
  const block = lines.slice(nameLine + 1, blockEnd === -1 ? lines.length : blockEnd)
  if (!block.some((line) => /^\s*config:/.test(line))) {
    lines.splice(nameLine + 1, 0, `${indent}config:`, `${indent}  maxTokens: ${BACKEND_MAX_TOKENS}`)
  }
  return lines.join('\n')
}

/**
 * Merge `agent-presets: { default: qwen38-qol }` into a `settings.yaml`
 * text. Strict anchors: at most one top-level `agent-presets:` block line and
 * at most one `default:` key inside it; an inline value, a duplicated
 * section, or a duplicated key fails loud instead of writing a guess. Line
 * endings are preserved on replace. Idempotent: an existing
 * `default: qwen38-qol` returns the text unchanged.
 * @param text - the settings.yaml content; '' for a missing or empty file.
 * @returns the new text and what changed: 'created', 'appended', 'replaced',
 *   or 'none'.
 */
export function applyDefaultPreset(text) {
  const lines = text.split('\n')
  const sectionIndices = []
  for (let i = 0; i < lines.length; i += 1) {
    if (/^agent-presets:/.test(lines[i])) sectionIndices.push(i)
  }
  if (sectionIndices.length > 1) {
    throw new Error('dsh-qwen38-local-qol: setup: settings.yaml has two top-level agent-presets sections; remove one and re-run')
  }
  if (sectionIndices.length === 1) {
    const sectionIndex = sectionIndices[0]
    if (!/^agent-presets:\s*$/.test(lines[sectionIndex])) {
      throw new Error('dsh-qwen38-local-qol: setup: settings.yaml carries an inline agent-presets entry (for example "agent-presets: {}"); make it a plain block and re-run')
    }
    let sectionEnd = lines.length
    for (let i = sectionIndex + 1; i < lines.length; i += 1) {
      if (/^[^\s#]/.test(lines[i])) {
        sectionEnd = i
        break
      }
    }
    const defaultIndices = []
    for (let i = sectionIndex + 1; i < sectionEnd; i += 1) {
      if (/^\s+default:\s*\S/.test(lines[i])) defaultIndices.push(i)
    }
    if (defaultIndices.length > 1) {
      throw new Error('dsh-qwen38-local-qol: setup: the agent-presets section has more than one default key; remove one and re-run')
    }
    if (defaultIndices.length === 1) {
      const match = lines[defaultIndices[0]].match(/^(\s*)default:(\s*)(\S+)\s*$/)
      if (match[3] === PRESET_ID) return { text, changed: 'none' }
      const eol = /\r$/.test(lines[defaultIndices[0]]) ? '\r' : ''
      lines[defaultIndices[0]] = `${match[1]}default:${match[2]}${PRESET_ID}${eol}`
      return { text: lines.join('\n'), changed: 'replaced' }
    }
    const eol = /\r$/.test(lines[sectionIndex]) ? '\r' : ''
    lines.splice(sectionIndex + 1, 0, `  ${DEFAULT_KEY}: ${PRESET_ID}${eol}`)
    return { text: lines.join('\n'), changed: 'appended' }
  }
  const eol = /\r\n/.test(text) ? '\r\n' : '\n'
  let base = text
  if (base !== '' && !/[\r\n]$/.test(base)) base += '\n'
  return {
    text: base + `${AGENT_PRESETS_SECTION}:${eol}  ${DEFAULT_KEY}: ${PRESET_ID}${eol}`,
    changed: text.trim() === '' ? 'created' : 'appended',
  }
}

/**
 * Write the default agent preset into the DSH home's settings.yaml. A dated
 * backup of the file is written before a change; an already-set default is
 * left untouched, so re-runs are idempotent.
 * @param dshHome - the DSH home directory.
 * @returns the settings file path and what changed ('created', 'appended',
 *   'replaced', or 'none').
 */
export function ensureDefaultPreset(dshHome) {
  const path = join(dshHome, SETTINGS_FILE)
  const text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const { text: next, changed } = applyDefaultPreset(text)
  if (changed !== 'none') {
    if (existsSync(path)) copyFileSync(path, `${path}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    writeFileSync(path, next)
  }
  return { path, changed }
}

/**
 * Render the preset.yml document published beside the generated composition.
 * @returns the YAML text (the description key only; the picker falls back to
 *   the preset id for the name).
 */
export function renderPresetMetadata() {
  return `description: ${PRESET_DESCRIPTION}\n`
}

/**
 * Run the generator: write the user preset, publish its display metadata,
 * then set it as the default agent preset in the DSH home's settings.yaml.
 * @param options - CLI options.
 * @param options.src - explicit path to the installed standard preset's agent.cordis.yml.
 * @param options.home - DSH home override (defaults to env DSH_HOME or ~/.dsh).
 * @returns the written preset path, the settings file path, and what the
 *   default step changed ('created', 'appended', 'replaced', or 'none').
 */
export function generatePreset({ src, home } = {}) {
  const dshHome = home ?? resolveDshHome()
  const source = src ?? process.env.DSH_QWEN38_PRESET_SRC
  if (!source || !existsSync(source)) {
    throw new Error(
      'dsh-qwen38-local-qol: setup: no preset source found; pass --src <agent.cordis.yml> '
      + 'or set DSH_QWEN38_PRESET_SRC (the installed @deepseek-ai/dsh-agent-presets '
      + 'presets/standard/agent.cordis.yml)',
    )
  }
  const text = readFileSync(source, 'utf8')
  const transformed = transformPreset(text)
  const dir = join(dshHome, USER_PRESET_DIR, PRESET_ID)
  const target = join(dir, 'agent.cordis.yml')
  if (existsSync(target)) {
    copyFileSync(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(target, transformed)
  const metadataTarget = join(dir, PRESET_METADATA_FILE)
  if (existsSync(metadataTarget)) {
    copyFileSync(metadataTarget, `${metadataTarget}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  }
  writeFileSync(metadataTarget, renderPresetMetadata())
  const { path: settings, changed } = ensureDefaultPreset(dshHome)
  return { preset: target, settings, defaultChanged: changed }
}

const argv = process.argv.slice(2)
const srcFlag = argv.indexOf('--src')
const cliSrc = srcFlag !== -1 ? argv[srcFlag + 1] : undefined
if (process.argv[1] && process.argv[1].endsWith('setup.js')) {
  try {
    const { preset, settings, defaultChanged } = generatePreset({ src: cliSrc })
    console.log(`dsh-qwen38-local-qol: preset written to ${preset}`)
    if (defaultChanged === 'none') {
      console.log(`dsh-qwen38-local-qol: the default agent preset is already "${PRESET_ID}" — ${settings} left as is.`)
    } else {
      console.log(`dsh-qwen38-local-qol: default agent preset set to "${PRESET_ID}" in ${settings} — new sessions use it automatically.`)
    }
    console.log(`dsh-qwen38-local-qol: existing sessions keep their preset — select "${PRESET_ID}" in the GUI to switch one.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
