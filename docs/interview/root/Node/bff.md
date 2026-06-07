# BFF 与中间层

> 解决什么问题：前端直接调后端微服务？接口散、字段多、格式不统一、鉴权逻辑重复。BFF 在前后端之间加一层，专门为前端服务。
>
> 本质：BFF（Backend For Frontend）= 前端专属的 API 聚合层。不是"又一个后端"，是"前端的接口翻译官"。
>
> 场景：DD 运营平台（多微服务聚合）、负载分析平台（Node 全栈）、KS（Node.js 加分）。

---

## 目录

- [为什么需要 BFF](#为什么需要-bff)
- [BFF 做什么不做什么](#bff-做什么不做什么)
- [技术选型](#技术选型)
- [GraphQL vs REST 聚合](#graphql-vs-rest-聚合)
- [BFF 架构模式](#bff-架构模式)
- [鉴权在 BFF 层怎么做](#鉴权在-bff-层怎么做)
- [性能与稳定性](#性能与稳定性)
- [Q&A](#qa)

---

## 为什么需要 BFF

```
没有 BFF：
  前端 → 直接调 10 个微服务 API
  问题：
    - 一个页面调 5 个接口（串行/并行复杂）
    - 每个接口返回 50 个字段，前端只用 5 个（浪费带宽）
    - 鉴权逻辑每个页面重复写
    - 后端接口改了前端跟着改（强耦合）
    - 移动端和 Web 端需要不同字段（没法统一）

有 BFF：
  前端 → BFF（一个接口拿到页面所需全部数据）→ 后端微服务
  好处：
    - 一个页面一个接口（前端简单）
    - BFF 裁剪字段（只返回前端需要的）
    - 鉴权统一在 BFF 做（前端不管）
    - 后端改接口，只改 BFF 适配层（前端不感知）
    - 不同端可以有不同 BFF（移动端/Web/小程序）
```

---

## BFF 做什么不做什么

| BFF 做 | BFF 不做 |
|--------|---------|
| API 聚合（多个接口合一个） | 核心业务逻辑 |
| 字段裁剪/格式转换 | 数据库操作 |
| 鉴权/权限校验 | 复杂计算 |
| 缓存（Redis） | 事务处理 |
| 错误统一处理 | 订单/支付等核心流程 |
| 面向前端的数据编排 | 数据一致性保证 |

**BFF 是薄的**：不做重逻辑，只做"翻译 + 聚合 + 裁剪"。如果 BFF 越来越厚，说明职责划分有问题。

---

## 技术选型

| 方案 | 适合 | 特点 |
|------|------|------|
| Express / Koa | 简单 REST 聚合 | 轻量，上手快 |
| Fastify | 高性能 REST | 比 Express 快 2x，schema 验证 |
| NestJS | 大型 BFF（多模块/多团队） | 企业级，DI + 模块化 + 装饰器 |
| Nuxt Server Routes / Nitro | SSR 项目自带 BFF | 不用单独部署服务 |
| GraphQL（Apollo Server） | 多端多场景 | 前端按需取字段，一个端点 |

**DD 场景推荐**：NestJS（企业级 + 微前端配套）或 Nuxt Server Routes（SSR 一体化）。

---

## GraphQL vs REST 聚合

| | REST 聚合 | GraphQL |
|---|---|---|
| 接口数量 | 多个 endpoint | 一个 endpoint |
| 前端取字段 | BFF 定死返回什么 | 前端自己选要什么字段 |
| Over-fetching | BFF 控制 | 天然解决 |
| 学习成本 | 低 | 中（Schema/Resolver） |
| 缓存 | HTTP 缓存简单 | 需要 Apollo Client 等 |
| 适合 | 接口稳定、前后端一个团队 | 多端多场景、前端主导 |

---

## BFF 架构模式

```
模式 1：统一 BFF（一个服务聚合所有）
  前端 → BFF → 微服务 A / B / C
  适合：小团队，前端 1-2 人

模式 2：按端拆分
  Web 前端 → Web BFF → 微服务
  移动端 → Mobile BFF → 微服务
  适合：不同端需要不同数据

模式 3：按业务域拆分（网关 + 多 BFF）
  前端 → API Gateway → BFF-用户 / BFF-订单 / BFF-支付 → 微服务
  适合：大团队，按业务域独立开发部署
```

---

## 鉴权在 BFF 层怎么做

```
典型流程：
  1. 前端请求带 token（header: Authorization: Bearer xxx）
  2. BFF 中间件验证 token（JWT 验签 / 调认证服务）
  3. 验证通过 → 请求打上用户信息 → 转发给下游微服务
  4. 验证失败 → 返回 401

// NestJS Guard 示例
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return this.userService.getProfile(user.id);
}
```

**好处**：鉴权逻辑集中在 BFF 一处，下游微服务不用重复验证（信任 BFF 传来的用户信息）。

---

## 性能与稳定性

| 问题 | 解决 |
|------|------|
| BFF 成为瓶颈 | 并行调用下游接口（Promise.all）而不是串行 |
| 下游超时 | 设置超时 + 降级（部分数据缺失但页面能用） |
| 缓存 | Redis 缓存热数据（用户信息/配置等） |
| 限流 | 对高频接口做限流保护 |
| 监控 | 每个下游调用记录耗时 + 错误率 |

```ts
// 并行聚合 + 超时降级
async function getHomepageData(userId: string) {
  const [user, tasks, notifications] = await Promise.allSettled([
    userService.getUser(userId),
    taskService.getTasks(userId),
    notifyService.getNotifications(userId),  // 这个挂了也没关系
  ]);

  return {
    user: user.status === 'fulfilled' ? user.value : null,
    tasks: tasks.status === 'fulfilled' ? tasks.value : [],
    notifications: notifications.status === 'fulfilled' ? notifications.value : [],
  };
}
```

---

## Q&A

| 问题 | 一句话 |
|------|--------|
| 为什么需要 BFF？ | 聚合多微服务接口 + 裁剪字段 + 统一鉴权，前端只调一个接口 |
| BFF 和后端的区别？ | BFF 是薄层（翻译+聚合），不做核心业务逻辑和数据库操作 |
| GraphQL 和 REST BFF 怎么选？ | 多端多场景 → GraphQL；接口稳定单端 → REST 聚合 |
| BFF 会不会成为瓶颈？ | Promise.all 并行 + Redis 缓存 + 超时降级 |
| 鉴权放哪层？ | BFF 统一验证 token，下游信任 BFF 传来的用户身份 |
