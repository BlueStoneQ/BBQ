# XRN 热更新

→ [XRN 总览](./README.md)

→ [card2: HMR 工程化（灰度+观测+回滚）](../../card2:engineering/HMR.md)

## 目录

- [核心主题索引](#核心主题索引)
- [QA](#qa)
  - [Q0: CrashGuard 整体流程？](#q0-crashguard-整体流程)
  - [Q1: diff 建设在哪些端？](#q1-diff-建设在哪些端)
- [Server 端方案选型](#server-端方案选型)


## 核心主题索引

| 主题 | 链接 |
|------|------|
| 灰度 + 观测 + 回滚 | [HMR.md](../../card2:engineering/HMR.md) |
| 版本管理 + Bundle 文件目录 | [android-shell: Bundle 文件管理](./android-shell/README.md#bundle-文件管理) |
| 客户端 SDK 接口 | [native-shell: §五热更新接口](../../../../root/XRN/native-shell.md#五热更新接口) |
| CrashGuard 崩溃回退 | [native-shell: §四稳定性保障](../../../../root/XRN/native-shell.md#四稳定性保障crashguard) |
| diff 方案 | [本文 Q1](#q1-diff-建设在哪些端) |
| Server 方案选型 | [本文](#server-端方案选型) |

# QA

## Q0: CrashGuard 整体流程？

监测到连续崩溃 → 标记当前 hot bundle 不可用 → 清空 hot/ → 回退到 [builtin 版本(内置版本)](#注释builtin) → 上报 Sentry。当次显示兜底 UI 或 reload builtin。[→ 触发策略](#注释crashguard-触发策略)

---

## Q1: diff 建设在哪些端？

**Server 端**：计算 diff。上传新版 bundle 时，Server 用 [**bsdiff**](#注释bsdiff) 对比新旧 .hbc → 产出 patch 文件 → 存 CDN。

**Native 端（Android/iOS）**：apply patch。客户端下载 patch 后，用 **bspatch** 合成完整 .hbc → 写入 hot/ 目录。下次启动加载合成后的完整文件。

```
Server: new.hbc + old.hbc → bsdiff → patch（几十 KB）→ CDN
Native: 下载 patch + 本地 old.hbc → bspatch → new.hbc → 写入磁盘
运行时: 加载完整 new.hbc（和全量下载一样，零额外开销）
```

构建阶段不涉及 diff——构建只管产出完整 .hbc。diff 发生在发布阶段（Server）和下载阶段（Native）。

**下载时机**：首页渲染完成后立即触发diff包下载，后台线程下载，不阻塞主线程/JS线程，下次启动生效。

---

## server 端方案选型

| 方案 | 状态 | 适用 | 说明 |
|------|------|------|------|
| **CodePush**（微软） | ❌ 停维护 | — | 2024 后不再更新 |
| **Pushy**（reactnative.cn） | 活跃 | 中小团队 | 国内开源，差量(bsdiff) + 灰度 + 可自部署，但只支持单 Bundle |
| **EAS Update**（Expo） | 活跃 | 小团队 | 托管服务，简单但不可控 |
| **自建**（XRN/CRN） | — | 中大团队 | 多 Bundle + 灰度 + 差量 + 回滚 + 监控联动，完全可控 |

结论：多 Bundle 架构必须自建（Pushy/CodePush 都是单 Bundle 设计）。可参考 Pushy 的 bsdiff 实现，灰度/多 Bundle自己做。

---

# 注释

<a id="注释bsdiff"></a>
### bsdiff / bspatch

C 语言写的二进制差量算法库（Colin Percival，FreeBSD 作者）。专门针对二进制文件做 diff/patch，比文本 diff 对 .hbc 这种字节码文件效果好得多。

- Server 端：调 `bsdiff old.hbc new.hbc patch.bin`（可以用 Node.js 的 `bsdiff-node` 封装，底层还是 C）, 命令行工具?
- Native 端：C++层 集成 bspatch C 库（Android 通过 JNI 调用，iOS 直接链接 .a）

<a id="注释crashguard-触发策略"></a>
### CrashGuard 触发策略

```
每次启动：counter +1
稳定运行 5s：counter 清零
连续 2 次 counter 没清零 → 判定当前 bundle 有问题 → 触发回退
```

回退动作：清空 hot/ → manifest 重置为 builtin → 下次启动加载 builtin（随 APK 的稳定版本）。

不回退到"上一个热更新版本"——直接回 builtin 最安全。

<a id="注释builtin"></a>
### builtin 版本

随 APK/IPA 安装时内置的 bundle（`builtin/` 目录，只读）。是最安全的兜底——一定能用，因为它经过了商店审核发布流程。回退时不是"上一个热更新版本"（也可能有问题），而是直接回到这个随包版本。
