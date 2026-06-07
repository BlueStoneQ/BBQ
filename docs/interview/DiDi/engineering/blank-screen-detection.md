# 白屏检测

> 解决什么问题：页面加载后什么都没渲染（白屏），用户看到空白页但没人知道——需要自动检测 + 上报 + 恢复。
>
> 本质：白屏检测 = 页面加载后主动验证"有没有内容渲染出来"，没有就上报并尝试恢复。
>
> 为什么重要：白屏是用户体验的"P0 故障"，但浏览器不会告诉你"页面白了"——JS 没报错、接口没失败、资源没 404，但就是白的。

---

## 目录

- [为什么会白屏](#为什么会白屏)
- [检测方案](#检测方案)
- [恢复策略](#恢复策略)
- [上报与告警](#上报与告警)
- [Q&A](#qa)

---

## 为什么会白屏

```
常见原因（JS 不报错但页面空白）：

  1. JS 执行时间过长 → 主线程阻塞 → 渲染被延迟
  2. 框架初始化失败但被 catch 吞了 → 无 DOM 输出
  3. 路由匹配失败 → 渲染了空组件
  4. 接口返回异常数据 → 条件渲染判断错误 → 什么都没渲染
  5. CSS 加载失败 → 内容在但不可见（背景色与文字色相同）
  6. WebView 容器异常 → 内核崩溃（更底层）

关键点：白屏 ≠ JS 报错。很多白屏场景下 window.onerror 不会触发。
= 必须主动检测，不能靠错误监控兜底。
```

---

## 检测方案

### 方案 1：DOM 节点检测（最常用）

```javascript
// 页面加载完成后检测根节点是否有子元素
function checkBlankScreen() {
  const root = document.querySelector('#root') || document.querySelector('#app');
  
  if (!root || root.children.length === 0) {
    // 白屏！
    reportBlankScreen();
  }
}

// 在合适的时机触发检测
// 方式 A：DOMContentLoaded + 延迟（等框架渲染完）
window.addEventListener('load', () => {
  setTimeout(checkBlankScreen, 2000);  // 给框架 2s 渲染时间
});

// 方式 B：MutationObserver 超时（更精确）
let hasContent = false;
const observer = new MutationObserver(() => { hasContent = true; });
observer.observe(document.querySelector('#root'), { childList: true, subtree: true });

setTimeout(() => {
  if (!hasContent) reportBlankScreen();  // 2s 内没有 DOM 变化 → 白屏
}, 2000);
```

### 方案 2：采样点检测（更准确）

```javascript
// 在页面中选取多个采样点，检测这些位置是否有实际内容
function checkBysampling() {
  const points = [
    [window.innerWidth / 2, window.innerHeight / 2],  // 屏幕中心
    [window.innerWidth / 2, window.innerHeight / 4],  // 上半部分
    [window.innerWidth / 2, window.innerHeight * 3 / 4], // 下半部分
  ];

  let emptyCount = 0;
  points.forEach(([x, y]) => {
    const element = document.elementFromPoint(x, y);
    // 如果采样点命中的是 body/html/根容器 → 说明该位置没有实际内容
    if (!element || element === document.body || element === document.documentElement) {
      emptyCount++;
    }
  });

  if (emptyCount >= points.length * 0.8) {
    reportBlankScreen();  // 80% 的采样点都是空的 → 白屏
  }
}
```

### 方案 3：截图对比（重型方案）

```
原理：对页面截图 → 分析像素颜色分布 → 全白/全黑判定为白屏
优点：最准确（不依赖 DOM 结构）
缺点：性能开销大，一般用于离线分析或 E2E 测试，不用于线上实时检测
```

### 方案对比

| 方案 | 准确度 | 性能开销 | 适用 |
|------|--------|---------|------|
| DOM 节点检测 | 中 | 极低 | 线上实时（首选） |
| 采样点检测 | 高 | 低 | 线上实时（更精确） |
| 截图对比 | 最高 | 高 | 离线分析/E2E |

---

## 恢复策略

```
检测到白屏后的处理（分级）：

  1. 自动刷新（最简单）
     location.reload()
     注意：只刷一次！用 URL 参数或 sessionStorage 标记防死循环
     
     if (!sessionStorage.getItem('blank_reloaded')) {
       sessionStorage.setItem('blank_reloaded', '1');
       location.reload();
     }

  2. 降级到缓存版本
     如果有离线包/Service Worker 缓存 → 加载上一个可用版本

  3. 展示兜底页面
     检测到白屏 → 展示一个静态的"加载失败"页面 + 手动刷新按钮
     （这个兜底页面要内联在 HTML 里，不依赖 JS 框架）

  4. 上报后由运维判断回滚
     白屏率超阈值 → 自动告警 → oncall 手动回滚版本
```

---

## 上报与告警

```
上报内容（帮助定位根因）：
  - 页面 URL
  - 用户设备/浏览器信息
  - 白屏检测方式（哪种方案触发的）
  - 页面加载耗时（performance.timing）
  - JS 错误（如果有）
  - 网络请求列表（哪些资源加载失败了）
  - 是否刷新后恢复

告警规则：
  - 白屏率 > 0.1%（1000 个 PV 里有 1 个白屏）→ 告警
  - 短时间白屏率飙升（5min 内从 0.01% → 1%）→ 紧急告警
  
上报方式：
  navigator.sendBeacon（保证不丢）
  因为白屏时页面可能很快被用户关闭
```

---

## Q&A

**Q：白屏检测什么时候触发？**

A：页面 load 事件后延迟 2-3s（给框架渲染时间）。或用 MutationObserver 监听根节点，超时未变化则判定白屏。不能太早（框架还没渲染），不能太晚（用户已经走了）。

**Q：白屏和 JS 错误监控的关系？**

A：互补。JS 错误监控捕获"代码报错"，白屏检测捕获"不报错但没内容"。很多白屏场景下 onerror 不会触发（路由不匹配、条件渲染空、CSS 问题），所以白屏检测不可替代。

**Q：怎么防止白屏检测误报？**

A：
- 延迟足够时间再检测（给异步渲染留时间）
- 多采样点投票（而非单点判断）
- 排除已知的"空白页面"（如 loading 页本身就是空的）
- 结合网络状态（离线时不算白屏，算网络异常）

**Q：大厂怎么做白屏检测？**

A：基本都是自研探针 SDK 内置白屏检测模块。核心逻辑就是 DOM 检测或采样点检测，配合上报 + 看板 + 告警。没有通用标准库，因为每家的页面结构不同（根节点 id、框架渲染时机）。
