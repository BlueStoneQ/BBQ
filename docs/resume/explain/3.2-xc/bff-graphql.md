# BFF + GraphQL 聚合裁剪

## BFF（Backend For Frontend）

在前端和后端微服务之间加一层中间层，专门为前端服务。什么语言都可以写（Node.js/Java/Go），通常前端团队用 Node.js 维护。

## 解决的问题

1. 前端一个页面要调 4-5 个微服务接口，串行慢并行复杂
2. 每个接口返回一大坨数据，前端只用几个字段，浪费流量（移动端敏感）
3. 后端改接口，所有前端都要改
4. 不同端（App/Web/小程序）需要的数据不一样，后端不想为每个端写专用接口

## GraphQL 在 BFF 里的作用

- **聚合**：一个查询同时从多个微服务拿数据，前端一次请求搞定
- **裁剪**：前端只要什么字段就返回什么字段（按需查询），减少传输量

## 为什么用 GraphQL 而不是 REST 聚合

GraphQL 的优势是前端自定义返回字段（按需裁剪），REST 聚合接口返回固定结构，改字段要改后端。

## 在 XC 机酒频道的场景

机酒页面一屏展示酒店信息、价格、库存、用户优惠券，数据来自不同微服务。BFF + GraphQL 一次请求聚合所有数据，按需裁剪减少流量。

## 后端需要做什么

不需要做什么。后端正常提供微服务接口，BFF 是前端自己加的一层，对后端透明。BFF 本质是前端的事——谁用谁维护，不求人。

## 架构图

```
前端（RN App）
  ↓ 一个 GraphQL 查询
BFF 层（Node.js + GraphQL）
  ↓ 并行调用
酒店服务 / 价格服务 / 库存服务 / 用户服务
  ↓ 聚合 + 裁剪
返回前端需要的精确数据
```

---

## 三层经典代码示例

### 第一层：前端（RN App）— 发一个 GraphQL 查询

```typescript
// 前端只写"我要什么"，不关心数据从哪来
const query = `
  query HotelDetail($hotelId: ID!) {
    hotel(id: $hotelId) {
      name
      rating
      images(first: 3)        # 只要前 3 张图
    }
    price(hotelId: $hotelId) {
      amount
      currency
      discount
    }
    userCoupons(hotelId: $hotelId) {
      code
      value
    }
  }
`;

// 一次请求，拿到所有数据
const { data } = await client.query({ query, variables: { hotelId: '123' } });
// data.hotel / data.price / data.userCoupons 直接用
```

### 第二层：BFF 层（Node.js + Apollo Server）— 聚合 + 裁剪

```typescript
// schema 定义（告诉 GraphQL "有哪些字段可以查"）
const typeDefs = `
  type Hotel { name: String, rating: Float, images(first: Int): [String] }
  type Price { amount: Float, currency: String, discount: Float }
  type Coupon { code: String, value: Float }

  type Query {
    hotel(id: ID!): Hotel
    price(hotelId: ID!): Price
    userCoupons(hotelId: ID!): [Coupon]
  }
`;

// resolver（每个字段怎么拿数据 — 调后端微服务）
const resolvers = {
  Query: {
    hotel: async (_, { id }) => {
      // 调酒店微服务
      const res = await fetch(`http://hotel-service/api/hotels/${id}`);
      return res.json();  // 返回完整数据，GraphQL 引擎自动裁剪到前端要的字段
    },
    price: async (_, { hotelId }) => {
      // 调价格微服务
      const res = await fetch(`http://price-service/api/prices?hotel=${hotelId}`);
      return res.json();
    },
    userCoupons: async (_, { hotelId }, context) => {
      // 调用户微服务（带用户 token）
      const res = await fetch(`http://user-service/api/coupons?hotel=${hotelId}`, {
        headers: { Authorization: context.token }
      });
      return res.json();
    },
  }
};

// 启动 BFF 服务
const server = new ApolloServer({ typeDefs, resolvers });
server.listen(4000);
```

### 第三层：后端微服务 — 正常的 REST 接口，不知道 BFF 的存在

```
GET http://hotel-service/api/hotels/123
→ { id: "123", name: "希尔顿", rating: 4.8, images: [...20张], address: "...", ... }
   （返回一大坨，BFF 只取 name/rating/images 前3张）

GET http://price-service/api/prices?hotel=123
→ { amount: 599, currency: "CNY", discount: 0.8, tax: 50, ... }
   （BFF 只取 amount/currency/discount）

GET http://user-service/api/coupons?hotel=123
→ [{ code: "NEW50", value: 50, expiry: "...", ... }]
   （BFF 只取 code/value）
```

### 一眼看懂

```
前端说："我要 hotel.name + price.amount + coupons.code"（一个请求）
  ↓
BFF 并行调 3 个微服务，每个返回一大坨
  ↓
GraphQL 引擎自动裁剪，只返回前端要的字段
  ↓
前端拿到精确数据，零冗余
```

**核心价值**：前端一次请求 → BFF 并行聚合 → 自动裁剪 → 减少请求数 + 减少传输量 + 前端不依赖后端接口变更。
