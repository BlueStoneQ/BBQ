# 低代码搭建体系

> 解决什么问题：运营活动页从"等开发排期"变成"运营自助搭建"，活动创建从 0.5 人天降到 15 秒。
>
> 本质：把页面结构 + 样式 + 交互逻辑全部数据化（JSON DSL），运营在可视化编辑器里配置，渲染引擎动态渲染为真实页面。
>
> 场景：MT 搭建系统（营销活动页）、DD 运营平台（活动/落地页/优惠页）。

---

## 目录

- [核心架构](#核心架构)
- [DSL 设计（搭建产物）](#dsl-设计搭建产物)
- [渲染引擎](#渲染引擎)
- [事件系统（点击后做什么）](#事件系统点击后做什么)
- [自定义逻辑（表达式 / 脚本）](#自定义逻辑表达式--脚本)
- [编辑器架构](#编辑器架构)
- [物料体系](#物料体系)
- [发布流程](#发布流程)
- [Q&A](#qa)

---

## 核心架构

```
低代码搭建系统 = 编辑器 + DSL + 渲染引擎 + 物料库 + 发布系统

  ┌──────────────┐     ┌─────────┐     ┌──────────────┐
  │   编辑器      │ ──► │  DSL    │ ──► │   渲染引擎    │ ──► 用户看到的页面
  │（拖拽 + 配置）│     │（JSON） │     │（JSON → DOM）│
  └──────────────┘     └─────────┘     └──────────────┘
        ↑                                      ↑
        │                                      │
  ┌─────┴──────┐                        ┌──────┴──────┐
  │   物料库    │                        │   组件注册表  │
  │（可选组件）  │                        │（type→实现） │
  └────────────┘                        └─────────────┘
```

---

## DSL 设计（搭建产物）

> 搭建的结果不是代码，是一个 JSON —— 描述"页面长什么样、有什么交互"。

```json
{
  "version": "1.0",
  "page": {
    "title": "春节活动",
    "components": [
      {
        "id": "banner1",
        "type": "Banner",
        "props": {
          "imageUrl": "https://cdn.com/banner.png",
          "alt": "春节活动"
        },
        "events": {
          "onClick": { "type": "jumpUrl", "url": "https://activity.com/detail" }
        }
      },
      {
        "id": "btn1",
        "type": "Button",
        "props": { "text": "立即领取", "color": "#ff4d4f" },
        "events": {
          "onClick": { "type": "callApi", "api": "/api/claim-coupon", "params": { "couponId": "123" } }
        }
      },
      {
        "id": "list1",
        "type": "ProductList",
        "props": { "dataSource": { "type": "api", "url": "/api/products" } },
        "visible": { "type": "expr", "value": "ctx.user.isLoggedIn" }
      }
    ]
  }
}
```

**DSL 本质**：页面的序列化描述。组件树 + 属性 + 事件 + 条件 = 完整的页面定义。

---

## 渲染引擎

> 渲染引擎 = 遍历 DSL JSON → 查组件注册表 → 实例化组件 → 传 props → 挂载 DOM

```typescript
// 组件注册表：type 字符串 → 真实组件实现
const registry: Record<string, React.ComponentType> = {
  Banner: BannerComponent,
  Button: ButtonComponent,
  ProductList: ProductListComponent,
};

// 渲染函数：遍历 DSL → 渲染组件树
function renderPage(dsl: PageDSL) {
  return dsl.components.map(node => {
    const Component = registry[node.type];
    if (!Component) return null;

    // 条件显隐
    if (node.visible && !evaluateExpr(node.visible, context)) return null;

    return (
      <Component
        key={node.id}
        {...node.props}
        onEvent={(eventName) => executeEvent(node.events?.[eventName])}
      />
    );
  });
}
```

---

## 事件系统（点击后做什么）

> 营销活动页的交互是**有限集合**——跳转、弹窗、调接口、分享。不需要图灵完备的逻辑能力。

**常见动作类型**：

| 动作 | 说明 | DSL |
|------|------|-----|
| 跳转链接 | 打开新页面 | `{ type: "jumpUrl", url: "..." }` |
| 打开弹窗 | 显示浮层 | `{ type: "showModal", modalId: "popup1" }` |
| 调用接口 | 领券/报名 | `{ type: "callApi", api: "/api/xxx", params: {...} }` |
| Native 调用 | 分享/定位 | `{ type: "callNative", method: "share", params: {...} }` |
| 埋点上报 | 点击统计 | `{ type: "track", event: "btn_click" }` |
| 条件显隐 | 切换组件可见性 | `{ type: "toggle", targetId: "section2" }` |
| 组合动作 | 一次触发多个 | `{ type: "sequence", actions: [...] }` |

**事件执行器**：

```typescript
function executeEvent(config: EventConfig) {
  switch (config.type) {
    case 'jumpUrl':
      window.location.href = config.url;
      break;
    case 'showModal':
      store.setModalVisible(config.modalId, true);
      break;
    case 'callApi':
      fetch(config.api, { method: 'POST', body: JSON.stringify(config.params) });
      break;
    case 'callNative':
      window.NativeBridge.call(config.method, config.params);
      break;
    case 'track':
      tracker.send(config.event, config.data);
      break;
    case 'sequence':
      config.actions.forEach(executeEvent);
      break;
  }
}
```

---

## 自定义逻辑（表达式 / 脚本）

> 纯配置能覆盖 80% 场景，但总有 20% 需要自定义逻辑（条件判断、数据转换）。怎么办？

**分级策略**：

| 级别 | 方式 | 安全性 | 适用 |
|------|------|--------|------|
| L1：配置项 | 固定选项（选择跳转/弹窗/调接口） | 完全安全 | 80% 场景 |
| L2：表达式 | 简单表达式 `ctx.user.level > 3` | 安全（沙箱执行） | 条件显隐、动态文案 |
| L3：脚本 | 自定义 JS 代码块 | 需沙箱 | 复杂联动逻辑 |

**L2 表达式（安全的简单逻辑）**：

```typescript
// DSL 中：
{ "visible": { "type": "expr", "value": "ctx.user.isVip && ctx.time < deadline" } }

// 执行方式：用 new Function 在受限上下文中求值
function evaluateExpr(expr: ExprConfig, context: Record<string, any>): boolean {
  const fn = new Function('ctx', `return (${expr.value})`);
  return fn(context);
  // context = { user: { isVip: true }, time: Date.now(), ... }
  // 只暴露 ctx 变量，不暴露 window/document → 受限执行
}
```

**L3 自定义脚本（需要沙箱）**：

```typescript
// 场景：运营想写一段自定义逻辑（如复杂的价格计算/条件组合）
// DSL 中存储代码字符串：
{ "type": "script", "code": "if (ctx.cart.total > 100) { ctx.showCoupon = true; }" }

// 执行方式：沙箱隔离执行（防止恶意代码）
function executeScript(code: string, context: object) {
  // 方案 1：new Function + 受限上下文（轻量，但不完全安全）
  const fn = new Function('ctx', code);
  fn(context);

  // 方案 2：iframe sandbox（更安全，性能差）
  // 方案 3：QuickJS / WebAssembly 沙箱（安全 + 可控，重型方案）
}
```

**关键决策**：

```
营销活动页 → 一般只需要 L1 + L2，不需要 L3
  因为活动页交互简单（跳转/领券/弹窗），不需要开发者写代码

通用低代码平台（如 retool/内部工具） → 需要 L3
  因为业务逻辑复杂，纯配置无法覆盖

你的 MT 搭建系统 → 大概率 L1 + L2 就够了
  表达式做条件显隐，固定动作类型做交互，不需要 eval 执行任意代码
```

---

## 编辑器架构

```
编辑器核心模块：

  ┌────────────────────────────────────────────────────┐
  │                    编辑器                            │
  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐ │
  │  │ 组件面板  │  │   画布区域    │  │  属性面板    │ │
  │  │（拖拽源） │  │（渲染预览）  │  │（配置属性）  │ │
  │  │          │  │              │  │              │ │
  │  │ Banner   │  │  ┌────────┐  │  │ imageUrl:    │ │
  │  │ Button   │  │  │ Banner │  │  │ [输入框]     │ │
  │  │ List     │  │  │ Button │  │  │              │ │
  │  │ ...      │  │  └────────┘  │  │ onClick:     │ │
  │  └──────────┘  └──────────────┘  │ [选择动作]   │ │
  │                                   └──────────────┘ │
  └────────────────────────────────────────────────────┘
                         ↓
                    输出 DSL JSON
```

---

## 物料体系

> 物料 = 可被拖入画布的组件。最终渲染到页面容器中（容器遍历 DSL → 按 type 找物料 → 实例化 → 传 props）。

**营销活动页常用物料分类**：

| 分类 | 物料 | 说明 |
|------|------|------|
| **基础** | 图片、文本、按钮、分割线、空白占位 | 最原子的展示单元 |
| **营销** | 优惠券卡片、倒计时、红包雨、抽奖转盘、拼团进度 | 活动核心玩法 |
| **布局** | 横向排列、纵向排列、Tab 切换、轮播容器、悬浮层 | 控制子组件的排列方式 |
| **表单** | 输入框、选择器、手机号、验证码、提交按钮 | 报名/登记场景 |
| **媒体** | 视频播放器、音频、动画（Lottie） | 富媒体展示 |
| **数据** | 商品列表、排行榜、进度条、数据卡片 | 动态数据展示 |
| **导航** | 顶部导航栏、底部 Tab、悬浮回到顶部 | 页面结构 |

```
物料开发规范：

  每个物料需要提供：
    1. 组件实现（React/Vue 组件，接收 props 渲染）
    2. Schema 描述（JSON Schema：props 有哪些、类型、默认值 → 自动生成属性面板）
    3. 缩略图 + 名称（在组件面板中展示）
    4. 分类标签

  物料开发 → 配 schema → 发布到物料库 → 编辑器自动拉取 → 运营可用
```

---

## 发布流程

```
编辑 → 保存（DSL 存到数据库）→ 预览 → 审批 → 发布到 CDN → 用户访问

发布产物：
  方案 1：纯 JSON + 通用渲染器
    CDN 上放 DSL JSON + 渲染引擎 JS
    用户访问 → 加载渲染引擎 → 请求 DSL → 动态渲染
    优点：发布快（只更新 JSON）
    缺点：首屏多一次 JSON 请求

  方案 2：SSG 静态生成
    发布时服务端用渲染引擎把 DSL 预渲染为 HTML
    用户访问 → 直接加载静态 HTML
    优点：首屏快（无需运行时渲染）
    缺点：发布慢一步（需要构建）
```

---

## Q&A

### 架构类

**Q：DSL 和代码生成的区别？什么时候用哪个？**

A：DSL 是运行时方案（JSON → 渲染引擎 → DOM），代码生成是编译时方案（JSON → 生成 React 代码 → 构建部署）。本质区别是"运行时动态渲染"还是"构建时静态产出"。活动页追求快速上线用运行时渲染；追求极致性能或需要二次开发的用代码生成。

**Q：渲染引擎的本质是什么？**

A：就是一个容器组件——遍历 DSL JSON 数组，按 `type` 字段从注册表找到对应组件实现，传入 `props` 渲染。所有物料最终渲染在这个容器的子节点里。和 React 的 `createElement(type, props)` 是同一个思路，只是 type 从注册表查而不是编译时确定。

**Q：如何保证 DSL 的向后兼容？**

A：DSL 带版本号（`version: "1.0"`）。渲染引擎支持多版本 DSL 解析。新增字段用可选（不破坏旧 DSL），删除字段做迁移脚本。本质和 API 版本管理一样——新功能加字段，不改不删旧字段。

**Q：搭建系统和 iframe/微前端的关系？**

A：没有直接关系。搭建系统产出的是一个独立 H5 页面（可以是 WebView 里打开的活动页）。如果搭建出来的页面需要嵌入到管理后台，才涉及微前端/iframe。两者解决不同层面的问题。

### 编辑器类

**Q：拖拽怎么实现的？**

A：HTML5 Drag and Drop API（或 react-dnd / dnd-kit）。拖拽本质是：从组件面板拖出 → 在画布 drop → 往 DSL 数组指定位置 insert 一个节点 → 重新渲染画布。拖拽只是交互方式，核心操作是对 DSL JSON 的 CRUD。

**Q：撤销/重做怎么实现？**

A：DSL 是 JSON，每次操作保存一份快照（或用 JSON Patch 记录 diff）。撤销 = 回退到上一份快照，重做 = 前进到下一份。本质是对 JSON 状态的 history 管理（类似 Redux time-travel）。

**Q：属性面板怎么动态生成的？**

A：每个物料附带一份 JSON Schema（描述 props 有哪些字段、类型、默认值、枚举选项）。编辑器根据 Schema 自动渲染对应的表单控件（string → 输入框，boolean → 开关，enum → 下拉选择，color → 颜色选择器）。

### 渲染类

**Q：物料组件怎么做到"热更新"（不发版就能加新组件）？**

A：物料组件独立构建发布（类似 npm 包发到 CDN）。渲染引擎运行时按需加载物料 JS（`import('https://cdn/Button.js')`）。加新组件 = 发布新物料到 CDN + 注册表加一条记录 → 编辑器和渲染器自动可用。本质是 Module Federation / 动态 import 的应用。

**Q：怎么处理物料之间的联动（A 组件的值影响 B 组件）？**

A：通过共享上下文（Context / Store）。DSL 中定义变量（`variables: { selectedTab: 0 }`），组件通过 binding 绑定变量（`{ bind: "variables.selectedTab" }`）。一个组件改变量，引擎通知所有绑定该变量的组件重渲染。本质就是一个简化版的响应式状态管理。

**Q：页面性能怎么保证？几十个物料不会卡吗？**

A：
- 物料按需加载（不用的组件代码不下载）
- 可视区域外的组件懒渲染（Intersection Observer）
- 图片走 CDN + WebP + 懒加载
- 可选 SSG 预渲染（消除运行时渲染开销）

### 工程类

**Q：搭建系统和手写页面的边界在哪？**

A：交互简单 + 结构重复 + 频繁迭代 → 搭建（活动页、落地页）。交互复杂 + 高度定制 + 低频变更 → 手写（核心业务流程页）。判断标准："运营能理解配置项吗？"能 → 搭建；不能 → 手写。

**Q：如何让多个业务方复用同一套搭建系统？**

A：物料分层——基础物料（按钮/图片）全局复用 + 业务物料（优惠券/拼团）按业务域独立开发。编辑器和渲染引擎是通用的，物料是可插拔的。不同业务方注册不同的物料集合。

**Q：搭建系统的维护成本在哪？**

A：主要在物料——每新增一种 UI 样式就要开发新物料或给已有物料加配置项。编辑器和渲染引擎稳定后很少改。所以物料的 Schema 设计很关键——配置项够用但不过度，否则运营配不动。

