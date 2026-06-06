# 首屏测速方案（无侵入）

> 解决什么问题：怎么知道"页面打开了"？怎么算秒开率？能不能不侵入业务代码？
> 本质：监听 View Tree 变化 → 首屏区域过滤 → 稳定判定 → 记录时间。
> 场景：秒开率探针 SDK、App 性能指标体系、KS/DD 面试"可观测与数据化"。

---

## 目录

- [问题定义：什么算"打开了"](#问题定义什么算打开了)
- [两种方案对比](#两种方案对比)
- [无侵入方案原理](#无侵入方案原理)
- [Web 端实现](#web-端实现)
- [RN / Native 端实现](#rn--native-端实现)
- [秒开率计算](#秒开率计算)
- [边界问题与优化](#边界问题与优化)
- [大厂方案参考](#大厂方案参考)

---

## 问题定义：什么算"打开了"

"页面打开"没有统一标准，常见定义：

| 定义 | 含义 | 适用 |
|------|------|------|
| FCP | 首次内容绘制（浏览器 API） | Web |
| LCP | 最大内容绘制 | Web（Google Core Web Vitals） |
| 首屏可见 | 首屏区域内关键内容渲染完成 | Web/RN/App |
| TTI | 可交互（主线程空闲 + 事件可响应） | 严格定义 |
| 自定义打点 | 业务定义的"打开了"时刻 | 最精确但侵入 |

**实际最常用**：首屏可见 = 首屏区域内的 View 渲染稳定了。

---

## 两种方案对比

| | 手动打点 | 无侵入（View Tree 监听） |
|---|---|---|
| 精度 | 高（业务精确定义） | 中（通用但不知道业务语义） |
| 侵入性 | 高（每个页面加代码） | 零（SDK 统一处理） |
| 维护成本 | 高（新页面要加、改了要改） | 低（一次接入所有页面生效） |
| 适合 | 核心页面精确测量 | 全量页面覆盖 + 兜底 |

**最佳实践**：无侵入方案做全量覆盖（兜底），核心页面加手动打点（精确）。

---

## 无侵入方案原理

```
核心思路：
  页面加载过程中 View Tree 不断新增节点
  → 某一刻之后首屏区域内的节点不再增加（渲染稳定了）
  → 这个"稳定时刻" = 首屏渲染完成

判定逻辑：
  1. 记录页面导航起点（startTime）
  2. 监听 View Tree 变化
  3. 只关心首屏可视区域内（y < screenHeight）的 View 变化
  4. 连续 N 帧（如 500ms）没有新增可见 View → 判定为"稳定"
  5. 上报 stableTime - startTime = 首屏时间
```

```
时间线：
  t0: 用户点击导航（startTime）
  t1: 页面容器创建
  t2: 骨架屏渲染（View 树增加）
  t3: 数据回来，列表渲染（View 树大量增加）
  t4: 图片加载完成（最后一批 View 变化）
  t5: 500ms 无变化 → 判定稳定（首屏时间 = t4 - t0）
```

---

## Web 端实现

```ts
// 无侵入首屏检测 SDK（Web）
function createFirstScreenDetector() {
  const startTime = performance.now();
  let lastChangeTime = startTime;
  let checkTimer: number;

  const observer = new MutationObserver((mutations) => {
    // 只关心首屏可视区域内的 DOM 变化
    const hasVisibleChange = mutations.some(m => {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            const rect = node.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.height > 0) {
              return true;  // 首屏内有新增可见元素
            }
          }
        }
      }
      return false;
    });

    if (hasVisibleChange) {
      lastChangeTime = performance.now();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 定时检查是否稳定
  checkTimer = window.setInterval(() => {
    const now = performance.now();
    if (now - lastChangeTime > 500) {  // 500ms 无新增
      const firstScreenTime = lastChangeTime - startTime;
      reportMetric('first_screen_time', firstScreenTime);
      observer.disconnect();
      clearInterval(checkTimer);
    }
    // 超时兜底（10s 还没稳定就强制上报）
    if (now - startTime > 10000) {
      reportMetric('first_screen_time', now - startTime);
      reportMetric('first_screen_timeout', true);
      observer.disconnect();
      clearInterval(checkTimer);
    }
  }, 200);
}
```

---

## RN / Native 端实现

RN 没有 MutationObserver，需要在 Native 层监听 View Tree：

### Android

```java
// 在 ReactActivity 或 ReactRootView 所在的 Fragment 中
public class FirstScreenDetector {
    private long startTime;
    private int lastViewCount = 0;
    private int stableFrames = 0;
    private static final int STABLE_THRESHOLD = 3;  // 连续 3 帧稳定

    public void start(View rootView, int screenHeight) {
        startTime = System.currentTimeMillis();

        rootView.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            int visibleCount = countVisibleViews(rootView, screenHeight);

            if (visibleCount == lastViewCount) {
                stableFrames++;
                if (stableFrames >= STABLE_THRESHOLD) {
                    long duration = System.currentTimeMillis() - startTime;
                    report("first_screen_time", duration);
                    // 移除 listener
                }
            } else {
                stableFrames = 0;
                lastViewCount = visibleCount;
            }
        });
    }

    // 递归统计首屏区域内的可见 View 数量
    private int countVisibleViews(View root, int screenHeight) {
        int count = 0;
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                View child = group.getChildAt(i);
                int[] location = new int[2];
                child.getLocationOnScreen(location);
                if (location[1] < screenHeight && child.getVisibility() == View.VISIBLE) {
                    count++;
                }
                count += countVisibleViews(child, screenHeight);
            }
        }
        return count;
    }
}
```

### iOS

```objc
// CADisplayLink 每帧检测 View Tree 变化
- (void)startDetection:(UIView *)rootView {
    self.startTime = CACurrentMediaTime();
    self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(checkViewTree)];
    [self.displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
}

- (void)checkViewTree {
    NSInteger currentCount = [self countVisibleSubviews:self.rootView belowY:UIScreen.mainScreen.bounds.size.height];
    
    if (currentCount == self.lastCount) {
        self.stableFrames++;
        if (self.stableFrames >= 3) {
            NSTimeInterval duration = (CACurrentMediaTime() - self.startTime) * 1000;
            [self report:@"first_screen_time" value:duration];
            [self.displayLink invalidate];
        }
    } else {
        self.stableFrames = 0;
        self.lastCount = currentCount;
    }
}
```

### RN 封装为 TurboModule

```ts
// JS 侧调用
import { FirstScreenDetector } from '@/native/FirstScreenDetector';

// 在 Navigation 的 screen listener 中自动启动
navigation.addListener('focus', () => {
  FirstScreenDetector.start();  // Native 层开始监听
});

// Native 检测完成后通过 EventEmitter 上报
FirstScreenDetector.onDetected((duration) => {
  analytics.report('first_screen_time', { screen: routeName, duration });
});
```

---

## 秒开率计算

```
秒开率 = 首屏时间 < 1000ms 的页面打开次数 / 总页面打开次数 × 100%

上报数据结构：
{
  screen: "TaskList",       // 页面名
  duration: 680,            // 首屏时间 ms
  isTimeout: false,         // 是否超时兜底
  method: "auto",           // 检测方式（auto=无侵入 / manual=手动打点）
  timestamp: 1717668000000
}
```

---

## 边界问题与优化

| 问题 | 原因 | 解决 |
|------|------|------|
| 懒加载图片导致误判 | 图片 onLoad 晚于文本渲染 | 检测维度加"图片加载完成"或设更长稳定阈值 |
| 动画/Shimmer 一直在变 | 动画帧不算"新增 View" | 只统计 View 新增/移除，忽略属性变化 |
| Tab 切换误触发 | 切 Tab 也是"新页面" | 区分首次打开和 Tab 切换 |
| 弹窗/Toast 干扰 | 弹窗也是新增 View | 过滤已知弹窗容器 |
| 超长列表 | 不断 onLayout | 只看首屏高度内，超出不管 |

---

## 大厂方案参考

| 公司 | 方案 | 特点 |
|------|------|------|
| 字节 | Native View Tree 监听 + 首屏过滤 | 和本文方案一致 |
| 美团 | View Tree 稳定判定 + 图片加载计入 | 精度更高 |
| 阿里 UC | 定时截图 + 像素对比（变化率 < 阈值 = 稳定）| 最准但性能开销大 |
| Google | LCP（浏览器内置，最大内容元素渲染完成）| Web 标准方案 |

---

## 总结

```
无侵入首屏测速 = View Tree 监听 + 首屏区域过滤 + 稳定判定

优点：零业务侵入、全量页面自动生效、一次接入
缺点：精度不如手动打点（不知道业务"关键内容"是什么）

最佳实践：
  无侵入做全量兜底 → 所有页面都有秒开数据
  核心页面加手动打点 → 精确衡量关键体验
```
