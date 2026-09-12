# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

A QoL plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) for people running **Qwen3.8 locally** (llama.cpp `llama-server` or NInfer — both serve the OpenAI-compatible `/v1` API; at the config level also **Qwen3.8-Flash-Next**): per-request thinking budgets, and a compaction backend whose summaries stop burning the output cap on thinking. No core patches, no pi-ai patchfile.

## Install

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

Restart `dsh web` — the compaction wiring self-applies at boot: the **`qwen38`** user preset is generated from the standard preset's composition and becomes the default when none is configured yet (an explicit choice is respected on every later boot). New sessions use `qwen38` automatically; existing sessions keep the preset they were created with — select `qwen38` in the GUI to switch one.

The generated preset on the Agent presets page (its display name and description are published per locale and render for the reader's own language):

![the generated qwen38 preset](<docs/qwen38 preset-en.png>)

`setup.js` performs the same write manually (regenerates the preset from the live installed standard, forces the default, dated backups of every file it changes): `node_modules/dsh-qwen38-local-qol/src/setup.js`. `dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config` shows the composed provider line without booting.

## What it does

- **Per-request thinking budgets.** Every request carries the selected reasoning effort and its hard thinking-token cap — the `llamacpp` dialect per effort (`chat_template_kwargs.reasoning_effort` + `reasoning_budget_tokens`, overriding the server's `--reasoning-budget`; `off` via `enable_thinking: false`), and the `ninfer` dialect one global thinking budget for all efforts (`defaultThinkingBudget` — the server's `--default-thinking-budget` value).
- **A compaction backend that stops burning the output cap on thinking.** The stock engine's `summarize()` hook is overridden so the summarizer prefill is trimmed first (recent reasoning only, images downgraded to text placeholders, tool results capped); thinking-off and the line's full output cap are enforced on the wire for every `purpose: 'compaction'` call, regardless of preset — the checkpoint gets the whole output cap instead of a truncated "incomplete checkpoint".
- **A settings tab (Qwen3.8 Local)** that configures both lines — changes apply live, no restart.

## The settings tab

DSH settings → **Qwen3.8 Local** (web surface):

![the Qwen3.8 Local settings tab](<docs/qwen38 tab-en.png>)

- **Line selector + per-line memory.** Each line keeps its own connection, window numbers, budgets and trim knobs — switching lines swaps the two memories. The context window is a property of the **line** (its server build), not of the model.
- **One-time defaults.** Window numbers, trim knobs and both production connections are schema defaults — a fresh install pre-fills the whole form; type only what differs.
- **Compaction wiring status dot.** Green: preset present and is the default (compaction live for new sessions). Amber: a different preset is the default (switch it on the Agent presets page). Gray: preset missing (regenerated at next boot, or run `setup.js`).
- **Changes apply live, no restart** (the adapter reads the resolved value per request); only model-catalog fields (`contextWindow` / `maxTokens` / `displayName`) need a new chat session. **Persistence** = `settings.yaml` (hot-reloaded); writes carry the namespace version — a stale write surfaces as a conflict, never a silent clobber.

## Configuration

The settings tab is the primary entry; on headless profiles or via patch/env, the provider line accepts (an id-scoped patch replaces the whole config object; env fallbacks cover only what the patch does not set):

| Field | Env var | Default | Meaning |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://localhost:8082/v1` | Server address (including `/v1`) |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4` | The id sent when a request carries no model (`GET /v1/models` to confirm) |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | the model id | Human-readable name in the GUI picker |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | The server's `--api-key` (if set) |
| `dialect` | `DSH_QWEN38_DIALECT` | `llamacpp` | `ninfer` / `llamacpp` (the thinking dialect) |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | Declared context capacity (pressure compaction needs it) |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | Declared per-request output cap; the generated preset pins the compaction line here (the stock 8192 would truncate long checkpoints) |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | Per-effort thinking caps (`llamacpp` line) |
| `defaultThinkingBudget` | — | `16384` | The `ninfer` line's one global budget → the server's `--default-thinking-budget` |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | Injected when a request carries no effort |
| — | `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` downgrades summarizer-prefill images to text placeholders; `keep` leaves them |
| — | `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | Assistant turns whose reasoning is kept at the region tail |
| — | `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | Per-tool-result character cap; `0` disables |

The last three rows are env-only, so the preset line carries no keys the stock config schema does not know.

## Wire notes

Both dialects speak OpenAI-compatible `/v1/chat/completions`: `max_tokens` (not `max_completion_tokens`), standard `tools`, `stop`; reasoning round-trips in `reasoning_content`. `finish_reason: length` → harness `max-tokens`. When the server reports usage (llama.cpp reasoning-budget builds; NInfer under `stream_options.include_usage` — verified 2026-09), the GUI shows per-turn reasoning tokens. User images → `image_url` data URLs; unreadable images degrade to `[image: name w×h]` placeholders, and a single missing store entry never breaks a request.

## Update

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

If the profile lockfile still pins the commit first installed (`github:` dependencies resolve to an exact commit), remove and re-add to force re-resolution. The client face ships as a committed `lib/client.js`; updates never touch the generated preset or the `qwen38-local-qol:` settings section.

## Uninstall

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. Delete the **`qwen38`** agent preset on the DSH settings → Agent presets page.
3. In `~/.dsh/settings.yaml`, drop `agent-presets: { default: qwen38 }` — required, since a default pointing at a deleted preset breaks resolution (if you ran `setup.js`, dated `.bak` backups remain).
4. Restart DSH (plugin code loads at host boot).

Uninstall touches nothing else: session history, transcripts, model lines and engines are not state the plugin owns.

## Known limits

- **Flash-Next is config-compatible, not artifact-verified** (NInfer ships 27B NVFP4 only so far) — it runs the `llamacpp` dialect with its own window/budget values.
- **The preset seam is a web-surface feature:** headless profiles do not mount `agent-presets` rows, so their compaction changes still live in the core patch chain; the provider route works on both surfaces.
- **Summarizer behavior depends on the engine version:** the wire rules (thinking forced off, compaction `max_tokens` raised to the line cap) hold for every engine version; engine internals are outside the plugin's control.

## Develop

```sh
pnpm install
pnpm test               # node --test (host + client + built artifact)
pnpm run build:client   # rebuild lib/client.js after touching src/client*
```

The host half is plain ESM JavaScript with JSDoc. The browser half (`src/client.js` + `src/client-entry.js`) is `React.createElement` source on the shared `@deepseek-ai/dsh-client-ui-primitives` controls, built by `scripts/build-client.mjs` and shipped as the committed `lib/client.js` — rebuild and commit after any browser-side change. Design details: [DESIGN.md](DESIGN.md).

## License

[MIT](LICENSE)

## 中文

给**本地跑 Qwen3.8** 的人用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）QoL 插件（llama.cpp `llama-server` 或 NInfer——两者都提供 OpenAI 兼容 `/v1` API；配置层面兼容 **Qwen3.8-Flash-Next**）：逐请求 thinking 预算 + 摘要不再把输出帽烧在 thinking 上的压缩后端。零核心补丁、零 pi-ai 补丁文件。

## 安装

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

重启 `dsh web` 即生效——压缩接线在启动时自动生效：从 standard preset 的组成生成 **`qwen38`** 用户 preset，且仅当尚未配置默认 agent preset 时才设默认（显式选择之后每次启动都尊重）。新会话自动使用 `qwen38`；已有会话保留创建时的 preset——在 GUI 里选择 `qwen38` 切换单个会话。

生成的 preset 在 Agent 预设页的样子（显示名与描述按语言发布、按读者语言渲染）：

![生成的 qwen38 预设](<docs/qwen38 preset-cn.png>)

`setup.js` 手动执行同样的写入（从已安装的 standard 重新生成 preset、强制设默认、改动的文件留日期备份）：`node_modules/dsh-qwen38-local-qol/src/setup.js`。`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config` 可在不启动的情况下查看组合后的 provider 行。

## 功能特性

- **逐请求 thinking 预算。** 每个请求携带所选 reasoning effort 及其 thinking token 硬帽——`llamacpp` 方言按 effort（`chat_template_kwargs.reasoning_effort` + `reasoning_budget_tokens`，覆盖服务端 `--reasoning-budget`；`off` 走 `enable_thinking: false`），`ninfer` 方言全部 effort 共用一个全局 thinking 预算（`defaultThinkingBudget`——服务端 `--default-thinking-budget` 的值）。
- **压缩（compaction）后端：不再把输出帽烧在 thinking 上。** 覆盖原版引擎的 `summarize()` 钩子：摘要 prefill 先裁剪（只留近 N 轮 reasoning、图片降为文本占位符、工具结果按字数帽截断）；thinking-off 与该线完整输出帽在 wire 层对每个 `purpose: 'compaction'` 调用强制（与 preset 无关）——checkpoint 拿到完整输出帽，而不是被截断的 "incomplete checkpoint"。
- **设置 tab（Qwen3.8 本地）**：图形化配置两条线——保存即时生效、免重启。

## 设置 tab

DSH 设置 → **Qwen3.8 本地**（web 面）：

![Qwen3.8 本地设置页](<docs/qwen38 tab-cn.png>)

- **服务器线切换 + 按线记忆。** 每条线记住自己的连接、窗口数字、预算与裁剪旋钮——切线 = 两条记忆互换。上下文窗口是**线**（其服务器构建）的属性，不是模型的属性。
- **填一次默认值。** 窗口数字、裁剪旋钮、两条线的生产连接都是 schema 默认——新安装整表预填，只需填与默认不同的字段。
- **压缩接线状态圆点。** 绿：preset 存在且为默认（新会话压缩生效）。黄：默认是别的 preset（在 Agent 预设页切换）。灰：preset 缺失（下次启动重新生成，或跑 `setup.js`）。
- **生效即时、免重启**（adapter 每请求读解析值）；仅模型目录字段（`contextWindow`/`maxTokens`/`displayName`）需要开新会话。**持久化** = `settings.yaml`（热加载）；写路径携带命名空间版本号，过期写入表现为冲突（重读），绝不静默覆盖。

## 配置

设置 tab 是主入口；headless profile 或用补丁/环境时，provider 行配置如下（按 id 定向的补丁替换整个 config 对象，环境回退只作用于补丁没写的字段）：

| 字段 | 环境变量 | 默认 | 含义 |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://localhost:8082/v1` | 服务器地址（含 `/v1`） |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4` | 请求未带 model 时发送的 id（`GET /v1/models` 核实） |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | model id | GUI 模型选择器的可读名 |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | 服务器 `--api-key`（如设置） |
| `dialect` | `DSH_QWEN38_DIALECT` | `llamacpp` | `ninfer` / `llamacpp`（thinking 方言） |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | 声明的上下文容量（压力压缩需要它） |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | 声明的每请求输出帽；生成的 preset 把压缩后端行钉在此（原版 8192 默认帽会截断长 checkpoint） |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | 按 effort 的 thinking 硬帽（`llamacpp` 线） |
| `defaultThinkingBudget` | — | `16384` | `ninfer` 线唯一的全局预算 → 服务端 `--default-thinking-budget` |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | 注入未带 effort 的请求 |
| — | `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` 把摘要 prefill 里的图片降为文本占位符；`keep` 保留 |
| — | `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | 区域尾部保留 reasoning 的 assistant 轮数 |
| — | `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | 单条工具结果字符帽；`0` 禁用 |

最后三行仅环境变量，让 preset 行不携带原版 config schema 不认识的键。

## Wire 要点

双方言都讲 OpenAI 兼容 `/v1/chat/completions`：`max_tokens`（非 `max_completion_tokens`）、标准 `tools`、`stop`；reasoning 往返走 `reasoning_content` 字段。`finish_reason: length` → harness `max-tokens`。服务端报告 usage 时（llama.cpp reasoning-budget 构建；NInfer 在 `stream_options.include_usage` 下——2026-09 验证），GUI 显示逐轮 reasoning tokens。用户图片 → `image_url` data URL；读不到的图降为 `[image: name w×h]` 占位，单个 store 条目缺失从不搞挂请求。

## 更新

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

若 profile 锁文件仍钉在首次安装时的 commit（`github:` 依赖按精确 commit 解析），remove 后重新 add 即可强制重新解析。client 面以已提交的 `lib/client.js` 出货；更新不触碰生成的 preset 与 `qwen38-local-qol:` 设置节。

## 卸载

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. 在 DSH 设置 → Agent 预设页删除 **`qwen38`** 用户 preset。
3. `~/.dsh/settings.yaml` 删掉 `agent-presets: { default: qwen38 }`——必须删，默认项指向已删除的 preset 会让解析报错（跑过 `setup.js` 的话留有日期 `.bak` 备份）。
4. 重启 DSH（插件代码在 host 启动时加载）。

卸载不触碰其他任何东西：会话历史、transcript、模型线、引擎都不是插件持有的状态。

## 已知限制

- **Flash-Next 是配置兼容，未工件验证**（NInfer 尚只出 27B NVFP4）——跑在 `llamacpp` 方言，用自己的窗口/预算值。
- **preset 接缝是 web 面功能**：headless profile 不挂 `agent-presets` 行，其压缩改动仍需核心补丁链；provider 路由两面都工作。
- **摘要器行为依赖引擎版本**：wire 层规则（thinking 强制 off、compaction `max_tokens` 提到线帽）对所有引擎版本生效；引擎内部行为不在本插件控制之内。

## 开发

```sh
pnpm install
pnpm test               # node --test（host + client + 构建产物）
pnpm run build:client   # 改完 src/client* 后重建 lib/client.js
```

宿主半边 = 带 JSDoc 的裸 ESM JavaScript。浏览器半边（`src/client.js` + `src/client-entry.js`）是 `React.createElement` 源码，走共享 `@deepseek-ai/dsh-client-ui-primitives` 控件，由 `scripts/build-client.mjs` 构建并以已提交的 `lib/client.js` 出货——浏览器半边任何改动后重建并提交。设计细节见 [DESIGN.md](DESIGN.md)。

## 许可

[MIT](LICENSE)
