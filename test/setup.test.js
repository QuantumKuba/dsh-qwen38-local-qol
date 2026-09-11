/**
 * The preset generator: row swap, maxTokens pinning, strict-anchor failure,
 * and the default-preset settings.yaml merge.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  transformPreset,
  findNameLine,
  BACKEND_PACKAGE,
  BACKEND_MAX_TOKENS,
  applyDefaultPreset,
  PRESET_ID,
} from '../src/setup.js'

const PRESET = [
  '- id: agent',
  '  name: cordis:group',
  '  group: true',
  '  config:',
  '    - id: persona',
  '      name: "@deepseek-ai/dsh-system-prompt"',
  '- id: compaction',
  '  name: cordis:group',
  '  group: true',
  '  isolate:',
  '    compaction: true',
  '    toolResultPruner: true',
  '  config:',
  '    - id: compaction-basic',
  '      name: \'@deepseek-ai/dsh-compaction-basic\'',
  '    - id: command-compact',
  '      name: \'@deepseek-ai/dsh-command-compact\'',
  '    - id: tool-result-pruner',
  '      name: \'@deepseek-ai/dsh-compaction-tool-result-pruner\'',
  '      config:',
  '        thresholdChars: 8192',
  '- id: todo',
  '  name: "@deepseek-ai/dsh-tool-todo"',
  '',
].join('\n')

test('transformPreset: swaps the backend name and pins maxTokens', () => {
  const out = transformPreset(PRESET)
  const lines = out.split('\n')
  const idIndex = lines.findIndex((line) => line.trim() === '- id: compaction-basic')
  assert.ok(idIndex !== -1)
  assert.equal(lines[idIndex + 1], `      name: ${BACKEND_PACKAGE}`)
  assert.equal(lines[idIndex + 2], '      config:')
  assert.equal(lines[idIndex + 3], `        maxTokens: ${BACKEND_MAX_TOKENS}`)
  // the rest of the preset is untouched
  assert.ok(out.includes("- id: command-compact"))
  assert.ok(out.includes('thresholdChars: 8192'))
  assert.ok(out.includes('- id: todo'))
})

test('transformPreset: existing config block is not duplicated', () => {
  const withConfig = PRESET
    .split('\n')
    .join('\n')
    .replace('      name: \'@deepseek-ai/dsh-compaction-basic\'\n', '      name: \'@deepseek-ai/dsh-compaction-basic\'\n      config:\n        maxTokens: 16384\n')
  const out = transformPreset(withConfig)
  const count = out.split('\n').filter((line) => line.trim() === 'config:').length
  // agent group's config:, compaction group's config:, the backend block's
  // pre-existing config:, and the pruner's config: — the transform added none.
  assert.equal(count, 4)
  assert.ok(out.includes(`name: ${BACKEND_PACKAGE}`))
  // exactly one maxTokens line: the pre-existing one survived, none was added
  assert.equal(out.match(/maxTokens/g)?.length, 1)
})

test('transformPreset: fails loud on missing or duplicate rows', () => {
  assert.throws(() => transformPreset('- id: other\n  name: x\n'), /no "- id: compaction-basic" row/)
  const doubled = `${PRESET}\n    - id: compaction-basic\n      name: y\n`
  assert.throws(() => transformPreset(doubled), /found 2 "compaction-basic" rows/)
})

test('findNameLine: fails when the next row starts before a name line', () => {
  const lines = ['- id: compaction-basic', '- id: next', '  name: x']
  const idLine = 0
  assert.throws(() => findNameLine(lines, idLine), /no name: line/)
  const lines2 = ['- id: compaction-basic', '  name: y', '  config: {}']
  assert.equal(findNameLine(lines2, 0), 1)
})

test('applyDefaultPreset: creates the section in an empty file', () => {
  const { text, changed } = applyDefaultPreset('')
  assert.equal(changed, 'created')
  assert.equal(text, 'agent-presets:\n  default: qwen38-qol\n')
})

test('applyDefaultPreset: appends the section below existing content', () => {
  const existing = 'ui-theme:\n  preference: dark\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.ok(text.startsWith(existing))
  assert.ok(text.endsWith(`agent-presets:\n  default: ${PRESET_ID}\n`))
})

test('applyDefaultPreset: appends to a file without a trailing newline', () => {
  const { text, changed } = applyDefaultPreset('ui-theme:\n  preference: dark')
  assert.equal(changed, 'appended')
  assert.equal(text, 'ui-theme:\n  preference: dark\nagent-presets:\n  default: qwen38-qol\n')
})

test('applyDefaultPreset: replaces a foreign default inside the section', () => {
  const existing = 'agent-presets:\n  default: standard\n  enabled: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'replaced')
  assert.equal(text, `agent-presets:\n  default: ${PRESET_ID}\n  enabled: true\nlocale:\n  preference: zh\n`)
})

test('applyDefaultPreset: inserts a missing default into an existing section', () => {
  const existing = 'agent-presets:\n  enabled: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.equal(text, `agent-presets:\n  default: ${PRESET_ID}\n  enabled: true\nlocale:\n  preference: zh\n`)
})

test('applyDefaultPreset: no-op when the default already matches', () => {
  const existing = `agent-presets:\n  default: ${PRESET_ID}\n`
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'none')
  assert.equal(text, existing)
})

test('applyDefaultPreset: preserves CRLF line endings on replace', () => {
  const existing = 'agent-presets:\r\n  default: standard\r\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'replaced')
  assert.equal(text, `agent-presets:\r\n  default: ${PRESET_ID}\r\n`)
})

test('applyDefaultPreset: uses CRLF when appending to a CRLF file', () => {
  const existing = 'ui-theme:\r\n  preference: dark\r\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.equal(text, `ui-theme:\r\n  preference: dark\r\nagent-presets:\r\n  default: ${PRESET_ID}\r\n`)
})

test('applyDefaultPreset: fails loud on an inline agent-presets entry', () => {
  assert.throws(() => applyDefaultPreset('agent-presets: {}\n'), /inline agent-presets entry/)
})

test('applyDefaultPreset: fails loud on a duplicated section', () => {
  assert.throws(() => applyDefaultPreset('agent-presets:\nagent-presets:\n'), /two top-level agent-presets sections/)
})

test('applyDefaultPreset: fails loud on a duplicated default key', () => {
  assert.throws(() => applyDefaultPreset('agent-presets:\n  default: standard\n  default: qwen38-qol\n'), /more than one default key/)
})

test('applyDefaultPreset: leaves a nested agent-presets key alone', () => {
  const existing = 'plugins:\n  agent-presets: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.ok(text.includes('plugins:\n  agent-presets: true'))
})
