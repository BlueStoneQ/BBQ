# PreFetcher 预请求系统 - 面试梳理文档

## 目录

- [一、项目背景与价值](#一项目背景与价值)
- [二、系统架构设计](#二系统架构设计)
- [三、核心功能实现](#三核心功能实现)
- [四、核心技术亮点](#四核心技术亮点)
- [五、版本演进历程](#五版本演进历程)
- [六、面试高频问题](#六面试高频问题)
- [七、技术难点与解决方案](#七技术难点与解决方案)
- [八、性能优化与监控](#八性能优化与监控)
- [九、项目亮点总结](#九项目亮点总结)
- [十、代码示例（手写能力）](#十代码示例手写能力)
- [十一、扩展思考](#十一扩展思考)

---

## 一、项目背景与价值

### 1.1 业务痛点
- 小程序页面加载慢，用户体验差
- 页面渲染依赖多个接口数据，串行请求导致白屏时间长
- 首屏秒开率低，影响用户转化率

### 1.2 解决方案
通过预请求机制，在路由跳转时提前发起下一个页面的数据请求，实现数据预加载，缩短页面白屏时间。

### 1.3 核心价值
- **性能优化**：将页面加载时间从串行变为并行，显著提升秒开率
- **用户体验**：减少白屏时间，提升用户感知性能
- **业务价值**：提高转化率，降低用户流失

---

## 二、系统架构设计

### 2.1 核心设计理念
采用**注册-触发-获取**三端分离的设计模式，解耦预请求的定义、触发和使用。

```
注册端（Register）  →  触发端（Emit）  →  获取端（GetResult）
   ↓                      ↓                    ↓
定义预请求任务        路由拦截触发        页面获取数据
```

### 2.2 核心数据结构

```typescript
// 页面路径 → 页面信息映射
pagePath2InfoMap: Map<string, IPageInfo>

// 页面信息结构
interface IPageInfo {
  taskMap: Map<string, ITaskItem>,    // 任务映射表
  injectParams: IParams,               // 注入的全局参数
  mergedParams: IParams                // 合并后的参数（全局+路由）
}

// 任务项结构
interface ITaskItem {
  task: (params) => Promise<any>,     // 任务执行函数
  resPromise: Promise<any>             // 任务执行结果
}
```

### 2.3 架构优势
- **可扩展性**：通过 Map 结构支持多页面、多任务管理
- **灵活性**：支持动态参数注入和合并
- **解耦性**：三端分离，各司其职

---

## 三、核心功能实现

### 3.1 注册端（Register）

**职责**：定义页面的预请求任务和参数

```typescript
register(pagePath: string, taskMap: TTaskMap, injectParams: IParams = {}): void {
  this.pagePath2InfoMap.set(pagePath, {
    taskMap,
    injectParams,
    mergedParams: {},
  });
}
```

**使用场景**：
```typescript
// 在 app.js 中统一注册
const taskMap = new Map([
  ['getUserInfo', { task: (params) => fetch('/api/user', params) }],
  ['getOrderList', { task: (params) => fetch('/api/orders', params) }],
]);

preFetcher.register('/pages/order', taskMap, { 
  globalParam: 'value' 
});
```

### 3.2 触发端（Emit）

**职责**：在路由跳转时触发预请求

```typescript
emit(pagePath: string): void {
  if (!this.pagePath2InfoMap.has(pagePath)) return;
  
  const pageInfo = this.pagePath2InfoMap.get(pagePath);
  const { taskMap, injectParams } = pageInfo;
  
  // 合并全局参数和路由参数
  const queryParams = _getQueryParams(pagePath);
  pageInfo.mergedParams = this._mergeParams(injectParams, queryParams);
  
  // 并行触发所有任务
  for (const [key, taskItem] of taskMap) {
    taskItem.resPromise = taskItem.task(pageInfo.mergedParams);
  }
}
```

**路由拦截实现**（AOP 切面编程）：
```typescript
// 小程序路由拦截
const originalGo = wx.navigateTo;
wx.navigateTo = function(options) {
  preFetcher.emit(options.url);  // 触发预请求
  return originalGo.call(this, options);
}
```

### 3.3 获取端（GetResult）

**职责**：在目标页面获取预请求结果

```typescript
getResult(pagePath: string, taskKey: string): Promise<any> {
  const pageInfo = this.pagePath2InfoMap.get(pagePath);
  const taskItem = pageInfo.taskMap.get(taskKey);
  
  return new Promise((resolve, reject) => {
    taskItem.resPromise
      .then(res => resolve(res))
      .catch(err => {
        // 失败时触发重试机制
        this._retry(pageInfo, taskItem, resolve, reject);
      })
  });
}
```

**页面使用**：
```typescript
// 在目标页面的 onLoad 中
async onLoad() {
  try {
    const userData = await preFetcher.getResult('/pages/order', 'getUserInfo');
    const orderData = await preFetcher.getResult('/pages/order', 'getOrderList');
    this.setData({ userData, orderData });
  } catch(err) {
    // 降级处理
  }
}
```

---

## 四、核心技术亮点

### 4.1 重试机制（Retry）

**设计思路**：
- 预请求失败时自动重试，提高成功率
- 支持最大重试次数和最大重试时长双重限制

```typescript
_retry(
  pageInfo: IPageInfo,
  taskItem: ITaskItem,
  resultResolve: Function,
  resultReject: Function,
  maxRepeatTimes: number = 10,
  maxDuration: number = 10000
) {
  const startTime = Date.now();
  let repeatTimes = 0;
  
  const _isOutTime = () => Date.now() - startTime >= maxDuration;
  const _isMoreThanMaxTimes = () => ++repeatTimes > maxRepeatTimes;
  
  const _request = () => {
    taskItem.task(pageInfo.mergedParams)
      .then(res => resultResolve(res))
      .catch(err => {
        if (_isMoreThanMaxTimes() || _isOutTime()) {
          return resultReject(err);
        }
        _request();  // 递归重试
      })
  }
  
  _request();
}
```

**技术要点**：
- 递归实现重试逻辑
- 时间和次数双重保护，避免无限重试
- 失败后仍然 reject，保证调用方可以降级处理

### 4.2 参数合并机制

**设计目的**：支持全局参数和路由参数的灵活组合

```typescript
_mergeParams(injectParams: IParams, queryParams: IParams): IParams {
  return {
    ...injectParams,    // 全局参数（如用户token）
    ...queryParams      // 路由参数（如订单ID）
  };
}
```

**应用场景**：
- 全局参数：用户token、设备信息等
- 路由参数：页面特定参数，如商品ID、订单ID

### 4.3 AOP 切面编程

**应用场景**：路由拦截

```typescript
// 装饰器模式 + AOP
const originalRouteGo = routeGo;
routeGo = function(url) {
  preFetcher.emit(url);  // 前置增强
  return originalRouteGo.apply(this, arguments);
}
```

**优势**：
- 无侵入式接入，不修改原有路由逻辑
- 统一管理预请求触发时机
- 易于维护和扩展

---

## 五、版本演进历程

### V1 版本（基础版）
- 实现基本的注册-触发-获取流程
- 使用 Map 存储页面和任务映射
- 支持参数注入和合并

### V2 版本（改进版）
- 引入 TypeScript，增强类型安全
- 优化数据结构，使用 taskMap 替代 taskQueue
- 支持任务级别的 key 管理

### V3 版本（完善版）
- 引入重试机制，提高请求成功率
- 完善错误处理和降级方案
- 优化代码结构和类型定义

---

## 六、面试高频问题

### 6.1 为什么要做预请求？
**回答要点**：
- 业务背景：小程序页面加载慢，影响用户体验和转化率
- 技术方案：通过预请求将串行请求变为并行，缩短白屏时间
- 实际效果：秒开率提升 X%，用户体验显著改善

### 6.2 预请求的核心设计思路是什么？
**回答要点**：
- 三端分离：注册端、触发端、获取端解耦
- 数据结构：使用 Map 管理页面和任务映射
- 参数管理：支持全局参数和路由参数合并
- 容错机制：重试机制 + 降级方案

### 6.3 如何保证预请求的可靠性？
**回答要点**：
- **重试机制**：失败自动重试，支持次数和时长限制
- **降级方案**：预请求失败时，页面仍可正常发起请求
- **错误隔离**：单个任务失败不影响其他任务
- **监控告警**：接入性能监控，及时发现问题

### 6.4 预请求会不会造成资源浪费？
**回答要点**：
- **场景限制**：只对高频访问、转化关键页面开启
- **参数校验**：确保预请求参数准确，避免无效请求
- **缓存策略**：结合缓存机制，避免重复请求
- **数据监控**：通过数据分析优化预请求策略

### 6.5 如何处理预请求和页面请求的竞态问题？
**回答要点**：
- **Promise 复用**：预请求和页面请求共享同一个 Promise
- **状态管理**：通过 resPromise 存储请求状态
- **去重机制**：相同请求只发起一次

### 6.6 预请求失败了怎么办？
**回答要点**：
- **重试机制**：自动重试，提高成功率
- **降级方案**：失败后页面正常发起请求，不影响功能
- **用户无感知**：预请求是性能优化手段，失败不影响业务流程

### 6.7 如何在不同路由框架中接入？
**回答要点**：
- **小程序**：拦截 wx.navigateTo 等路由 API
- **Vue Router**：使用 beforeEach 导航守卫
- **React Router**：使用 history.listen 监听路由变化
- **统一封装**：通过 AOP 切面编程统一处理

---

## 七、技术难点与解决方案

### 7.1 参数传递问题
**难点**：预请求时如何获取路由参数？

**解决方案**：
- 在 emit 阶段解析路由 URL，提取 query 参数
- 与全局参数合并后传递给任务函数

### 7.2 请求时机问题
**难点**：何时触发预请求最合适？

**解决方案**：
- 在路由跳转时触发，利用页面切换的时间窗口
- 通过 AOP 拦截路由 API，统一管理触发时机

### 7.3 错误处理问题
**难点**：预请求失败如何保证页面正常运行？

**解决方案**：
- 预请求失败时触发重试
- 重试仍失败时，页面可正常发起请求（降级）
- 错误不阻塞页面渲染

---

## 八、性能优化与监控

### 8.1 性能指标
- **秒开率**：页面在 1 秒内完成渲染的比例
- **白屏时间**：从路由跳转到首屏渲染的时间
- **请求成功率**：预请求的成功率

### 8.2 监控方案
- 接入性能监控 SDK（如 FST-SDK）
- 上报预请求耗时、成功率等指标
- 通过数据分析优化预请求策略

### 8.3 优化方向
- 根据用户行为预测下一步操作，提前预请求
- 结合缓存策略，避免重复请求
- 动态调整重试策略，平衡成功率和性能

---

## 九、项目亮点总结

1. **架构设计**：三端分离，解耦清晰，易于维护和扩展
2. **技术实现**：AOP 切面编程、重试机制、参数合并等技术手段
3. **性能优化**：显著提升秒开率，改善用户体验
4. **工程化**：TypeScript 类型安全、完善的错误处理
5. **业务价值**：提高转化率，降低用户流失

---

## 十、代码示例（手写能力）

### 简化版 PreFetcher 实现

```typescript
class PreFetcher {
  private map: Map<string, any>;
  
  constructor() {
    this.map = new Map();
  }
  
  // 注册
  register(path, taskMap, injectParams = {}) {
    this.map.set(path, { taskMap, injectParams });
  }
  
  // 触发
  emit(path) {
    if (!this.map.has(path)) return;
    
    const { taskMap, injectParams } = this.map.get(path);
    const queryParams = this._getQueryParams(path);
    const mergedParams = { ...injectParams, ...queryParams };
    
    for (const [key, item] of taskMap) {
      item.resPromise = item.task(mergedParams);
    }
  }
  
  // 获取
  async getResult(path, taskKey) {
    const { taskMap } = this.map.get(path);
    const taskItem = taskMap.get(taskKey);
    return taskItem.resPromise;
  }
  
  _getQueryParams(path) {
    // 解析 URL 参数
    const [, query] = path.split('?');
    if (!query) return {};
    
    return query.split('&').reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
  }
}
```

---

## 十一、扩展思考

### 11.1 如何支持条件预请求？
- 根据用户行为、页面状态等条件决定是否预请求
- 在 emit 阶段增加条件判断逻辑

### 11.2 如何支持预请求优先级？
- 为任务增加优先级字段
- 高优先级任务优先执行，低优先级任务延迟执行

### 11.3 如何支持预请求取消？
- 在路由回退时取消预请求
- 使用 AbortController 取消 fetch 请求

### 11.4 如何与缓存结合？
- 预请求结果写入缓存
- 页面优先读取缓存，缓存失效时使用预请求结果
