# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

![The settings tab on the NInfer line — per-effort budgets greyed out, single all-efforts budget](docs/screenshot-ninfer-en.png)

A QoL plugin for DSH (DeepSeek Harness) for people running **Qwen3.8
locally** — **Qwen3.8-27B** on llama.cpp `llama-server` or on NInfer
([Neroued/ninfer](https://github.com/Neroued/ninfer) — source build or
self-built Docker image, as of 2026-09-02 — and the **ninfer-windows 0.5.0 /
0.6.x** native Windows builds; both serve the same OpenAI-compatible `/v1`
API, so one plugin config covers either), and, at the config level,
**Qwen3.8-Flash-Next** (same OpenAI-compatible wire, same dialect logic).

It gives stock DSH (no core patches, no pi-ai patchfile) two things the local
Qwen line needs:

1. **Per-request thinking budgets.** Each request carries the selected
   reasoning effort and its hard thinking-token cap: `llamacpp` dialect sends
   `chat_template_kwargs.reasoning_effort` + top-level
   `reasoning_budget_tokens` (llama.cpp's per-request budget, which overrides
   any `--reasoning-budget` CLI flag); `ninfer` dialect sends the top-level
   `reasoning_effort` (NInfer 0.5.0's effort whitelist; the budget field is
   sent but the server caps thinking with `--default-thinking-budget`).
   `off` sends `chat_template_kwargs.enable_thinking: false` — the toggle
   this llama.cpp build actually reads.
2. **A compaction backend that stops burning the output cap on thinking.**
   The stock engine's sole `summarize()` hook is overridden so the summarizer
   prefill is trimmed first (recent reasoning only, images stripped, tool
   results capped). Thinking-off and the output cap are enforced on the wire
   for every `purpose: 'compaction'` call regardless of the preset in use —
   the checkpoint gets the line's whole output cap instead of a truncated
   "incomplete checkpoint".

One package, three registrations:

| Registration | Seam | Mount |
|---|---|---|
| `QwenLocalAdapter` (provider route `qwen38`) | `ctx.llm.registerAdapter()` | the bundle patch (`cordis.patch.yml`) on the profile root |
| `QwenLocalCompaction` (compaction backend) | subclass of `@deepseek-ai/dsh-compaction-basic` | the generated **user preset** `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml` (the per-session agent preset owns the isolated compaction group; profile-level patches do not reach it) |
| settings tab (**Qwen3.8 Local**) | user-settings namespace `qwen38-local-qol` + the browser `settings.section` slot | the settings provider's `installSection` (host) and the plugin's `dsh.client` manifest (browser, the `./client` export) |

## Install

```sh
# same as any other plugin (add --profile <name> for a non-default profile):
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
# plugin-specific one-time step — generate the compaction user preset (with
# its picker description), AND set it as the default agent preset in
# ~/.dsh/settings.yaml (a dated backup of each file it changes, on re-run):
node_modules/dsh-qwen38-local-qol/src/setup.js --src <path to the installed @deepseek-ai/dsh-agent-presets presets/standard/agent.cordis.yml>
```

New sessions then use **`qwen38-qol`** automatically. Existing sessions keep
the preset they were created with — select **`qwen38-qol`** in the GUI to
switch one, or remove the `agent-presets:` section from `~/.dsh/settings.yaml`
to keep `standard` as the default.

`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config` shows
the composed provider row without booting.

## Update

```sh
# the plugin is a `github:` dependency; update re-resolves it against the
# default branch:
dsh plugin --profile web update dsh-qwen38-local-qol
```

If the profile lockfile still pins the commit the plugin was first installed
from (`github:` specs are resolution-pinned to an exact commit), force a fresh
resolution by re-installing:

```sh
dsh plugin --profile web remove dsh-qwen38-local-qol
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

Client-side changes ship as the committed `lib/client.js` build artifact (the
web loader serves the bundle, never `src/`), so consumers need no build step.
An update does not touch the generated user preset or the `qwen38-local-qol:`
settings section — re-running `setup.js` is only required when the preset
shape itself changes.

## Uninstall

```sh
# 1. remove the dependency (the profile's bundle stack reconciles itself
#    against the installed state):
dsh plugin --profile web remove dsh-qwen38-local-qol

# 2. delete the generated compaction user preset (created by setup.js):
rm -rf ~/.dsh/.agent-presets/qwen38-qol
# Windows: C:\Users\<you>\.dsh\.agent-presets\qwen38-qol

# 3. tidy settings.yaml — the preset default must go, the rest is optional:
#    - agent-presets: { default: qwen38-qol }  (written by setup.js, which kept
#      a settings.yaml.bak-* copy; a default pointing at a deleted preset
#      breaks preset resolution)
#    - the qwen38-local-qol: section block     (orphaned namespace; harmless if
#      left, cleaner removed)
#    - any DSH_QWEN38_* environment variables you set

# 4. restart the DSH host (plugin code loads at host start)
```

Uninstalling touches nothing else: session history, transcripts, your model
lines, and the engine are not plugin-owned state.

## Configuration

The provider row config (from the bundle patch or an overlay; an id-targeted
patch replaces the whole config object, so environment fallbacks apply to the
fields the patch leaves out):

| Field | Env fallback | Default | Meaning |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://localhost:8082/v1` | server base, including `/v1` |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | model id sent when a request omits one (the NInfer 0.5.0 artifact id — same for the Docker and the Windows build; verify against the running server with `GET /v1/models`; the llama.cpp line serves its own id — set this field or the env there) |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | the model id | human-readable name for the GUI model selector (the wire id is an artifact alias) |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | server `--api-key`, when set |
| `dialect` | `DSH_QWEN38_DIALECT` | `llamacpp` | `ninfer` or `llamacpp` (the thinking wire); a fresh install opens on the llama.cpp line — switch the line in the tab |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | declared context capacity (pressure compaction requires it) |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | declared per-request output cap |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | per-effort hard thinking budgets; the declared effort vocabulary is `off` + these keys (NInfer line: sent but ignored — the effective cap is `defaultThinkingBudget` / the server flag) |
| `defaultThinkingBudget` | — | `16384` | the NInfer line's effective thinking cap: the server's `--default-thinking-budget` flag value, one value for all efforts (the NInfer endpoint has no per-request budget field). Recorded by the settings tab — keep it in sync with the server startup flags |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | effort materialized into requests that omit one; must be `off` or a `thinkingBudgets` key. Declaring it (any value) suppresses the core selector's "Default" row, which is redundant with `off` on this line |
| `thinkingLevelMap` | — | identity | effort id → wire effort name |
| `includeUsage` | — | `true` | request `stream_options.include_usage`; the context meter and per-turn reasoning-token display read the server-reported usage (both dialects verified to honor it) |
| `provider` | — | `["qwen38"]` | the provider route(s) to register |

Compaction trim knobs (environment only, so the preset row carries no keys the
stock config schema does not know):

| Env | Default | Meaning |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` reduces image blocks to text placeholders — **prefer this when the vision mmproj is offloaded to a second device** (common local setups, e.g. llama.cpp `--mmproj-device <iGPU>`): the summarizer then never re-encodes images on the offload device. `keep` retains them so the checkpoint can describe the pixels (every compaction re-encodes the images — slower + vision tokens) |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | assistant turns at the region tail whose reasoning is kept |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | per-tool-result character cap (JS string length: one CJK character = one ASCII letter = 1 — characters, not tokens); `0` disables |

The generated preset pins the backend row's `maxTokens` to `24576` (the stock
8192 default truncates long checkpoints; the wire additionally raises any
compaction call to the line's own `maxTokens` cap, so a larger row value only
helps lines with a bigger output cap).

## Settings tab

On a profile with the settings provider (the web surface), the plugin registers
the user-settings namespace `qwen38-local-qol` and a **Qwen3.8 Local** page in
the settings dialog. The tab exposes the provider config a human actually
adjusts: the server line selector (llama.cpp / NInfer, i.e. the `dialect`
field — ports stay out of the labels because they are user-chosen), the
connection fields (`baseURL`, `model`, `displayName`) **per dialect**,
`contextWindow`, `maxTokens`, the per-effort `thinkingBudgets` (greyed out on
the NInfer line) plus the single `defaultThinkingBudget` (NInfer line only),
and the
compaction trim knobs (`summarize.images` / `summarize.keepTurns` /
`summarize.toolChars`) — plus a revision indicator and conflict handling for
concurrent edits.

The tab, both lines:

| llama.cpp line (per-effort budgets live) | NInfer line (per-effort greyed out, single all-efforts budget) |
|---|---|
| ![llama.cpp line](docs/screenshot-llama-en.png) | ![NInfer line](docs/screenshot-ninfer-en.png) |

- **Compaction wiring status**: the Compaction section starts with the status
  of the local compaction backend as of DSH startup: whether the generated
  `qwen38-qol` preset exists and which agent preset new sessions default to.
  It matters because the trim knobs apply only to sessions that use the
  `qwen38-qol` preset (the preset layer), while the wire-layer rules
  (compaction thinking-off and the output cap) apply to every qwen38 session
  regardless of the preset. The status is read at boot, so running the setup
  or changing the default preset shows up on the next DSH start — except
  that the tab offers both changes in place: a **Generate the preset** button
  (the host reads the standard preset through the agent-presets service and
  writes the transformed files; one-shot, it refuses to overwrite) and a
  **Set as the default preset** button (the same settings write the Agent
  presets page performs) — after either succeeds the status line flips
  without a restart and new sessions pick the change up immediately.
- **Per-dialect line memory**: the section persists a `lines` block
  (`lines.ninfer` / `lines.llamacpp`) where each line remembers its own
  connection (`baseURL` / `model` / `displayName`), its own window numbers
  (`contextWindow` / `maxTokens` / `thinkingBudgets`), its thinking budget
  (`defaultThinkingBudget`) and its compaction trim knobs (`summarize`). The
  context window is a property of the line's server build (its `-c`, bounded
  by that line's VRAM and quantization), not of the model — two lines of the
  same model may legitimately carry different windows, and a shared window
  would miscalibrate the compaction threshold of the smaller one; the
  thinking budget is the same kind of property (e.g. NInfer's server-side
  `--default-thinking-budget` cap differs per line), and the trim knobs are a
  per-line preference. The top-level copies of all of these stay the
  adapter's authority (the tab writes them in sync with the active line), so
  the host side needs no line awareness; a section saved before `lines`
  existed is migrated transparently. Switching the line in the tab swaps the
  two remembered lines; switching back restores the previous line's values.
- **Dialect-aware thinking-budget fields**: on the NInfer line the per-effort
  numbers are greyed out (NInfer has no per-request thinking budget —
  ninfer as of 2026-09-02 / ninfer-windows 0.5.0; the values are sent
  but ignored), and a single **thinking-budget (all efforts)** field records
  the server's `--default-thinking-budget` flag value — keep the two in sync.
  On the llama.cpp line the per-effort fields stay live (honored per request).
- **Fill-once defaults**: every window number (229376 / 24576 /
  4096-8192-16384 per line), the trim knobs (strip / 5 / 2000), and each
  line's production connection (NInfer 8082 + the 27B NVFP4 artifact id;
  llama.cpp 8080 + the GGUF basename) are the schema defaults, so a fresh
  install — which opens on the llama.cpp line (the general default) —
  pre-fills the whole form and only the fields that differ from the
  defaults need typing. `includeUsage` (default `true`) and `defaultEffort`
  (default `medium`) are deliberately *not* tab controls — they stay in the
  schema/config layer (patch row / environment) and are off by design on a
  dedicated local line.
- **Persistence** is the settings document (`settings.yaml`, hot-reloaded);
  the write path carries the namespace revision, and a stale write surfaces as
  a conflict (re-read), never a silent overwrite.
- **Effect is live, no restart**: the adapter reads the resolved value per
  request and the compaction backend per summarize call, so a saved change
  applies on the next wire call. (A *new chat session* is still required for
  the model catalog fields — `contextWindow` / `maxTokens` / `displayName`
  resolve at session start.)
- **Precedence** for the provider config: settings tab (user layer) → patch
  row / environment → built-in defaults. Without the settings provider
  (headless profiles) the row/environment/default chain from the table above
  still governs, and the trim knobs fall back to the environment variables.
- **Registration is a declared injection, not a store read**: the apply body
  uses `ctx.inject(['settings'], …)` (and `ctx.inject(['attachments'], …)`)
  instead of `ctx.get(…)`. A store read at apply time races the boot order —
  when this plugin's apply ran before the settings provider registered its
  service, the section silently never installed and the settings surface had
  no namespace to write (the llm-pi-ai / tool-fs / agent-loop precedent is the
  declared-injection form; absent optional services keep the child fiber
  pending rather than failing it).

## Wire map

Both dialects speak OpenAI-compatible `/v1/chat/completions` with:

- `max_tokens` (not `max_completion_tokens`), standard `tools` array, `stop`.
- assistant reasoning round-trip via the standard `reasoning_content` field
  (the #1198 hardening: signature-less thinking blocks are not silently
  dropped).
- `finish_reason: length` → harness `max-tokens` (a budget or output
  truncation is not presented as a complete answer).
- Auxiliary calls (`purpose: 'compaction' | 'session-title'`) force
  `enable_thinking: false` regardless of the caller's `reasoningEffort` —
  their bounded output cap is reserved for the visible result. A compaction
  call also takes the larger of the engine-pinned `maxTokens` and the line's
  configured output cap.
- usage: `completion_tokens_details.reasoning_tokens` → per-turn reasoning
  tokens in the GUI, when the server reports it (the llama.cpp
  reasoning-budget build does; NInfer 0.5.0 reports it with
  `stream_options.include_usage` — verified 2026-09; the field is optional
  everywhere).
- user image blocks → `image_url` data URLs through the attachment seam;
  an unreadable image degrades to a `[image: name w×h]` text placeholder so
  one missing store entry never fails the request.
- token-meter image pricing (`imageRequestPricing`, synchronous, no I/O):
  the NInfer line prices with its exact patch formula `(W/32)×(H/32)+2`
  visual tokens; the llama.cpp line is clamped server-side into its
  `--image-min-tokens`/`--image-max-tokens` window, so every image prices at
  the clamp maximum (1536) — the conservative bound. The adapter supplies
  the method because the rc.2 `LlmAdapter` base predates the seam and the
  newer token meter resolves it unguarded.

## Develop

```sh
pnpm install
pnpm test              # node --test (host + client + built artifact)
pnpm run build:client  # re-build lib/client.js after editing src/client.js
```

Raw ESM JavaScript with JSDoc for the host half (the dsh-llamacpp shipping
pattern). The browser half (`src/client.js`) is `React.createElement` source,
built by `scripts/build-client.mjs` (esbuild, `react` external) into the DSH
client-module format — a self-registering script the web loader executes as a
classic script — and shipped as the committed `lib/client.js`. Rebuild and
commit after any `src/client.js` change. Peer pins: `@deepseek-ai/cordis
^4.0.1`, `@deepseek-ai/dsh-llm ^0.1.1-rc.2` (verified against the npm
0.1.1-rc.2 line; developed and machine-verified on the 0.1.2-alpha.3 source
tree; re-verified live on 0.1.5-alpha.1 after the session-log V3 upgrade
(2026-09-09)), plus `@deepseek-ai/schemastery ^3.18.1` and `react ^18.2.0` for
the settings section.

## Known Limitations and Deferred Work

- **Flash-Next is config-compatible, not artifact-verified.** Same wire and
  dialect logic; no NInfer Flash-Next artifact exists yet (0.5.0 ships 27B
  NVFP4 only), so Flash-Next runs on the `llamacpp` dialect (Unsloth
  `qwen4exp` branch) with its own `contextWindow`/budget values.
- **Summarizer behavior depends on the engine version.** The backend trims
  the prefill itself and delegates the one-shot call to the stock engine
  path. The wire's auxiliary-call rules (thinking forced off, compaction
  `max_tokens` raised to the line cap) apply to every engine version,
  including stock 0.1.5-alpha.1, which no longer sends `reasoningEffort: off`
  on its own — but the engine-internal behavior (e.g. a future engine that
  re-introduces per-summary options) is not controlled by this plugin.
- **The preset seam is a Web-surface feature.** Headless profiles do not
  mount the `agent-presets` row, so their sessions are bare agents and the
  generated preset's compaction backend does not apply there; the provider
  route works in both surfaces. Until the upstream opens a preset/settings
  seam for headless, headless users keep the compaction change on the core
  patch chain.
- **Default preset.** `setup.js` writes
  `agent-presets: { default: qwen38-qol }` into `settings.yaml` (a dated
  backup of the file is kept), so new sessions use the generated preset
  automatically; existing sessions select it per session in the GUI. To keep a
  different default, remove or edit that section.

---

# 中文

给**本地跑 Qwen3.8** 的人用的 DSH（DeepSeek Harness）QoL 插件——
**Qwen3.8-27B** 跑在 llama.cpp `llama-server` 或 NInfer（[Neroued/ninfer](https://github.com/Neroued/ninfer)——源码构建
或自构 Docker 镜像，as of 2026-09-02——与 **ninfer-windows 0.5.0 / 0.6.x**
（原生 Windows build）；两者都提供同一套 OpenAI 兼容 `/v1` API，一份插件
配置通吃），以及配置层面的 **Qwen3.8-Flash-Next**（同一 OpenAI 兼容 wire，
同一方言逻辑）。

它给原版 DSH（无核心补丁、无 pi-ai 补丁文件）补上本地 Qwen 线需要的
两样东西：

1. **逐请求 thinking 预算。** 每个请求携带所选 reasoning effort 及其
   thinking token 硬帽：`llamacpp` 方言发 `chat_template_kwargs.reasoning_effort`
   + 顶层 `reasoning_budget_tokens`（llama.cpp 的逐请求预算，覆盖任何
   `--reasoning-budget` CLI 参数）；`ninfer` 方言发顶层 `reasoning_effort`
   （NInfer 0.5.0 的 effort 白名单；预算字段照发但服务端用
   `--default-thinking-budget` 帽住 thinking）。`off` 发
   `chat_template_kwargs.enable_thinking: false`——这个 llama.cpp 构建
   实际读取的开关。
2. **不再把输出帽烧在 thinking 上的压缩（compaction）后端。** 覆盖原版
   引擎唯一的 `summarize()` 钩子：摘要 prefill 先裁剪（只留近期
   reasoning、图片剔除、工具结果截断）。thinking-off 与输出帽在 wire 层
   对每个 `purpose: 'compaction'` 调用强制（与你用哪个 preset 无关）——
   checkpoint 拿到该线完整输出帽，而不是被截断的 "incomplete checkpoint"。

一个包，三处注册：

| 注册 | 接缝 | 挂载点 |
|---|---|---|
| `QwenLocalAdapter`（provider 路由 `qwen38`） | `ctx.llm.registerAdapter()` | bundle 补丁（`cordis.patch.yml`），挂在 profile 根 |
| `QwenLocalCompaction`（压缩后端） | `@deepseek-ai/dsh-compaction-basic` 子类 | 生成的**用户 preset** `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml`（每会话 agent preset 拥有隔离的压缩组；profile 级补丁够不到） |
| 设置 tab（**Qwen3.8 本地**） | 用户设置命名空间 `qwen38-local-qol` + 浏览器 `settings.section` 槽位 | settings provider 的 `installSection`（宿主侧）与插件的 `dsh.client` manifest（浏览器侧，`./client` 导出） |

## 安装

```sh
# 与其他插件相同（非默认 profile 加 --profile <name>）：
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
# 本插件特有的一次性步骤——生成压缩用户 preset（含选择器描述），并把 agent
# preset 默认设为 qwen38-qol（重跑对它改动的每个文件各留日期备份）：
node_modules/dsh-qwen38-local-qol/src/setup.js --src <已安装的 @deepseek-ai/dsh-agent-presets 的 presets/standard/agent.cordis.yml 路径>
```

新会话随后自动使用 **`qwen38-qol`**。已有会话保留创建时的 preset——在 GUI
里选择 `qwen38-qol` 切换单个会话，或从 `~/.dsh/settings.yaml` 删掉
`agent-presets:` 段保持 `standard` 为默认。

`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config`
可在不启动的情况下查看组合后的 provider 行。

## 更新

```sh
# 插件是 `github:` 依赖；update 会重新解析默认分支：
dsh plugin --profile web update dsh-qwen38-local-qol
```

若 profile 锁文件仍钉在首次安装时的 commit（`github:` 依赖按精确 commit
解析），重装即可强制重新解析：

```sh
dsh plugin --profile web remove dsh-qwen38-local-qol
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

client 面改动以已提交的 `lib/client.js` 构建产物出货（web loader 只服务
bundle，不服务 `src/`），使用方无需构建步骤。更新不会触碰生成的用户
preset 与 `qwen38-local-qol:` 设置节——只有 preset 形状本身变化时才需要
重跑 `setup.js`。

## 卸载

```sh
# 1. 移除依赖（profile 的 bundle 栈会按已安装状态自动对齐）：
dsh plugin --profile web remove dsh-qwen38-local-qol

# 2. 删除 setup.js 生成的压缩用户 preset：
rm -rf ~/.dsh/.agent-presets/qwen38-qol
# Windows：C:\Users\<你>\.dsh\.agent-presets\qwen38-qol

# 3. 清理 settings.yaml——preset 默认项必须删，其余可选：
#    - agent-presets: { default: qwen38-qol }（setup.js 写入，留有
#      settings.yaml.bak-* 备份；默认项指向已删除的 preset 会让
#      preset 解析报错）
#    - qwen38-local-qol: 设置节（孤儿命名空间，留着无害、删了更干净）
#    - 你设置过的 DSH_QWEN38_* 环境变量

# 4. 重启 DSH host（插件代码在 host 启动时加载）
```

卸载不触碰其他任何东西：会话历史、transcript、模型线、引擎都不是插件
持有的状态。

## 配置

provider 行配置（来自 bundle 补丁或 overlay；按 id 定向的补丁替换整个
config 对象，所以环境回退只作用于补丁没写的字段）：

| 字段 | 环境回退 | 默认值 | 含义 |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://localhost:8082/v1` | 服务器地址（含 `/v1`） |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | 请求未带 model 时发送的 id（NInfer 0.5.0 工件 id——Docker 与 Windows build 相同；可用 `GET /v1/models` 对运行中的服务器核实；llama.cpp 线用自己的 id——在那边设此字段或环境变量） |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | model id | GUI 模型选择器的可读名（wire id 是工件别名） |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | 服务器 `--api-key`（如设置） |
| `dialect` | `DSH_QWEN38_DIALECT` | `llamacpp` | `ninfer` 或 `llamacpp`（thinking wire 方言）；新装默认打开 llama.cpp 线——在 tab 里切线 |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | 声明的上下文容量（压力压缩需要它） |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | 声明的每请求输出帽 |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | 每档 effort 的 thinking 硬帽；声明的 effort 词汇 = `off` + 这些键（NInfer 线：发送但被忽略——实际帽 = `defaultThinkingBudget` / 服务端参数） |
| `defaultThinkingBudget` | — | `16384` | NInfer 线的实际 thinking 帽：服务端 `--default-thinking-budget` 参数值，全部 effort 共用一个值（NInfer 端点无逐请求预算字段）。由设置 tab 记录——与服务器启动参数保持同步 |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | 注入未带 effort 的请求；必须是 `off` 或 `thinkingBudgets` 键。声明它（任意值）会抑制核心选择器的 "Default" 行——在这条线上它与 `off` 冗余 |
| `thinkingLevelMap` | — | 恒等 | effort id → wire effort 名 |
| `includeUsage` | — | `true` | 请求 `stream_options.include_usage`；上下文仪表与逐轮 reasoning token 显示读取服务端报告的 usage（双方言已验证遵守） |
| `provider` | — | `["qwen38"]` | 要注册的 provider 路由 |

压缩裁剪旋钮（仅环境变量，让 preset 行不携带原版 config schema 不认识的键）：

| 环境变量 | 默认值 | 含义 |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` 把图片块降为文本占位符——**vision mmproj offload 到第二设备时优选**（常见本地配置，如 llama.cpp `--mmproj-device <iGPU>`）：摘要器不再在离卡设备上重编码图片。`keep` 保留，checkpoint 能描述像素（每次压缩都重编码——更慢 + 视觉 token 开销） |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | 区域尾部保留 reasoning 的 assistant 轮数 |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | 单条工具结果字符帽（JS 字符串长度：一个中文字 = 一个英文字母 = 1——是字符不是 token）；`0` 禁用 |

生成的 preset 把后端行的 `maxTokens` 钉在 `24576`（原版 8192 默认帽截断
长 checkpoint；wire 层还会把任何 compaction 调用的 `max_tokens` 提到该线
自身的 `maxTokens` 帽——更大的钉值只对输出帽更大的线有意义）。

## 设置 tab

在带 settings provider 的 profile（web 面）上，插件注册用户设置命名空间
`qwen38-local-qol`，并在设置弹窗里注册 **Qwen3.8 本地** 页。tab 暴露人
真正会调的 provider 配置：服务器线选择器（llama.cpp / NInfer，即
`dialect` 字段——标签不带端口，因为端口是用户选的）、**按方言**的连接字段
（`baseURL`、`model`、`displayName`）、`contextWindow`、`maxTokens`、
每档 `thinkingBudgets`（NInfer 线置灰）+ 单个 `defaultThinkingBudget`
（仅 NInfer 线显示）、压缩裁剪旋钮（`summarize.images` /
`summarize.keepTurns` / `summarize.toolChars`）——外加版本号指示器与并发
编辑冲突处理。

tab 实况（两条线）：

| llama.cpp 线（按 effort 可用） | NInfer 线（按 effort 置灰 + 全部 effort 单值） |
|---|---|
| ![llama.cpp 线](docs/screenshot-llama-zh.png) | ![NInfer 线](docs/screenshot-ninfer-zh.png) |

- **压缩接线状态**：压缩段开头显示本地压缩后端在 DSH 启动时的状态：生成的
  `qwen38-qol` 预设是否存在、新会话默认用哪个 agent 预设。有意义是因为裁剪
  旋钮只对使用 `qwen38-qol` 预设的会话生效（preset 层），而 wire 层规则
  （压缩 thinking off 与输出帽）对所有 qwen38 会话常开、与预设无关。状态在
  启动时读取——跑 setup 或改默认预设后，下次 DSH 启动生效；不过 tab 里可以
  直接完成这两个变更：**生成预设**按钮（宿主经 agent-presets 服务读 standard
  预设并写入变换后的文件；一次性、拒覆盖）与**设为默认预设**按钮（与 Agent
  预设页相同的设置写入）——任一成功即当场刷新状态行，新会话立即生效，无需重启。
- **按方言的线记忆**：section 持久化 `lines` 块（`lines.ninfer` /
  `lines.llamacpp`），每条线记住自己的连接（`baseURL` / `model` /
  `displayName`）、窗口数字（`contextWindow` / `maxTokens` /
  `thinkingBudgets`）、thinking 预算（`defaultThinkingBudget`）和压缩裁剪
  旋钮（`summarize`）。上下文窗口是线（其服务器的 `-c`，受该线 VRAM 与
  量化约束）的属性，不是模型的属性——同模型的两条线可以合理地不同窗口，
  共享窗口会把较小那线的压缩阈值算错；thinking 预算是同类属性（如 NInfer
  服务端 `--default-thinking-budget` 帽逐线不同），裁剪旋钮是逐线偏好。
  这些字段的顶层副本保持 adapter 权威（tab 与活跃线同步写），所以宿主侧
  无需线感知；`lines` 出现前保存的 section 透明迁移。tab 里切线 = 两条
  记忆互换；切回 = 恢复该线原值。
- **随方言的 thinking 预算字段**：NInfer 线把按 effort 的数字置灰（NInfer
  没有逐请求 thinking 预算——ninfer as of 2026-09-02 / ninfer-windows 0.5.0；
  数值照发但被忽略），另有一个 **thinking 预算（全部 effort）** 字段记录
  服务端 `--default-thinking-budget` 参数值——两者保持同步。llama.cpp
  线按 effort 的字段保持可用（逐请求生效）。
- **填一次默认值**：所有窗口数字（每线 229376 / 24576 /
  4096-8192-16384）、裁剪旋钮（strip / 5 / 2000）、每条线的生产连接
  （NInfer 8082 + 27B NVFP4 工件 id；llama.cpp 8080 + GGUF 基名）都是
  schema 默认值——新安装默认打开 llama.cpp 线（general 默认），整表预填，
  只需填与默认不同的字段。`includeUsage`
  （默认 `true`）与 `defaultEffort`（默认 `medium`）刻意**不是** tab
  控件——留在 schema/config 层（补丁行/环境），在专用本地线上按设计
  关闭。
- **持久化** = 设置文档（`settings.yaml`，热加载）；写路径携带命名空间
  版本号，过期写入表现为冲突（重读），绝不静默覆盖。
- **生效即时、免重启**：adapter 每请求读解析值，压缩后端每次 summarize
  读——保存的改动在下一次 wire 调用生效。（*新的聊天会话*仍需要于模型
  目录字段——`contextWindow` / `maxTokens` / `displayName` 在会话开始时
  解析。）
- **优先级**：设置 tab（用户层）→ 补丁行/环境 → 内置默认值。无 settings
  provider（headless profile）时，上表的行/环境/默认链仍生效，裁剪旋钮
  回退到环境变量。
- **注册是声明式注入，不是 store 读取**：apply 体用
  `ctx.inject(['settings'], …)`（和 `ctx.inject(['attachments'], …)`）
  而不是 `ctx.get(…)`。apply 时的 store 读取与启动顺序竞争——本插件 apply
  先于 settings provider 注册服务运行时，section 会静默装不上
  （llm-pi-ai / tool-fs / agent-loop 先例是声明注入形式；缺失的可选服务
  让子 fiber 保持 pending 而非失败）。

## Wire 对照

双方言都讲 OpenAI 兼容 `/v1/chat/completions`：

- `max_tokens`（不是 `max_completion_tokens`）、标准 `tools` 数组、`stop`。
- assistant reasoning 往返走标准 `reasoning_content` 字段（#1198 加固：
  无签名 thinking 块不再被静默丢弃）。
- `finish_reason: length` → harness `max-tokens`（预算或输出截断不表现为
  完整回答）。
- 辅助调用（`purpose: 'compaction' | 'session-title'`）无条件发
  `enable_thinking: false`（不依赖调用方的 `reasoningEffort`）——其有界
  输出帽留给可见结果。compaction 调用的 `max_tokens` 取引擎钉值与该线
  配置输出帽的较大者。
- usage：`completion_tokens_details.reasoning_tokens` → GUI 逐轮
  reasoning tokens（服务端报告时；llama.cpp reasoning-budget 构建报告；
  NInfer 0.5.0 在 `stream_options.include_usage` 下报告——2026-09 验证；
  该字段处处可选）。
- 用户图片块 → 经 attachment 接缝的 `image_url` data URL；读不到的图降为
  `[image: name w×h]` 文本占位——单个 store 条目缺失从不搞挂请求。
- token 仪表图片计价（`imageRequestPricing`，同步、无 I/O）：NInfer 线用
  其精确 patch 公式 `(W/32)×(H/32)+2` 视觉 token；llama.cpp 线被服务端
  钳在 `--image-min-tokens`/`--image-max-tokens` 窗口内，所以每张图都按
  钳位上限（1536）计价——保守上界。adapter 自带该方法，因为 rc.2
  `LlmAdapter` 基类早于该接缝、而新版 token 仪表无守卫地解析它。

## 开发

```sh
pnpm install
pnpm test              # node --test（host + client + 构建产物）
pnpm run build:client  # 改完 src/client.js 后重建 lib/client.js
```

宿主半边是带 JSDoc 的裸 ESM JavaScript（dsh-llamacpp 的出货模式）。
浏览器半边（`src/client.js`）是 `React.createElement` 源码，由
`scripts/build-client.mjs`（esbuild，`react` external）构建为 DSH client
模块格式——web loader 作为经典脚本执行的自注册脚本——以已提交的
`lib/client.js` 出货。`src/client.js` 任何改动后重建并提交。Peer 钉版：
`@deepseek-ai/cordis ^4.0.1`、`@deepseek-ai/dsh-llm ^0.1.1-rc.2`（对 npm
0.1.1-rc.2 线验证；在 0.1.2-alpha.3 源码树上开发与机器验证；2026-09-09
session-log V3 升级后在 0.1.5-alpha.1 上实跑复验），设置
section 另有 `@deepseek-ai/schemastery ^3.18.1` 与 `react ^18.2.0`。

## 已知限制与暂缓工作

- **Flash-Next 是配置兼容，未工件验证。** 同一 wire 与方言逻辑；NInfer
  Flash-Next 工件尚不存在（0.5.0 只出 27B NVFP4），所以 Flash-Next 跑在
  `llamacpp` 方言（Unsloth `qwen4exp` 分支），用自己的
  `contextWindow`/预算值。
- **摘要器行为依赖引擎版本。** 后端自己裁 prefill，一次性调用委托给
  原版引擎路径。wire 层辅助调用规则（thinking 强制 off、compaction
  `max_tokens` 提到线帽）对所有引擎版本生效（含不再自带
  `reasoningEffort: off` 的 stock 0.1.5-alpha.1），但引擎内部行为（例如
  未来引擎重新引入 per-summary options）不在本插件控制之内。
- **preset 接缝是 web 面功能。** headless profile 不挂 `agent-presets`
  行，其会话是裸 agent，生成的 preset 压缩后端在那里不生效；provider 路由
  两面都工作。上游为 headless 打开 preset/settings 接缝之前，headless
  用户的压缩改动保留在核心补丁链上。
- **默认 preset。** `setup.js` 会把 `agent-presets: { default: qwen38-qol }`
  写入 `settings.yaml`（该文件留日期备份），新会话自动使用生成的 preset；
  已有会话在 GUI 里每会话选择。想保持别的默认，删掉或改这一节即可。
