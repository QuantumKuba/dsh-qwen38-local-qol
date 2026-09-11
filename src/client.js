/**
 * Browser half: the "Qwen3.8 Local" settings tab.
 *
 * One page in the host's settings dialog, beside the other sections. It
 * reads and writes the plugin's user-settings namespace through the settings
 * Remote: `describe()` for the current value, revision, and writability;
 * `update()` with the held revision for a write, folding the answered view
 * back so a concurrent editor (the settings document on disk, another
 * browser) is surfaced as a conflict and re-read, never silently overwritten.
 *
 * Styled the way the host's own settings sections are: the shared
 * `@deepseek-ai/dsh-client-ui-primitives` controls (Button, Input, Switch,
 * StateDot) and the `--dsw-alias-*` design tokens; the page sheet is
 * `client.css` (`qol-` prefixed classes, no CSS Modules) which the browser
 * entry (`client-entry.js`) injects once as a `<style>` tag.
 *
 * The source is `React.createElement` (no JSX) and is built by
 * `scripts/build-client.mjs` (esbuild entry `src/client-entry.js`, `react`
 * and the primitives package left external — the module table supplies both
 * identities) into the DSH client-module format — a self-registering classic
 * script — committed as `lib/client.js`. The dialect selector is the headline
 * control — it switches the thinking wire (NInfer vs llama-server) for every
 * request the plugin route serves.
 *
 * @module dsh-qwen38-local-qol/client
 */
import * as React from 'react'
import { Button, Input, StateDot, Switch } from '@deepseek-ai/dsh-client-ui-primitives'

/** The settings namespace this tab edits (mirrors the host's `NS`). */
const NS = 'qwen38-local-qol'

/** The generated preset id (mirrors the host's `PRESET_ID`). */
const PRESET_ID = 'qwen38-qol'

const COPY = {
  en: {
    title: 'Qwen3.8 Local',
    line: 'Server line',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    connection: 'Connection',
    baseURL: 'Server base URL',
    model: 'Model id',
    displayName: 'Display name',
    window: 'Window and output',
    contextWindow: 'Context window (tokens)',
    maxTokens: 'Output cap (tokens)',
    thinking: 'Thinking budgets',
    thinkingAll: 'All efforts',
    thinkingHintNinfer: 'Per-effort thinking budgets are not supported on NInfer (ninfer as of 2026-09-02; ninfer-windows 0.5.0).',
    thinkingHintLlamacpp: 'Hard per-effort thinking-token caps. llama.cpp honors reasoning_budget_tokens per request; the selected level\'s value overrides the server\'s --reasoning-budget flag.',
    compaction: 'Compaction prefill trim',
    summarizeImages: 'Images in the summarizer prefill',
    summarizeHint: 'Off strips images in the summarizer prefill to text placeholders (prefer with mmproj offload).',
    keepTurns: 'Keep reasoning of the last N turns',
    toolChars: 'Tool-result character cap (0 = off)',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    loading: 'Loading…',
    notFound: 'This plugin is not registered a settings section on the host side (restart DSH web after installing the plugin, then open this page again).',
    conflict: 'Someone else changed these settings while you were editing. Your edits were discarded; the current values are shown.',
    invalidNumber: 'Every number field must be a positive whole number.',
    remoteError: 'Settings request failed: ',
    compactionNotSet: 'Local compaction is not set up — the trim controls below apply once the qwen38-qol preset is generated (one-time setup, see the plugin README).',
    compactionActive: 'Local compaction is active for new sessions (default preset: qwen38-qol).',
    compactionAvailable: 'Local compaction is available, but the default preset is "{default}" — new sessions use standard compaction. Select qwen38-qol on the Agent presets page to enable it.',
    compactionHint: 'The trim controls apply to sessions using the qwen38-qol preset.',
  },
  zh: {
    title: 'Qwen3.8 本地',
    line: '服务器线',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    connection: '连接',
    baseURL: '服务器地址',
    model: '模型 id',
    displayName: '显示名',
    window: '窗口与输出',
    contextWindow: '上下文窗口（token）',
    maxTokens: '输出上限（token）',
    thinking: 'Thinking 预算',
    thinkingAll: '全部 effort',
    thinkingHintNinfer: 'NInfer 不支持按 effort 的 thinking 预算（ninfer as of 2026-09-02；ninfer-windows 0.5.0）。',
    thinkingHintLlamacpp: '各 effort 档的 thinking token 硬帽。llama.cpp 逐请求按所选档携带 reasoning_budget_tokens，覆盖服务端 --reasoning-budget 参数。',
    compaction: '压缩预填充裁剪',
    summarizeImages: '摘要预填充里的图片',
    summarizeHint: '关闭 = 摘要预填充里的图片替换为文本占位符（mmproj offload 时优选）。',
    keepTurns: '保留最近 N 轮的 reasoning',
    toolChars: '工具结果字数帽（0 = 关）',
    save: '保存',
    saving: '保存中…',
    saved: '已保存',
    loading: '加载中…',
    notFound: '宿主侧未注册该插件的设置命名空间（装完插件后重启 DSH web，再打开本页面）。',
    conflict: '编辑期间他人修改了这些设置。你的改动已丢弃，当前显示的是最新值。',
    invalidNumber: '所有数字字段必须是正整数。',
    remoteError: '设置请求失败：',
    compactionNotSet: '本地压缩未启用——生成 qwen38-qol 预设（一次性 setup，见插件 README）后，下方裁剪设置才会生效。',
    compactionActive: '本地压缩对新会话生效（默认预设：qwen38-qol）。',
    compactionAvailable: '本地压缩可用，但默认预设是 "{default}"——新会话走标准压缩。在 Agent 预设页选择 qwen38-qol 启用。',
    compactionHint: '裁剪设置仅对 qwen38-qol 预设的会话生效。',
  },
}

/**
 * The compaction wiring status line for the settings tab: whether the local
 * compaction backend is actually reachable by new sessions.
 * @param status - the host-computed `{ presetGenerated, defaultPreset }`
 *   (undefined when the section predates the status field).
 * @param t - the locale copy.
 * @returns the status sentence (the available state substitutes the preset id).
 */
export function compactionStatusCopy(status, t) {
  if (status === undefined || status.presetGenerated !== true) return t.compactionNotSet
  if (status.defaultPreset === PRESET_ID) return t.compactionActive
  return t.compactionAvailable.replace('{default}', String(status.defaultPreset))
}

/**
 * The StateDot state of the compaction wiring line, so the state reads at a
 * glance instead of parsing the sentence: green done when the local
 * compaction preset is the default, amber warning when the preset exists but
 * is not the default, grey idle when it has not been generated.
 * @param status - the host-computed `{ presetGenerated, defaultPreset }`.
 * @returns the `StateDot` state ('done' | 'warning' | 'idle').
 */
export function compactionStatusState(status) {
  if (status === undefined || status.presetGenerated !== true) return 'idle'
  if (status.defaultPreset === PRESET_ID) return 'done'
  return 'warning'
}

/** One editable field row: the host field pattern — a 12px label over a control. */
function Field({ label, children }) {
  return React.createElement('div', { className: 'qol-field' },
    React.createElement('label', { className: 'qol-fieldLabel' }, label),
    children)
}

/**
 * Pull the editable draft out of a namespace view's resolved value.
 *
 * The connection fields are per-dialect (`lines`): the draft carries the
 * active line (baseURL/model/displayName) plus the parked other line, and the
 * dialect control swaps the two. Sections saved before `lines` existed carry
 * the connection only at the top level — detect that from the user layer and
 * migrate the top level into the active line instead of showing the schema
 * defaults on top of the user's saved values.
 *
 * The numeric fields fall back to the production line's values so a fresh
 * install (no user layer) is fill-once: only the connection fields may be
 * empty of meaning, everything else ships pre-filled.
 */
export function toDraft(value) {
  const dialect = value.dialect
  const other = dialect === 'ninfer' ? 'llamacpp' : 'ninfer'
  const legacy = (value.user ?? {}).lines === undefined
  const line = (name) => {
    const raw = value.lines?.[name]
    return {
      baseURL: raw?.baseURL ?? '',
      model: raw?.model ?? '',
      displayName: raw?.displayName ?? '',
      contextWindow: String(raw?.contextWindow ?? value.contextWindow ?? 229376),
      maxTokens: String(raw?.maxTokens ?? value.maxTokens ?? 24576),
      low: String(raw?.thinkingBudgets?.low ?? value.thinkingBudgets?.low ?? 4096),
      medium: String(raw?.thinkingBudgets?.medium ?? value.thinkingBudgets?.medium ?? 8192),
      xhigh: String(raw?.thinkingBudgets?.xhigh ?? value.thinkingBudgets?.xhigh ?? 16384),
      defaultThinkingBudget: String(raw?.defaultThinkingBudget ?? value.defaultThinkingBudget ?? 16384),
      images: raw?.summarize?.images ?? value.summarize?.images ?? 'strip',
      keepTurns: String(raw?.summarize?.keepTurns ?? value.summarize?.keepTurns ?? 5),
      toolChars: String(raw?.summarize?.toolChars ?? value.summarize?.toolChars ?? 2000),
    }
  }
  const active = legacy
    ? {
      baseURL: value.baseURL ?? '',
      model: value.model ?? '',
      displayName: value.displayName ?? '',
      contextWindow: String(value.contextWindow ?? 229376),
      maxTokens: String(value.maxTokens ?? 24576),
      low: String(value.thinkingBudgets?.low ?? 4096),
      medium: String(value.thinkingBudgets?.medium ?? 8192),
      xhigh: String(value.thinkingBudgets?.xhigh ?? 16384),
      defaultThinkingBudget: String(value.defaultThinkingBudget ?? 16384),
      images: value.summarize?.images ?? 'strip',
      keepTurns: String(value.summarize?.keepTurns ?? 5),
      toolChars: String(value.summarize?.toolChars ?? 2000),
    }
    : line(dialect)
  const parked = line(other)
  return {
    dialect,
    baseURL: active.baseURL,
    model: active.model,
    displayName: active.displayName,
    contextWindow: active.contextWindow,
    maxTokens: active.maxTokens,
    low: active.low,
    medium: active.medium,
    xhigh: active.xhigh,
    parkedBaseURL: parked.baseURL,
    parkedModel: parked.model,
    parkedDisplayName: parked.displayName,
    parkedContextWindow: parked.contextWindow,
    parkedMaxTokens: parked.maxTokens,
    parkedLow: parked.low,
    parkedMedium: parked.medium,
    parkedXhigh: parked.xhigh,
    defaultBudget: active.defaultThinkingBudget,
    images: active.images,
    keepTurns: active.keepTurns,
    toolChars: active.toolChars,
    parkedDefaultBudget: parked.defaultThinkingBudget,
    parkedImages: parked.images,
    parkedKeepTurns: parked.keepTurns,
    parkedToolChars: parked.toolChars,
  }
}

/** The section entry: locale follows the host observable; data rides the inject face. */
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => (snapshot.active === 'zh' ? 'zh' : 'en'))
  const t = COPY[locale]
  const [state, setState] = React.useState({ status: 'loading', error: null, view: null, draft: null, busy: false, saved: false, agentPresets: null })

  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }))

  // Switching the server line: the active connection fields and the parked
  // (other dialect's) fields trade places, so each line remembers its own
  // baseURL/model/displayName across switches and back.
  const switchDialect = (next) => {
    setState((s) => {
      if (s.draft === null || s.draft.dialect === next) return s
      const d = s.draft
      return {
        ...s,
        saved: false,
        draft: {
          ...d,
          dialect: next,
          baseURL: d.parkedBaseURL,
          model: d.parkedModel,
          displayName: d.parkedDisplayName,
          contextWindow: d.parkedContextWindow,
          maxTokens: d.parkedMaxTokens,
          low: d.parkedLow,
          medium: d.parkedMedium,
          xhigh: d.parkedXhigh,
          parkedBaseURL: d.baseURL,
          parkedModel: d.model,
          parkedDisplayName: d.displayName,
          parkedContextWindow: d.contextWindow,
          parkedMaxTokens: d.maxTokens,
          parkedLow: d.low,
          parkedMedium: d.medium,
          parkedXhigh: d.xhigh,
          defaultBudget: d.parkedDefaultBudget,
          images: d.parkedImages,
          keepTurns: d.parkedKeepTurns,
          toolChars: d.parkedToolChars,
          parkedDefaultBudget: d.defaultBudget,
          parkedImages: d.images,
          parkedKeepTurns: d.keepTurns,
          parkedToolChars: d.toolChars,
        },
      }
    })
  }

  React.useEffect(() => {
    let alive = true
    load().then((result) => {
      if (!alive) return
      if (result.ok) setState({ status: 'ready', error: null, view: result.value, draft: toDraft(result.value.value), busy: false, saved: false, agentPresets: result.agentPresets ?? null })
      else setState({ status: 'error', error: result.ok === false && result.error === 'ns-missing' ? t.notFound : result.error, view: null, draft: null, busy: false, saved: false })
    }).catch((error) => {
      if (!alive) return
      setState({ status: 'error', error: t.remoteError + (error instanceof Error ? error.message : String(error)), view: null, draft: null, busy: false, saved: false })
    })
    return () => { alive = false }
    // The page mounts once; reloads happen through explicit actions.
  }, [])

  const doSave = async () => {
    const { view, draft } = state
    const numbers = [
      draft.contextWindow, draft.maxTokens, draft.low, draft.medium, draft.xhigh,
      draft.parkedContextWindow, draft.parkedMaxTokens, draft.parkedLow, draft.parkedMedium, draft.parkedXhigh,
      draft.defaultBudget, draft.keepTurns, draft.toolChars,
      draft.parkedDefaultBudget, draft.parkedKeepTurns, draft.parkedToolChars,
    ]
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }))
      return
    }
    setState((s) => ({ ...s, busy: true, error: null }))
    // The top-level fields are what the adapter and the compaction backend
    // read (the active line); `lines` persists both lines — connection, window
    // numbers, the thinking budget, AND the trim knobs (the context window is a
    // property of the line's server build, not the model) — so switching
    // dialect and back restores each one's values.
    const otherDialect = draft.dialect === 'ninfer' ? 'llamacpp' : 'ninfer'
    const lineBlock = (baseURL, model, displayName, contextWindow, maxTokens, low, medium, xhigh, defaultBudget, images, keepTurns, toolChars) => ({
      baseURL,
      model,
      displayName,
      contextWindow: Number.parseInt(contextWindow, 10),
      maxTokens: Number.parseInt(maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(low, 10),
        medium: Number.parseInt(medium, 10),
        xhigh: Number.parseInt(xhigh, 10),
      },
      defaultThinkingBudget: Number.parseInt(defaultBudget, 10),
      summarize: {
        images,
        keepTurns: Number.parseInt(keepTurns, 10),
        toolChars: Number.parseInt(toolChars, 10),
      },
    })
    const patch = {
      dialect: draft.dialect,
      baseURL: draft.baseURL,
      model: draft.model,
      displayName: draft.displayName,
      lines: {
        [draft.dialect]: lineBlock(draft.baseURL, draft.model, draft.displayName, draft.contextWindow, draft.maxTokens, draft.low, draft.medium, draft.xhigh, draft.defaultBudget, draft.images, draft.keepTurns, draft.toolChars),
        [otherDialect]: lineBlock(draft.parkedBaseURL, draft.parkedModel, draft.parkedDisplayName, draft.parkedContextWindow, draft.parkedMaxTokens, draft.parkedLow, draft.parkedMedium, draft.parkedXhigh, draft.parkedDefaultBudget, draft.parkedImages, draft.parkedKeepTurns, draft.parkedToolChars),
      },
      contextWindow: Number.parseInt(draft.contextWindow, 10),
      maxTokens: Number.parseInt(draft.maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(draft.low, 10),
        medium: Number.parseInt(draft.medium, 10),
        xhigh: Number.parseInt(draft.xhigh, 10),
      },
      defaultThinkingBudget: Number.parseInt(draft.defaultBudget, 10),
      summarize: {
        images: draft.images,
        keepTurns: Number.parseInt(draft.keepTurns, 10),
        toolChars: Number.parseInt(draft.toolChars, 10),
      },
    }
    const result = await save(view, patch)
    if (result.ok) {
      setState((s) => ({ ...s, busy: false, saved: true, view: result.value, draft: toDraft(result.value.value) }))
    } else if (result.code === 'settings/conflict') {
      const fresh = await load()
      if (fresh.ok) setState({ status: 'ready', error: t.conflict, view: fresh.value, draft: toDraft(fresh.value.value), busy: false, saved: false, agentPresets: fresh.agentPresets ?? null })
      else setState((s) => ({ ...s, busy: false, error: t.remoteError + fresh.error }))
    } else {
      setState((s) => ({ ...s, busy: false, error: t.remoteError + result.error }))
    }
  }

  if (state.status === 'loading') {
    return React.createElement('div', { className: 'qol' }, t.loading)
  }
  if (state.status === 'error') {
    return React.createElement('div', { className: 'qol' }, state.error)
  }
  const { view, draft } = state
  // The status line: the startup snapshot (the section base) with the live
  // agent-presets default from the same describe response — a default change
  // shows up without a restart.
  const compaction = {
    presetGenerated: (view.value.compaction ?? { presetGenerated: false }).presetGenerated,
    defaultPreset: state.agentPresets?.defaultPreset ?? view.value.compaction?.defaultPreset ?? 'standard',
  }
  const ninfer = draft.dialect === 'ninfer'
  return React.createElement('div', { className: 'qol' },
    React.createElement('h2', { className: 'qol-title' }, t.title),
    state.error !== null
      ? React.createElement('p', { className: 'qol-error', role: 'alert' }, state.error)
      : null,
    // Server line: the headline control — it switches the thinking wire for
    // every request the plugin route serves.
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.line),
      React.createElement('div', { className: 'qol-radioRow' },
        ['llamacpp', 'ninfer'].map((dialect) =>
          React.createElement('label', { key: dialect, className: 'qol-radio' },
            React.createElement('input', {
              type: 'radio',
              name: 'qwen38-dialect',
              checked: draft.dialect === dialect,
              onChange: () => { switchDialect(dialect) },
            }),
            dialect === 'ninfer' ? t.dialectNinfer : t.dialectLlamacpp,
          ),
        ),
      ),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.connection),
      React.createElement(Field, { label: t.baseURL },
        React.createElement(Input, { className: 'qol-input', value: draft.baseURL, onChange: (e) => { setDraft({ baseURL: e.target.value }) } })),
      React.createElement(Field, { label: t.model },
        React.createElement(Input, { className: 'qol-input', value: draft.model, onChange: (e) => { setDraft({ model: e.target.value }) } })),
      React.createElement(Field, { label: t.displayName },
        React.createElement(Input, { className: 'qol-input', value: draft.displayName, onChange: (e) => { setDraft({ displayName: e.target.value }) } })),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.window),
      React.createElement('div', { className: 'qol-row2' },
        React.createElement(Field, { label: t.contextWindow },
          React.createElement(Input, { className: 'qol-input', value: draft.contextWindow, onChange: (e) => { setDraft({ contextWindow: e.target.value }) } })),
        React.createElement(Field, { label: t.maxTokens },
          React.createElement(Input, { className: 'qol-input', value: draft.maxTokens, onChange: (e) => { setDraft({ maxTokens: e.target.value }) } })),
      ),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.thinking),
      ninfer
        ? React.createElement(Field, { label: t.thinkingAll },
          React.createElement(Input, { className: 'qol-input', value: draft.defaultBudget, onChange: (e) => { setDraft({ defaultBudget: e.target.value }) } }))
        : null,
      React.createElement('div', { className: ninfer ? 'qol-row3 qol-muted' : 'qol-row3' },
        ['low', 'medium', 'xhigh'].map((effort) =>
          React.createElement(Field, { key: effort, label: effort },
            React.createElement(Input, { className: 'qol-input', disabled: ninfer, value: draft[effort], onChange: (e) => { setDraft({ [effort]: e.target.value }) } })),
        ),
      ),
      React.createElement('p', { className: 'qol-hint' }, ninfer ? t.thinkingHintNinfer : t.thinkingHintLlamacpp),
    ),
    // Compaction: the wiring status first (the trim controls only apply to
    // sessions using the qwen38-qol preset), then the trim knobs.
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.compaction),
      React.createElement('div', { className: 'qol-statusRow' },
        React.createElement(StateDot, { state: compactionStatusState(compaction), className: 'qol-statusDot' }),
        compactionStatusCopy(compaction, t),
      ),
      React.createElement('p', { className: 'qol-hint' }, t.compactionHint),
      React.createElement('div', { className: 'qol-field' },
        React.createElement('div', { className: 'qol-switchHead' },
          React.createElement('span', { className: 'qol-switchLabel' }, t.summarizeImages),
          React.createElement(Switch, {
            checked: draft.images === 'keep',
            onChange: (next) => { setDraft({ images: next ? 'keep' : 'strip' }) },
            label: t.summarizeImages,
          }),
        ),
        React.createElement('p', { className: 'qol-hint' }, t.summarizeHint),
      ),
      React.createElement('div', { className: 'qol-row2' },
        React.createElement(Field, { label: t.keepTurns },
          React.createElement(Input, { className: 'qol-input', value: draft.keepTurns, onChange: (e) => { setDraft({ keepTurns: e.target.value }) } })),
        React.createElement(Field, { label: t.toolChars },
          React.createElement(Input, { className: 'qol-input', value: draft.toolChars, onChange: (e) => { setDraft({ toolChars: e.target.value }) } })),
      ),
    ),
    React.createElement('div', { className: 'qol-footer' },
      React.createElement(Button, { variant: 'primary', disabled: state.busy, onClick: () => { void doSave() } }, state.busy ? t.saving : t.save),
      state.saved ? React.createElement('span', { className: 'qol-saved' }, t.saved) : null,
      state.busy === false && view !== null
        ? React.createElement('span', { className: 'qol-rev' }, `r${view.revision}`)
        : null,
    ),
  )
}

/**
 * Register the settings page.
 * @param ctx - the client root context (slots and the settings Remote).
 */
export function apply(ctx) {
  const locale = () => (ctx.locale.getSnapshot().active === 'zh' ? 'zh' : 'en')
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'qwen38-local-qol',
      order: 90,
      label: () => (locale() === 'en' ? 'Qwen3.8 Local' : 'Qwen3.8 本地'),
      inject: () => ({
        hooks: { locale: ctx.locale },
        load: async () => {
          const response = await ctx.remote.settings.describe()
          if (response.ok !== true) return { ok: false, error: response.error.message }
          const view = response.value.namespaces.find((entry) => entry.ns === NS)
          if (view === undefined) return { ok: false, error: 'ns-missing' }
          const presets = response.value.namespaces.find((entry) => entry.ns === 'agent-presets')
          return {
            ok: true,
            value: view,
            agentPresets: presets === undefined ? null : { revision: presets.revision, defaultPreset: presets.value?.default ?? null },
          }
        },
        save: async (view, patch) => {
          const response = await ctx.remote.settings.update(NS, patch, view.revision)
          if (response.ok !== true) return { ok: false, code: response.error.code, error: response.error.message }
          return { ok: true, value: response.value }
        },
      }),
    },
    QwenLocalSectionEntry,
  ))
}

/** Plugin name, mirroring the host half. */
export const name = 'qwen38-local-qol'

/** Hard client dependencies. `remote` and the dotted `remote.settings` are Cordis client services — the gateway provides each Remote namespace under its dotted name, and the ctx proxy resolves `ctx.remote.settings` against that one; an undeclared service is absent from the plugin's ctx. */
export const inject = ['slots', 'locale', 'remote', 'remote.settings']
