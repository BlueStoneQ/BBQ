# Mako 安全体系：现状分析 + 解决方案

## 目录

- [一、当前安全现状（已实现）](#一当前安全现状已实现)
- [二、差距分析（vs 工业级）](#二差距分析vs-工业级)
- [三、TODO 清单](#三todo-清单)
- [四、解决方案设计](#四解决方案设计)
  - [Layer 1：工具分级权限](#layer-1工具分级权限)
  - [Layer 2：路径安全](#layer-2路径安全)
  - [Layer 3：命令沙箱](#layer-3命令沙箱)
  - [Layer 4：执行隔离](#layer-4执行隔离)
  - [Layer 5：取消与超时](#layer-5取消与超时)
- [五、实现优先级](#五实现优先级)
- [六、参考：Claude Code 5 层安全模型](#六参考claude-code-5-层安全模型)

---

## 一、当前安全现状（已实现）

| 能力 | 状态 | 实现位置 |
|------|------|---------|
| 危险工具标记 | ✅ | `core/src/types.ts` — `DANGEROUS_TOOLS = Set(['bash', 'write_file', 'replace_in_file'])` |
| 用户确认机制 | ✅ | `core/src/agent.ts` — AsyncGenerator yield `tool_confirm` 事件 |
| y/n/a 三级确认 | ✅ | `cli/src/index.ts` — y(执行) / n(拒绝) / a(本次会话全部信任) |
| MCP 工具默认危险 | ✅ | `mcp/src/server-manager.ts` — 除 alwaysAllow 外全部标记为危险 |
| 文件写入权限检查 | ✅ | `tools/src/write-file.ts` — 捕获 EACCES 错误 |
| 最大循环次数限制 | ✅ | `core/src/agent.ts` — `maxIterations` 防止无限循环 |

**总结**：当前只有最基础的"用户确认"层，相当于 Claude Code 5 层安全中的第 1 层的简化版。

---

## 二、差距分析（vs 工业级）

| 安全维度 | Claude Code | Mako 当前 | 差距 |
|---------|------------|-----------|------|
| **权限规则** | 配置文件定义允许/拒绝规则 | 硬编码 DANGEROUS_TOOLS | 无配置化 |
| **模式切换** | 正常模式 / bypass 模式（仍有安全底线） | 只有 trustAll 开关 | 无分级模式 |
| **工具级检查** | 每个工具独立的权限检查逻辑 | 统一的 Set 判断 | 无细粒度 |
| **路径安全** | 白名单 + 黑名单 + .git/.claude 保护 | 无 | 完全缺失 |
| **OS 沙箱** | macOS Seatbelt 内核级隔离 | 无 | 完全缺失 |
| **命令过滤** | bash 命令黑名单 + 危险模式检测 | 无 | 完全缺失 |
| **超时控制** | 工具级超时 + 全局超时 | 无 | 完全缺失 |
| **取消机制** | 3 层 AbortController 级联 | 无 | 完全缺失 |
| **并发安全** | 读写锁，写入串行化 | 无（当前串行执行） | 未来需要 |

---

## 三、TODO 清单

### P0（必须做，安全底线）

- [ ] **路径白名单/黑名单** — 限制文件操作范围，保护 .git、node_modules、系统文件
- [ ] **bash 命令过滤** — 拦截 `rm -rf /`、`sudo`、`chmod 777` 等危险命令
- [ ] **工具级超时** — 每个工具执行有超时限制，防止 hang
- [ ] **全局 AbortController** — 用户 Ctrl+C 能优雅取消正在执行的工具

### P1（应该做，生产级要求）

- [ ] **权限配置文件** — `.mako/permissions.json` 定义允许/拒绝规则
- [ ] **路径 scope 限制** — Agent 只能操作项目目录内的文件
- [ ] **bash 沙箱** — 限制 bash 工具的环境变量、网络访问
- [ ] **写入前 diff 预览** — 写文件前展示 diff，用户确认后再写入
- [ ] **操作日志** — 记录所有工具调用（审计追踪）

### P2（锦上添花，工业级进阶）

- [ ] **Docker 沙箱** — bash 命令在 Docker 容器中执行
- [ ] **多级信任模式** — 严格模式 / 正常模式 / 信任模式
- [ ] **权限收窄** — 子 Agent 权限只能比父 Agent 少
- [ ] **速率限制** — 防止 Agent 短时间内大量写入/执行
- [ ] **回滚机制** — 文件修改可一键回滚（基于 Git stash 或快照）

---

## 四、解决方案设计

### Layer 1：工具分级权限

**问题**：当前所有危险工具一视同仁，但实际上 `write_file` 和 `bash` 的危险程度完全不同。

**方案**：

```typescript
// 工具危险等级
enum ToolRiskLevel {
  SAFE = 'safe',           // read_file, list_directory, search — 直接执行
  LOW = 'low',             // write_file, replace_in_file — 展示 diff 后执行
  HIGH = 'high',           // bash — 需要用户确认
  CRITICAL = 'critical',   // rm, sudo, chmod — 默认拒绝，需要显式允许
}

// 权限配置（.mako/permissions.json）
interface PermissionConfig {
  mode: 'strict' | 'normal' | 'trust';  // 全局模式
  rules: PermissionRule[];               // 具体规则
}

interface PermissionRule {
  tool: string;                    // 工具名（支持 glob：bash, mcp_*）
  action: 'allow' | 'deny' | 'confirm';
  conditions?: {
    pathPattern?: string;          // 路径匹配
    commandPattern?: string;       // 命令匹配（bash 专用）
  };
}
```

**示例配置**：

```json
{
  "mode": "normal",
  "rules": [
    { "tool": "bash", "action": "confirm" },
    { "tool": "bash", "action": "deny", "conditions": { "commandPattern": "rm -rf *|sudo *|chmod 777*" } },
    { "tool": "write_file", "action": "allow", "conditions": { "pathPattern": "src/**" } },
    { "tool": "write_file", "action": "deny", "conditions": { "pathPattern": ".git/**|.env*" } }
  ]
}
```

---

### Layer 2：路径安全

**问题**：Agent 可以读写任意路径，包括系统文件、其他项目、敏感配置。

**方案**：

```typescript
class PathGuard {
  private projectRoot: string;
  private blacklist: string[] = [
    '.git/**',
    '.env*',
    'node_modules/**',
    '**/*.pem',
    '**/*.key',
    '**/credentials*',
  ];
  private whitelist: string[] = ['src/**', 'docs/**', 'tests/**', '*.md', '*.json'];

  isAllowed(filePath: string): { allowed: boolean; reason?: string } {
    const relative = path.relative(this.projectRoot, filePath);

    // 1. 必须在项目目录内
    if (relative.startsWith('..')) {
      return { allowed: false, reason: '路径超出项目范围' };
    }

    // 2. 黑名单检查
    if (this.matchesAny(relative, this.blacklist)) {
      return { allowed: false, reason: `路径命中黑名单` };
    }

    // 3. 白名单模式（严格模式下）
    if (this.mode === 'strict' && !this.matchesAny(relative, this.whitelist)) {
      return { allowed: false, reason: '路径不在白名单中' };
    }

    return { allowed: true };
  }
}
```

**关键设计**：
- 默认保护 `.git`（防止破坏版本控制）
- 默认保护 `.env*`（防止泄露密钥）
- 项目目录外的路径一律拒绝
- 严格模式下只允许白名单内的路径

---

### Layer 3：命令沙箱

**问题**：bash 工具可以执行任意命令，包括删除文件、安装恶意包、访问网络。

**方案**：

```typescript
class BashGuard {
  // 绝对禁止的命令模式
  private blockedPatterns: RegExp[] = [
    /\brm\s+(-[rf]+\s+)?\//, // rm -rf /
    /\bsudo\b/,              // sudo
    /\bchmod\s+777\b/,       // chmod 777
    /\bcurl\b.*\|\s*bash/,   // curl | bash（远程执行）
    /\beval\b/,              // eval（代码注入）
    /\b(shutdown|reboot|halt)\b/, // 系统命令
  ];

  // 需要确认的命令模式
  private warnPatterns: RegExp[] = [
    /\bnpm\s+(install|i)\b/,  // npm install（可能安装恶意包）
    /\bgit\s+push\b/,         // git push（不可逆）
    /\brm\b/,                 // 任何 rm
    /\bmv\b.*\//,             // mv 到其他目录
  ];

  check(command: string): { action: 'allow' | 'confirm' | 'deny'; reason?: string } {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return { action: 'deny', reason: `危险命令被拦截: ${pattern}` };
      }
    }
    for (const pattern of this.warnPatterns) {
      if (pattern.test(command)) {
        return { action: 'confirm', reason: `命令需要确认: ${command}` };
      }
    }
    return { action: 'allow' };
  }
}
```

---

### Layer 4：执行隔离

**问题**：bash 命令在宿主机直接执行，没有隔离。

**方案（分阶段）**：

**阶段 1：进程级隔离（轻量）**

```typescript
// 限制 bash 子进程的能力
const child = spawn('bash', ['-c', command], {
  cwd: projectRoot,           // 限制工作目录
  timeout: 30_000,            // 30 秒超时
  env: {
    ...sanitizedEnv,          // 过滤敏感环境变量
    PATH: restrictedPath,     // 限制可执行文件路径
  },
  uid: unprivilegedUid,       // 降权执行（Linux/macOS）
});
```

**阶段 2：Docker 隔离（重量级）**

```typescript
// 在 Docker 容器中执行命令
const container = await docker.createContainer({
  Image: 'mako-sandbox:latest',
  Cmd: ['bash', '-c', command],
  HostConfig: {
    Memory: 512 * 1024 * 1024,  // 512MB 内存限制
    CpuPeriod: 100000,
    CpuQuota: 50000,            // 50% CPU
    NetworkMode: 'none',         // 禁止网络（可配置）
    ReadonlyRootfs: true,        // 只读根文件系统
    Binds: [`${projectRoot}:/workspace:rw`], // 只挂载项目目录
  },
});
```

---

### Layer 5：取消与超时

**问题**：用户按 Ctrl+C 时，正在执行的工具无法优雅取消。

**方案**：3 层 AbortController 级联

```typescript
// 层级取消架构
class CancellationTree {
  // L1: 全局取消（用户 Ctrl+C）
  private globalController = new AbortController();

  // L2: 轮次取消（单轮循环超时）
  private iterationController: AbortController | null = null;

  // L3: 工具取消（单个工具超时）
  private toolController: AbortController | null = null;

  startIteration(timeoutMs: number = 120_000) {
    this.iterationController = new AbortController();
    // 全局取消时，轮次也取消
    this.globalController.signal.addEventListener('abort', () => {
      this.iterationController?.abort();
    });
    // 轮次超时
    setTimeout(() => this.iterationController?.abort(), timeoutMs);
  }

  startTool(timeoutMs: number = 30_000) {
    this.toolController = new AbortController();
    // 轮次取消时，工具也取消
    this.iterationController?.signal.addEventListener('abort', () => {
      this.toolController?.abort();
    });
    // 工具超时
    setTimeout(() => this.toolController?.abort(), timeoutMs);
  }

  get toolSignal(): AbortSignal | undefined {
    return this.toolController?.signal;
  }
}
```

**关键设计**：
- 取消是级联的：全局取消 → 轮次取消 → 工具取消
- 每层有独立超时
- 工具实现需要尊重 AbortSignal（`signal.aborted` 检查）

---

## 五、实现优先级

| 优先级 | 能力 | 预估工作量 | 依赖 |
|--------|------|-----------|------|
| **P0-1** | 路径白名单/黑名单 | 1 天 | 无 |
| **P0-2** | bash 命令过滤 | 1 天 | 无 |
| **P0-3** | 工具级超时 | 0.5 天 | 无 |
| **P0-4** | 全局 AbortController | 1 天 | 无 |
| **P1-1** | 权限配置文件 | 2 天 | P0-1 |
| **P1-2** | 路径 scope 限制 | 1 天 | P0-1 |
| **P1-3** | 写入前 diff 预览 | 1 天 | 无 |
| **P1-4** | 操作审计日志 | 1 天 | 无 |
| **P2-1** | Docker 沙箱 | 3 天 | dockerode |
| **P2-2** | 多级信任模式 | 2 天 | P1-1 |
| **P2-3** | 回滚机制 | 2 天 | 无 |

**建议路径**：P0 全部完成（~3.5 天）→ P1 按需（~5 天）→ P2 远期

---

## 六、参考：Claude Code 5 层安全模型

（来源：2026 年 3 月源码泄露逆向分析）

```
Layer 1: Permission Rules（权限规则）
  ├── .claude/settings.json 定义 allow/deny 规则
  ├── 支持 glob 模式匹配
  └── 项目级 + 用户级配置合并

Layer 2: Mode（模式）
  ├── 正常模式：所有危险操作需确认
  ├── Bypass 模式：跳过确认，但仍有安全底线
  └── 安全底线：即使 bypass，.git 和 .claude 目录仍受保护

Layer 3: Tool Checks（工具级检查）
  ├── 每个工具有独立的 permission check 逻辑
  ├── 18+ feature flags 控制工具行为
  └── Zod schema 验证参数合法性

Layer 4: Path Safety（路径安全）
  ├── 项目目录范围限制
  ├── 符号链接解析（防止 symlink 逃逸）
  └── 敏感文件保护（.env, *.key, credentials）

Layer 5: OS Sandbox（操作系统沙箱）
  ├── macOS: Seatbelt（sandbox-exec）
  ├── 内核级文件系统访问控制
  └── 网络访问限制
```

**Mako 的目标**：实现 Layer 1-4（纯应用层安全），Layer 5 作为远期目标（需要 OS 级支持）。
