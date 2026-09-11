# dsh-qwen38-local-qol

> A QoL plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) for people running **Qwen3.8 locally** (llama.cpp `llama-server` or NInfer): per-request thinking budgets, and a compaction backend whose summaries stop burning the output cap on thinking — no core patches, no pi-ai patchfile.
> 给**本地跑 Qwen3.8** 的人用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）QoL 插件（llama.cpp `llama-server` 或 NInfer）：逐请求 thinking 预算 + 摘要不再把输出帽烧在 thinking 上的压缩后端——零核心补丁、零 pi-ai 补丁文件。

![设置 tab（NInfer 线）](docs/screenshot-ninfer-zh.png)

## 🚀 快速开始（安装）

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

重启 `dsh web` 即生效：

- 压缩接线在启动时自动生效——从 standard preset 的组成生成 **`qwen38-qol`** 用户 preset，且仅当尚未配置默认 agent preset 时才设默认（显式选择之后每次启动都尊重）；
- 新会话自动使用 `qwen38-qol`；已有会话保留创建时的 preset——在 GUI 里选择 `qwen38-qol` 切换单个会话，或从 `~/.dsh/settings.yaml` 删掉 `agent-presets:` 段保持 `standard` 为默认。

`setup.js` 手动执行同样的写入（从已安装的 standard 重新生成 preset、强制设默认、改动的文件留日期备份）：

```sh
node_modules/dsh-qwen38-local-qol/src/setup.js
```

`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config` 可在不启动的情况下查看组合后的 provider 行。

## ✨ 功能特性

- **逐请求 thinking 预算。** 每个请求携带所选 reasoning effort 及其 thinking token 硬帽：`llamacpp` 方言发 `chat_template_kwargs.reasoning_effort` + 顶层 `reasoning_budget_tokens`（llama.cpp 的逐请求预算，覆盖服务端 `--reasoning-budget` 参数）；`ninfer` 方言发顶层 `reasoning_effort`（NInfer 的 effort 白名单，预算字段照发但服务端用 `--default-thinking-budget` 帽住 thinking）。`off` 发 `chat_template_kwargs.enable_thinking: false`——该 llama.cpp 构建实际读取的开关。
- **压缩（compaction）后端：不再把输出帽烧在 thinking 上。** 覆盖原版引擎的 `summarize()` 钩子：摘要 prefill 先裁剪（只留近 N 轮 reasoning、图片降为文本占位符、工具结果按字数帽截断），且 thinking-off 与完整输出帽在 wire 层对每个 compaction 调用强制（与你用哪个 preset 无关）——checkpoint 拿到该线完整输出帽，而不是被截断的 "incomplete checkpoint"。
- **设置 tab（Qwen3.8 本地）**：图形化配置两条线（llama.cpp / NInfer）的连接、窗口与预算、压缩裁剪旋钮；保存即时生效、免重启。

## 🎛️ 设置 tab（使用）

DSH 设置 → **Qwen3.8 本地**（web 面）：

| llama.cpp 线（按 effort 预算可用） | NInfer 线（按 effort 置灰 + 全部 effort 单值） |
|---|---|
| ![llama.cpp 线](docs/screenshot-llama-zh.png) | ![NInfer 线](docs/screenshot-ninfer-zh.png) |

- **服务器线切换 + 按线记忆**：llama.cpp / NInfer 切换；每条线记住自己的连接（`baseURL`/`model`/`displayName`）、窗口数字（`contextWindow`/`maxTokens`/`thinkingBudgets`）、thinking 预算（NInfer 线的 `defaultThinkingBudget`）与裁剪旋钮。上下文窗口/预算是**线**（其服务器构建，受 VRAM 与量化约束）的属性，不是模型的属性——同模型两条线可以合理地不同窗口，逐线记忆才不会互相污染。切线 = 两条记忆互换，切回恢复原值。
- **压缩接线状态圆点**：🟢 preset 存在且为默认（新会话压缩生效）/ 🟡 preset 存在但默认是别的 preset（在 Agent 预设页切换默认）/ ⚪ preset 缺失（下次启动重新生成，或跑 `setup.js`）。注意分层：裁剪旋钮只对使用 `qwen38-qol` preset 的会话生效；wire 层规则（压缩 thinking off + 输出帽）对所有 qwen38 会话常开、与 preset 无关。
- **填一次默认值**：窗口数字（229376 / 24576 / 4096-8192-16384）、裁剪旋钮（strip / 5 / 2000）、两条线的生产连接都是 schema 默认——新安装整表预填，只需填与默认不同的字段。
- **生效即时、免重启**（adapter 每请求读解析值、压缩后端每次 summarize 读）；仅模型目录字段（`contextWindow`/`maxTokens`/`displayName`）需要开新会话。
- **持久化** = `settings.yaml`（热加载）；写路径携带命名空间版本号，过期写入表现为冲突（重读），绝不静默覆盖。

## ⚙️ 配置

设置 tab 是主入口；headless profile 或用补丁/环境时，provider 行配置如下（按 id 定向的补丁替换整个 config 对象，环境回退只作用于补丁没写的字段）：

| 字段 | 环境变量 | 默认 | 含义 |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://localhost:8082/v1` | 服务器地址（含 `/v1`） |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | 请求未带 model 时发送的 id（`GET /v1/models` 核实；llama.cpp 线用自己的 id） |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | model id | GUI 模型选择器的可读名 |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | 服务器 `--api-key`（如设置） |
| `dialect` | `DSH_QWEN38_DIALECT` | `llamacpp` | `ninfer` / `llamacpp`（thinking 方言）；新装默认打开 llama.cpp 线 |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | 声明的上下文容量（压力压缩需要它） |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | 声明的每请求输出帽 |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | 按 effort 的 thinking 硬帽（NInfer 线：发送但被忽略） |
| `defaultThinkingBudget` | — | `16384` | NInfer 线的服务端帽：`--default-thinking-budget` 参数值，与服务器保持同步 |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | 注入未带 effort 的请求；声明后抑制核心选择器的 "Default" 行（与该线的 `off` 冗余） |

压缩裁剪旋钮（仅环境变量，让 preset 行不携带原版 config schema 不认识的键）：

| 环境变量 | 默认 | 含义 |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` 把摘要 prefill 里的图片降为文本占位符——**mmproj offload 到副设备时优选**（摘要器不再在离卡设备上重编码图片）；`keep` 保留，checkpoint 能描述像素（更慢 + 视觉 token 开销） |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | 区域尾部保留 reasoning 的 assistant 轮数 |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | 单条工具结果字符帽（字符不是 token）；`0` 禁用 |

生成的 preset 把压缩后端行的 `maxTokens` 钉在 `24576`（原版 8192 默认帽会截断长 checkpoint；wire 层还会把 compaction 调用的 `max_tokens` 提到该线自身的输出帽）。

## 🔌 Wire 要点

双方言都讲 OpenAI 兼容 `/v1/chat/completions`：`max_tokens`（非 `max_completion_tokens`）、标准 `tools`、`stop`；reasoning 往返走 `reasoning_content` 字段。`finish_reason: length` → harness `max-tokens`（预算/输出截断不表现为完整回答）。服务端报告 usage 时（llama.cpp reasoning-budget 构建；NInfer 在 `stream_options.include_usage` 下——2026-09 验证），GUI 显示逐轮 reasoning tokens。用户图片 → `image_url` data URL（attachment 接缝）；读不到的图降为 `[image: name w×h]` 占位，单个 store 条目缺失从不搞挂请求。

## 🔄 更新

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

若 profile 锁文件仍钉在首次安装时的 commit（`github:` 依赖按精确 commit 解析），remove 后重新 add 即可强制重新解析。client 面以已提交的 `lib/client.js` 出货（web loader 只服务 bundle，不服务 `src/`），使用方无需构建；更新不触碰生成的 preset 与 `qwen38-local-qol:` 设置节。

## 🗑️ 卸载

```sh
dsh plugin --profile web remove dsh-qwen38-local-qol     # 1. 移除依赖
rm -rf ~/.dsh/.agent-presets/qwen38-qol                  # 2. 删除生成的压缩 preset（Windows：C:\Users\<你>\.dsh\.agent-presets\qwen38-qol）
# 3. settings.yaml 删掉 agent-presets: { default: qwen38-qol }（必须——默认项指向已删除的 preset 会让解析报错；setup.js 留有 .bak 备份）
#    可选：删 qwen38-local-qol: 设置节、你设置过的 DSH_QWEN38_* 环境变量
# 4. 重启 DSH host（插件代码在 host 启动时加载）
```

卸载不触碰其他任何东西：会话历史、transcript、模型线、引擎都不是插件持有的状态。

## 📌 已知限制

- **Flash-Next 是配置兼容，未工件验证**（NInfer 尚只出 27B NVFP4）——跑在 `llamacpp` 方言（Unsloth `qwen4exp` 分支），用自己的窗口/预算值。
- **preset 接缝是 web 面功能**：headless profile 不挂 `agent-presets` 行，其压缩改动仍需核心补丁链；provider 路由（thinking 预算）两面都工作。
- **摘要器行为依赖引擎版本**：wire 层规则（thinking 强制 off、compaction `max_tokens` 提到线帽）对所有引擎版本生效（含 stock 0.1.5-alpha.1），但引擎内部行为不在本插件控制之内。

## 🛠️ 开发

```sh
pnpm install
pnpm test               # node --test（host + client + 构建产物）
pnpm run build:client   # 改完 src/client* 后重建 lib/client.js
```

宿主半边 = 带 JSDoc 的裸 ESM JavaScript（dsh-llamacpp 的出货模式）。浏览器半边（`src/client.js` + `src/client-entry.js` 引入 `client.css`）是 `React.createElement` 源码，走共享 `@deepseek-ai/dsh-client-ui-primitives` 控件 + `--dsw-alias-*` 设计令牌，由 `scripts/build-client.mjs` 构建为 DSH client 模块（web loader 作为经典脚本执行的自注册脚本）并以已提交的 `lib/client.js` 出货——浏览器半边任何改动后重建并提交。设计细节见 [DESIGN.md](DESIGN.md)。Peer 钉版：`@deepseek-ai/cordis ^4.0.1`、`@deepseek-ai/dsh-llm ^0.1.1-rc.2`（在 0.1.5-alpha.1 上实跑复验）、`@deepseek-ai/schemastery ^3.18.1`、`react ^18.2.0`。

## 📄 许可

[MIT](LICENSE)
