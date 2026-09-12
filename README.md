# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

A QoL plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) for running **Qwen3.8 locally** (llama.cpp `llama-server` or NInfer — both serve the OpenAI-compatible `/v1` API; at the config level also **Qwen3.8-Flash-Next**). No core patches, no pi-ai patchfile.

## Install

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

Restart `dsh web`: at boot the plugin generates the **`qwen38`** user preset from the standard preset's composition, and sets it as the default agent preset when no default is configured. New sessions use it automatically; existing sessions keep the preset they were created with.

![the generated qwen38 preset on the Agent presets page](<docs/qwen38 preset-en.png>)

## What it supports

- **Per-request thinking budgets.** The llama.cpp line sends the selected per-effort budget on every request (`reasoning_effort` + `reasoning_budget_tokens` — overrides the server's `--reasoning-budget`); the NInfer line has one global budget for all efforts (`defaultThinkingBudget` → the server's `--default-thinking-budget`).
- **A compaction backend.** The summarizer's prefill is trimmed (recent reasoning only, images downgraded to text placeholders, tool results capped), and compaction calls run thinking-off at the line's full output cap — checkpoints stop getting truncated at the token cap.
- **A settings tab** that configures both lines, live.

## The settings tab

DSH settings → **Qwen3.8 Local**:

![the Qwen3.8 Local settings tab](<docs/qwen38 tab-en.png>)

Per-line memory (connection, window numbers, budgets, trim knobs). The status dot is green when `qwen38` is the default preset, amber when a different preset is the default, gray when the preset is missing. Changes apply live and persist to `settings.yaml` (hot-reloaded).

## What can be tuned

The settings tab is the primary entry; headless profiles and patch/env accept the same fields (an id-scoped patch replaces the whole config; env covers what the patch does not set):

| Area | Fields (env vars) | Defaults |
|---|---|---|
| Server | `baseURL`, `model`, `displayName`, `apiKey` (`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`) | `http://localhost:8080/v1`, `qwen3.8-27b`, same as `model`, none |
| Dialect | `dialect` (`DSH_QWEN38_DIALECT`) | `llamacpp` |
| Window | `contextWindow`, `maxTokens` (`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`) | `229376`, `24576` |
| Thinking | `thinkingBudgets` (llamacpp, per effort), `defaultThinkingBudget` (ninfer, global), `defaultEffort` (`DSH_QWEN38_DEFAULT_EFFORT`) | `{ low: 4096, medium: 8192, xhigh: 16384 }`, `16384`, `medium` |
| Prefill trim | `DSH_QWEN38_SUMMARIZE_IMAGES`, `DSH_QWEN38_SUMMARIZE_KEEP_TURNS`, `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` (env only) | `strip`, `5`, `2000` |

## Limitations

- **Flash-Next is config-compatible, not artifact-verified** (NInfer ships 27B NVFP4 only so far) — it runs the llama.cpp dialect with its own window/budget values.
- **The preset seam is a web-surface feature** — headless profiles do not mount `agent-presets` rows; the provider route (thinking budgets) works on both surfaces.
- **Summarizer internals depend on the engine version** — the wire rules (thinking off, full output cap) hold for every engine version; engine internals are outside the plugin's control.

## Update

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

`github:` dependencies resolve to an exact commit — if the profile lockfile still pins the commit first installed, remove and re-add the plugin to force re-resolution. Updates never touch the generated preset or the settings section.

## Uninstall

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. Delete the **`qwen38`** preset on the Agent presets page.
3. Drop `agent-presets: { default: qwen38 }` from `~/.dsh/settings.yaml`.
4. Restart DSH.

Session history, transcripts, model lines and engines are not state the plugin owns.

## Develop

```sh
pnpm install
pnpm test
pnpm run build:client   # rebuild lib/client.js after touching src/client*
```

Host half = plain ESM JavaScript with JSDoc; the browser half is built by `scripts/build-client.mjs` and shipped as the committed `lib/client.js`. Design details: [DESIGN.md](DESIGN.md).

## License

[MIT](LICENSE)

## 中文

给**本地跑 Qwen3.8** 的人用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）QoL 插件（llama.cpp `llama-server` 或 NInfer——两者都提供 OpenAI 兼容 `/v1` API；配置层面兼容 **Qwen3.8-Flash-Next**）。零核心补丁、零 pi-ai 补丁文件。

## 安装

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

重启 `dsh web`：启动时插件从 standard preset 的组成生成 **`qwen38`** 用户 preset，且未配置默认时将其设为默认 agent preset。新会话自动使用；已有会话保留创建时的 preset。

![生成的 qwen38 预设（Agent 预设页）](<docs/qwen38 preset-cn.png>)

## 功能特性

- **逐请求 thinking 预算。** llama.cpp 线每请求发送所选 effort 的预算（`reasoning_effort` + `reasoning_budget_tokens`——覆盖服务端 `--reasoning-budget`）；NInfer 线全部 effort 共用一个全局预算（`defaultThinkingBudget` → 服务端 `--default-thinking-budget`）。
- **压缩（compaction）后端。** 摘要 prefill 先裁剪（只留近 N 轮 reasoning、图片降为文本占位符、工具结果按字数帽截断），且压缩调用强制 thinking off + 该线完整输出帽——checkpoint 不再被 token 帽截断。
- **设置 tab**：图形化配置两条线，即时生效。

## 设置 tab

DSH 设置 → **Qwen3.8 本地**：

![Qwen3.8 本地设置页](<docs/qwen38 tab-cn.png>)

按线记忆（连接、窗口数字、预算、裁剪旋钮）。状态圆点：绿 = `qwen38` 是默认 preset，黄 = 默认是别的 preset，灰 = preset 缺失。改动即时生效并持久化到 `settings.yaml`（热加载）。

## 可调项

设置 tab 是主入口；headless profile 或补丁/环境接受同样字段（按 id 定向的补丁替换整个 config，环境回退只覆盖补丁没写的字段）：

| 区域 | 字段（环境变量） | 默认 |
|---|---|---|
| 服务器 | `baseURL`、`model`、`displayName`、`apiKey`（`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`） | `http://localhost:8080/v1`、`qwen3.8-27b`、同 `model`、无 |
| 方言 | `dialect`（`DSH_QWEN38_DIALECT`） | `llamacpp` |
| 窗口 | `contextWindow`、`maxTokens`（`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`） | `229376`、`24576` |
| Thinking | `thinkingBudgets`（llamacpp，按 effort）、`defaultThinkingBudget`（ninfer，全局）、`defaultEffort`（`DSH_QWEN38_DEFAULT_EFFORT`） | `{ low: 4096, medium: 8192, xhigh: 16384 }`、`16384`、`medium` |
| Prefill 裁剪 | `DSH_QWEN38_SUMMARIZE_IMAGES`、`DSH_QWEN38_SUMMARIZE_KEEP_TURNS`、`DSH_QWEN38_SUMMARIZE_TOOL_CHARS`（仅环境变量） | `strip`、`5`、`2000` |

## 已知限制

- **Flash-Next 是配置兼容，未工件验证**（NInfer 尚只出 27B NVFP4）——跑在 llama.cpp 方言，用自己的窗口/预算值。
- **preset 接缝是 web 面功能**——headless profile 不挂 `agent-presets` 行；provider 路由（thinking 预算）两面都工作。
- **摘要器内部行为依赖引擎版本**——wire 层规则（thinking off、完整输出帽）对所有引擎版本生效；引擎内部行为不在本插件控制之内。

## 更新

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

`github:` 依赖按精确 commit 解析——若 profile 锁文件仍钉在首次安装时的 commit，remove 后重新 add 插件即可强制重新解析。更新不触碰生成的 preset 与设置节。

## 卸载

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. 在 Agent 预设页删除 **`qwen38`** preset。
3. `~/.dsh/settings.yaml` 删掉 `agent-presets: { default: qwen38 }`。
4. 重启 DSH。

会话历史、transcript、模型线、引擎都不是插件持有的状态。

## 开发

```sh
pnpm install
pnpm test
pnpm run build:client   # 改完 src/client* 后重建 lib/client.js
```

宿主半边 = 带 JSDoc 的裸 ESM JavaScript；浏览器半边由 `scripts/build-client.mjs` 构建并以已提交的 `lib/client.js` 出货。设计细节：[DESIGN.md](DESIGN.md)。

## 许可

[MIT](LICENSE)
