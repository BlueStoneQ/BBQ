# GraphQL

> 解决什么问题：REST API 的 Over-fetching / Under-fetching 问题——前端要什么数据，自己定义查询，后端按需返回。
>
> 本质：GraphQL = 一套 API 查询语言 + 运行时。前端写"数据需求的形状"，后端按这个形状精确返回。
>
> 场景：BFF 层数据聚合、多端多场景（Web/App/小程序需要不同字段）、复杂数据关系图（社交网络/内容系统）。

---

## 目录

- [为什么需要 GraphQL](#为什么需要-graphql)
- [核心概念](#核心概念)
  - [Schema（类型系统）](#schema类型系统)
  - [Resolver（解析器）](#resolver解析器)
  - [Query / Mutation / Subscription](#query--mutation--subscription)
- [运行原理](#运行原理)
- [使用范式（Node.js + Apollo）](#使用范式nodejs--apollo)
- [GraphQL vs REST](#graphql-vs-rest)
- [在 BFF 中的定位](#在-bff-中的定位)
- [常见问题与局限](#常见问题与局限)
- [Q&A](#qa)

---

## 为什么需要 GraphQL

```
REST 的问题（前端视角）：

  场景：用户主页需要显示"用户信息 + 最近 5 条动态 + 3 个好友头像"

  REST 做法：
    GET /api/user/123            → 返回 50 个字段（只用 5 个）= Over-fetching
    GET /api/user/123/articles      → 返回所有帖子（只要 5 条）= Over-fetching
    GET /api/user/123/friends    → 再一个请求 = Under-fetching（一个页面需要 3 次请求）

  GraphQL 做法：
    一个请求，精确描述需要什么：
    query {
      user(id: "123") {
        name
        avatar
        articles(limit: 5) { title, createdAt }
        friends(limit: 3) { avatar }
      }
    }
    → 一次请求，精确返回所需字段，不多不少
```

---

## 核心概念

> 以下三部分用**同一个例子**贯穿：一个博客系统，User 有 name 和 articles。

### Schema（类型系统）

> 定义在**服务端**。是 API 的契约——前端知道能查什么，后端知道要提供什么。

```graphql
# 类型定义
type User {
  id: ID!
  name: String!
  articles: [Article!]!       # 嵌套类型：一个用户有多篇帖子
}

type Article {
  id: ID!
  title: String!
}

# 查询入口（Query/Mutation/Subscription 是 GraphQL 约定的三个特殊类型名，引擎靠名字识别入口）
# type 是关键字（声明类型），User/Article 是自定义业务类型
type Query {
  user(id: ID!): User   # 根据 id 查用户
}

# 修改入口
type Mutation {
  createArticle(userId: ID!, title: String!): Article!
}

# 订阅入口（实时推送，底层走 WebSocket）
type Subscription {
  articleCreated: Article!
}
```

### Resolver（解析器）

> 定义在**服务端**，和 Schema **一一对应**。Schema 说"有什么字段"，Resolver 说"这个字段的数据从哪来"。

```typescript
const resolvers = {
  // ① 入口：对应 Schema 的 type Query（前端查询从这里开始）
  Query: {
    user: (_, { id }) => db.users.findById(id),
    //     ↑ 根入口无 parent，用 _ 占位
    //          ↑ 参数（对应 Schema 中 user(id: ID!) 的 id）
    // 返回值如 { id: "1", name: "Tom" }
    // 返回类型是 User（Schema 中 user(id: ID!): User 声明的）
    // → 引擎看到返回类型是 User，就去 resolvers.User 找对应字段的 resolver
  },

  // ② 嵌套类型：对应 Schema 的 type User
  // 调用链怎么串起来的？不是代码里手动调用，是引擎根据 Schema 的类型引用自动串联：
  //   Schema: Query.user 返回类型 = User → 引擎自动把 ① 的返回值作为 parent 传给 ②
  //   开发者只需平级写 resolver，引擎负责按类型关系递归调用
  User: {
    // id/name → 不用写（默认行为：引擎自动取 parent.id / parent.name）
    // articles → 需要额外查数据库，必须显式写
    articles: (parent) => db.articles.findByUserId(parent.id),
    //         ↑ parent = ① Query.user 返回的 { id: "1", name: "Tom" }
  },

  // ③ 对应 Schema 的 type Mutation
  Mutation: {
    createArticle: (_, { userId, title }) => db.articles.create({ userId, title }),
  },

  // ④ 对应 Schema 的 type Subscription
  Subscription: {
    articleCreated: {
      subscribe: () => pubsub.asyncIterator(['ARTICLE_CREATED']),
    },
  },
};
```

### 三者的对应关系

```
Schema（定义能力）→ Resolver（实现能力）→ Query（消费能力）

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Schema（服务端）  │     │ Resolver（服务端） │     │  Query（客户端）   │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ Query.user(id)   │ ──► │ Query.user       │ ◄── │ query {          │
│                  │     │  → db.users      │     │   user(id:"1") { │
│ User.name        │ ──► │ （默认 resolver） │     │     name         │
│ User.articles       │ ──► │ User.articles       │     │     articles {      │
│                  │     │  → db.articles      │     │       title      │
│ Article.title       │ ──► │ （默认 resolver） │     │     }            │
└──────────────────┘     └──────────────────┘     │   }              │
                                                  │ }                │
                                                  └──────────────────┘

执行链路：
  1. 前端发 query → 引擎校验是否符合 Schema ✓
  2. 调 Query.user("1") → 返回 { id:"1", name:"Tom" }
  3. 前端要了 name → 取 parent.name = "Tom"（默认 resolver）
  4. 前端要了 articles → 调 User.articles(parent) → 返回 [{id:"1",title:"Hello"}]
  5. 前端要了 title → 取 parent.title = "Hello"（默认 resolver）
  6. 拼装返回：{ "data": { "user": { "name": "Tom", "articles": [{"title": "Hello"}] } } }

关键：前端没写的字段（如 user.id）→ 对应 Resolver 不会被调用 → 响应里没有
= 按需取数据的机制
```

### Query / Mutation / Subscription

> 由**前端（客户端）**编写并发送给服务端。前端决定"要什么字段"，服务端校验后按 Schema 执行。

| 操作 | 类比 REST | 用途 |
|------|----------|------|
| Query | GET | 读数据 |
| Mutation | POST/PUT/DELETE | 写数据 |
| Subscription | WebSocket | 实时推送 |

```graphql
# Query — 读（对应 Schema 的 type Query）
query {
  user(id: "1") {
    name
    articles { title }
  }
}

# Mutation — 写（对应 Schema 的 type Mutation）
mutation {
  createArticle(userId: "1", title: "New Article") {
    id
    title
  }
}

# Subscription — 实时（底层走 WebSocket）
subscription {
  articleCreated { title }
}
```

---

## 运行原理

```
前端发送查询 → GraphQL 引擎处理 → 返回结果

详细链路：
  1. 前端发送 POST 请求（body = GraphQL 查询字符串）
  2. GraphQL 引擎解析查询 → AST（抽象语法树）
  3. 校验：查询是否符合 Schema 定义（类型检查）
  4. 执行：从根 Query 开始，递归调用每个字段的 Resolver
  5. Resolver 可能调用数据库/微服务/缓存
  6. 拼装结果为查询请求的"形状" → 返回 JSON

执行模型（树形递归）：
  query { user(id:"123") { name, articles { title } } }

  → 调用 Query.user(id:"123")          → 得到 user 对象
    → 调用 User.name(parent=user)       → "Tom"
    → 调用 User.articles(parent=user)      → [article1, article2]
      → 调用 Article.title(parent=article1)   → "Hello"
      → 调用 Article.title(parent=article2)   → "World"
  → 拼装：{ user: { name: "Tom", articles: [{ title: "Hello" }, { title: "World" }] } }
```

---

## 使用范式

### 服务端（裸 Node.js）

> 只依赖 `graphql` 核心库，不需要任何框架。GraphQL 本质就是"接收查询字符串 → 执行 → 返回 JSON"。

```bash
pnpm add graphql
```

```typescript
// server.ts — 裸 Node.js + graphql 核心库
import http from 'http';
import { graphql, buildSchema } from 'graphql';

// 1. 定义 Schema（SDL 字符串）
const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
    articles: [Article!]!
  }
  type Article {
    id: ID!
    title: String!
  }
  type Query {
    user(id: ID!): User
  }
`);

// 2. 定义 Resolver（和 Schema 一一对应）
const rootValue = {
  user: async ({ id }) => {
    const user = await db.users.findById(id);
    return {
      ...user,
      // 嵌套字段的 resolver
      articles: () => db.articles.findByUserId(id),
    };
  },
};

// 3. 创建 HTTP 服务
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/graphql') {
    const body = await getBody(req);
    const { query, variables } = JSON.parse(body);

    // graphql() = 核心执行函数：schema + query → result
    const result = await graphql({ schema, source: query, rootValue, variableValues: variables });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
}).listen(4000);

// 本质：一个 POST 端点，接收 query 字符串，用 graphql() 执行，返回 JSON
// 框架（Apollo/NestJS/Yoga）只是帮你处理 HTTP 解析、错误、中间件等脏活
```

> **实际项目推荐**：DD/大型 BFF 场景用 NestJS + `@nestjs/graphql`（企业级 DI + 装饰器 + 模块化），轻量场景用 graphql-yoga 或 Apollo Server。裸 Node.js 只为理解本质。

### 前端调用

```typescript
// 方式 1：裸 fetch（不依赖任何 GraphQL 客户端库）
const result = await fetch('/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query GetUser($id: ID!) {
        user(id: $id) {
          name
          articles { title }
        }
      }
    `,
    variables: { id: '123' },
  }),
}).then(r => r.json());

// result.data.user.name / result.data.user.articles

// 方式 2：Apollo Client（React 项目常用，带缓存/loading 状态管理）
// 方式 3：urql（更轻量的 GraphQL 客户端）
```

---

## GraphQL vs REST

| 维度 | REST | GraphQL |
|------|------|---------|
| 端点数量 | 每个资源一个 URL（N 个） | 一个 endpoint（`/graphql`） |
| 数据量 | 后端决定返回什么 | 前端决定要什么 |
| Over-fetching | 常见 | 不存在 |
| Under-fetching | 常见（需多次请求） | 不存在（一次查完） |
| 缓存 | HTTP 缓存天然支持（URL 级别） | 需要客户端缓存（Apollo Client） |
| 版本管理 | `/api/v1/` `/api/v2/` | 不需要版本（Schema 演进，废弃字段加 @deprecated） |
| 学习成本 | 低 | 中（Schema/Resolver/客户端） |
| 调试 | 简单（curl/浏览器直接访问） | 需要 GraphQL Playground |
| 适合 | CRUD 简单、接口稳定 | 多端多场景、复杂数据关系 |

**什么时候用 REST 就够了**：
- 团队小、接口少、前后端同一人
- 资源结构简单（纯 CRUD）
- 不需要多端差异化

**什么时候该用 GraphQL**：
- 一个页面需要聚合多个数据源
- 移动端和 Web 端需要不同字段
- 数据有复杂关联关系（用户 → 帖子 → 评论 → 点赞）
- 后端微服务多，前端不想关心谁提供什么

---

## 在 BFF 中的定位

```
GraphQL 天然就是 BFF 的最佳实现之一：

  前端 → GraphQL BFF（一个 endpoint）→ 下游微服务 A/B/C

  GraphQL BFF 做的事：
    - Schema 定义前端能查什么
    - Resolver 里调用下游微服务获取数据
    - 自动按前端查询裁剪字段
    - 聚合多个数据源为一次响应

  vs REST BFF：
    REST BFF 需要为每个页面手动写聚合接口
    GraphQL BFF 前端自己写查询，BFF 自动聚合

架构图：
  ┌─────────┐     query { user, articles }     ┌──────────────┐
  │  前端    │ ────────────────────────────► │ GraphQL BFF  │
  │ (Apollo │                               │ (Apollo      │
  │  Client)│ ◄──── { user, articles } ─────── │  Server)     │
  └─────────┘                               └──────┬───────┘
                                                    │
                              ┌──────────────────────┼──────────────────┐
                              ↓                      ↓                  ↓
                        用户微服务              帖子微服务          好友微服务
```

---

## 常见问题与局限

| 问题 | 说明 | 解法 |
|------|------|------|
| **N+1 查询** | 查 10 个用户的帖子 → Resolver 被调 10 次 → 10 次数据库查询 | DataLoader（批量 + 缓存） |
| **复杂查询攻击** | 恶意嵌套查询（用户→帖子→评论→用户→帖子...无限套娃） | 查询深度限制 / 复杂度计算 / 超时 |
| **缓存困难** | 不像 REST 有天然 URL 级 HTTP 缓存 | Apollo Client 客户端 normalized cache |
| **文件上传** | GraphQL 规范不支持 multipart | graphql-upload 扩展或单独 REST 接口 |
| **学习曲线** | 团队需要理解 Schema/Resolver/客户端 | 渐进式引入（先在 BFF 内部用） |

**N+1 问题详解**：

```typescript
// 问题：查 users 列表，每个 user 的 articles Resolver 各调一次数据库
// 结果：1 次查 users + N 次查 articles = N+1 次 DB 调用

// 解法：DataLoader（Facebook 开源）
import DataLoader from 'dataloader';

const articleLoader = new DataLoader(async (userIds) => {
  // 一次性查所有用户的帖子（批量查询）
  const articles = await db.articles.findByUserIds(userIds);
  // 按 userId 分组返回
  return userIds.map(id => articles.filter(p => p.userId === id));
});

// Resolver 中使用
User: {
  articles: (parent) => articleLoader.load(parent.id),  // 自动批量 + 缓存
}
```

---

## Q&A

### 原理类

**Q：GraphQL 是怎么执行查询的？**

A：前端发查询字符串 → 引擎解析为 AST → 校验是否符合 Schema → 从根 Query 递归执行 Resolver → 每个字段调对应 Resolver 函数 → 拼装为查询"形状"的 JSON 返回。

**Q：Resolver 的执行顺序是什么？**

A：树形递归，从根往叶子走。先执行 Query 级 Resolver 拿到父对象，再对每个子字段执行 Resolver（parent 参数 = 上一级的返回值）。同级字段并行执行。

**Q：GraphQL 怎么解决 Over-fetching？**

A：前端在查询中只写需要的字段，GraphQL 引擎只调用这些字段的 Resolver，不查不需要的数据。返回 JSON 的结构 = 查询的结构。

### 场景类

**Q：N+1 问题怎么解决？**

A：DataLoader。原理：把同一 tick 内的多个 `.load(id)` 调用合并为一次 `.loadMany([ids])`，批量查询后按 id 分发结果。同时有请求级缓存。

**Q：怎么防止恶意深度嵌套查询？**

A：配置查询深度限制（如 max depth = 5）+ 查询复杂度计算（每个字段有成本，总成本不超阈值）+ 查询白名单（persisted queries）。

**Q：GraphQL 和 REST 能共存吗？**

A：可以。常见做法：新功能用 GraphQL，存量接口保留 REST；或 GraphQL 做 BFF 网关，内部调 REST 微服务。两者不冲突。

### 对比类

**Q：什么时候不该用 GraphQL？**

A：简单 CRUD 应用、团队小且接口稳定、需要强 HTTP 缓存（CDN）、文件上传为主的场景。GraphQL 的价值在复杂聚合和多端差异化，简单场景引入它是过度工程化。
