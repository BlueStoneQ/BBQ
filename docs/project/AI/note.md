# AI 学习笔记（随手记）

> 聊天中的问题和思考，聊透了再整理到正式文档。整理后从这里清除。

---

## 2026-04-16

### Q: 压缩 + 笔记本是不是解决多轮对话和跨会话共享的方案？

对。压缩（Compaction）解决单次会话内上下文窗口不够的问题——把历史对话压缩成摘要。笔记本（Memory/Notes）解决跨会话信息共享——提取关键信息持久化存储，下次会话自动加载。目前业界主流就是这两个组合，没有更好的银弹。

### Q: Kiro 为什么不能跨会话共享信息？

Kiro 没有自动跨会话记忆，每次新对话从零开始。但有手动版"笔记本"——Steering 文件（`.kiro/steering/*.md`），每次对话自动加载。差的是"自动提取"这一步。

### Q: Claude Memory 的关键机制是什么？

1. 自动提取：LLM 自己判断哪些信息值得记住
2. 持久化：存在 `~/.claude/CLAUDE.md`，纯文本可编辑
3. 自动加载：新会话开始时注入上下文
4. 用户可控：能看、能删、能手动加

本质：LLM 自己当笔记员，自动往 Markdown 文件记笔记，下次对话前先读笔记。Kiro 的 Steering 是手动版，差"自动提取"这一步。


### Q: OpenClaw 的会话管理用什么方案？

Session 隔离：飞书话题（Thread）机制，每个话题通过 rootId 隔离。并发控制：Slot 机制（MAX_ACTIVE_SLOTS=6），满了排队。持久化：SQLite，重启可恢复。本质是有限并发的任务调度器 + 按话题 ID 隔离的 Session 存储。

### Q: OpenClaw vs Claude Code 架构对比

**Claude Code**：终端 CLI 程序，极简直连（CLI → Anthropic API → 工具执行），绑定 Claude，单会话，个人使用，无 Skill 机制但有自动 Memory（CLAUDE.md），无中间层。

**OpenClaw**：后台 Server 服务，平台化（飞书 → VLB → VCB → AI 引擎 → 工具执行），引擎无关可切换，多话题并行（Slot），团队协作，有 Skill/Steering/Hooks 机制，无自动 Memory。

**本质差异**：Claude Code 把 Loop + Context + Side Effects 都自己做了；OpenClaw 把"循环"和"上下文"抽出来做了一层管理，"副作用"交给底层引擎。OpenClaw 可以把 Claude Code 作为底层引擎来用。

**类比**：Claude Code 像直接用 Python 解释器，OpenClaw 像 Jupyter Notebook Server。

### Q: OpenClaw 本质上很轻？

对。VCB 自己不做"智能"的事，只做：收发消息、组装上下文、转发给引擎、管理会话。真正的大脑和手脚都是 AI 引擎。VCB 是一个调度壳，价值在于把 AI 引擎包装成可管理的服务 + Skill/Steering/Hooks 可配置机制 + 聊天平台入口 + 多会话并行。类比 Nginx——本身很轻，但没有它就没法做路由和负载均衡。

和传统 Web Server 的唯一区别：传统 Server 的业务逻辑是硬编码的，VCB 的业务逻辑是 LLM 实时生成的。
