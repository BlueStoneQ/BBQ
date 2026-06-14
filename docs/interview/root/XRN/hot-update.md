# 热更新子系统

> 本质：不发版修 Bug。把"应用商店审核周期"从天级缩短到分钟级。
>
> XRN 差异化：模块级独立热更新（非整包），每个 Bundle 独立版本/灰度/回滚。

---

## 目录

- [全流程](#全流程)
- [差量更新（bsdiff）](#差量更新bsdiff)
- [灰度策略](#灰度策略)
- [回滚机制](#回滚机制)
- [vs CodePush](#vs-codepush)
- [Push Server](#push-server)

---

## 全流程

```
发布侧：
  xrn publish home → Bundler 构建 home.hbc → Publisher 上传 OSS
  → Server 和上一版本算 bsdiff → 存 diff 包 → 注册新版本 + 配灰度

客户端侧：
  App 启动/前台 → Updater 调 /check-update（带各 Bundle 版本号）
  → Server 判断灰度 → 返回需更新列表 + diff/全量 URL
  → 下载 → bspatch 合并 → hash 校验 → 写入本地 → 标记待生效

生效：
  下次启动加载新版本（静默）或当次重载（强制）
  加载失败/crash → CrashGuard 自动回退
```

---

## 差量更新（bsdiff）

**核心库**：bsdiff/bspatch（C 库）。Server 用 node-bsdiff，客户端 JNI/C Bridge。

**关键：发布时预算，非请求时动态算。无 Server 实时压力。**

```
发布时：
  新版本上传 → Server 立即和上一版本算 diff → 全量包 + diff 包都存 OSS(Object Storage Service（对象存储）)

请求时：
  客户端传 currentVersion → Server 查预算好的 diff → 返回 CDN URL
  跨版本（没有对应 diff）→ 返回全量包

客户端合并：
  bspatch: old.hbc + patch.diff → new.hbc → SHA-256 校验 → 不一致用全量兜底

策略：只预算相邻版本 diff。跨版本用全量（几百 KB 可接受）。
```

---

## 灰度策略

```
维度：按比例 / 用户 ID / 设备类型 / 地区 / App 版本

实现：
  /check-update 带设备信息 → Server 根据灰度配置判断是否命中
  命中 → 返回新版本；未命中 → 返回"无更新"

推进：5% → 观测 2h → 30% → 观测 12h → 100%
每阶段看 crash 率，超阈值自动停。
```

---

## 回滚机制

```
两层：

客户端（快，秒级）：
  CrashGuard 检测连续 crash 2 次 → 自动回退 fallback 版本 → 上报

服务端（全局）：
  收到上报 → 聚合 crash 率 → 超 0.5% → 停灰度 + 通知
  或手动 xrn rollback home
```

---

## vs CodePush

| | CodePush | XRN |
|--|---------|-----|
| 分 Bundle | ❌ 整包 | ✅ 模块独立 |
| 灰度 | 只按比例 | 多维度 |
| 自动回滚 | ❌ | ✅ crash 率触发 |
| 自建可控 | ❌ 微软云 | ✅ 自部署 |
| 多团队协作 | ❌ 耦合 | ✅ 独立发版 |

---

## Push Server

**本质**：文件分发 + 版本管理 API。自建代码 + 云部署。

```
技术栈：Fastify + PostgreSQL + S3/OSS + CDN
核心 API：check-update / publish / download / report / rollback
代码量：核心 < 2000 行，生产级 2-3 周

为什么自建：分 Bundle 粒度 + 灰度联动 + 数据可控，第三方不支持。
```

---
