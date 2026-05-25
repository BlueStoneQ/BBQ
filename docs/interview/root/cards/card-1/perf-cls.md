# CLS 抖动（布局跳动）

> 问题：页面加载过程中，已渲染的内容发生位移/大小变化 → 用户感知"抖"
>
> 本质：数据到来后布局重排（从无到有 / 尺寸变化）
>
> 目标：CLS = 0（Cumulative Layout Shift）

---

## 目录

- [最佳实践（结论）](#最佳实践结论)
  - [aspectRatio 的作用](#aspectratio-的作用)
- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [从设计源头规范（根本解决）](#从设计源头规范根本解决)
  - [RN/JS 层](#rnjs-层)
  - [Native 层](#native-层)

---

## 最佳实践（结论）

```
CLS 抖动的解决 = 从设计源头规范 + 技术层面预留空间

1. 设计层面：设计稿标注图片比例（16:9/1:1/4:3），开发用 aspectRatio 实现
2. 骨架屏：数据没来时用相同布局的灰色块占位（骨架屏高度 = 真实内容高度）
3. aspectRatio：只给宽度，高度按比例自动算 → 图片加载前后高度不变 → 不抖
4. 避免条件渲染跳动：用骨架屏替代 {data && <View/>}
5. 列表预设高度：estimatedItemSize / getItemLayout
```

### aspectRatio 的作用

```
没有 aspectRatio：
  <Image /> → 宽度 100%，高度未知 → 图片加载完才知道高度 → 撑开 → 抖

有 aspectRatio：
  <View style={{ width: '100%', aspectRatio: 16/9 }}>
  → 宽度 100%，高度 = 宽度 / (16/9) → 加载前就确定了高度
  → 图片加载完填充进去 → 高度不变 → 不抖

= 不需要写死像素值，响应式且不抖动
```

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| 肉眼 + 录屏慢放 | 哪个元素在跳 |
| React DevTools | 哪个组件在条件渲染（从无到有） |
| Performance Monitor | 跳动时是否伴随掉帧 |

**常见触发场景**：
- 图片加载完撑开布局
- 数据回来后条件渲染（`{data && <View/>}`）
- Tab 切换懒加载内容
- 字体加载完文字区域变化
- 列表没有预设高度

---

## 如何优化

### 从设计源头规范（根本解决）

| 设计稿必须标注 | 为什么 |
|---------------|--------|
| 图片宽高比 | 开发用 `aspectRatio`，加载前后不变 |
| 卡片/列表项高度 | 数据填充不改变布局 |
| 每个页面的骨架屏设计 | 骨架屏布局 = 真实内容布局 |
| 四态设计（loading/content/empty/error） | 每个状态都有对应 UI |

### RN/JS 层

| 手段 | 做什么 |
|------|--------|
| `aspectRatio` | 图片容器只定宽度，高度按比例自动算 |
| 骨架屏占位 | 数据没来时用相同布局的灰色块 |
| 固定 `minHeight` | 文字内容不确定长度时保证最小高度 |
| `getItemLayout` / `estimatedItemSize` | 列表预设 item 高度 |
| 避免条件渲染跳动 | 用骨架屏替代 `{data && <View/>}` |
| Tab 预渲染 | `lazy={false}` 或 `lazyPlaceholder` |

### Native 层

| 手段 | 做什么 |
|------|--------|
| 服务端返回图片尺寸 | 接口返回 `{ url, width, height }`，渲染前就知道高度 |
| `LayoutAnimation` | 高度确实要变时用动画过渡（不是瞬间跳） |

```typescript
// ❌ 条件渲染 → 跳动
{device && <DeviceInfo device={device} />}

// ✅ 骨架屏占位 → 不跳
<DeviceInfo device={device} isLoading={!device} />

// ✅ 图片固定比例 → 不跳
<View style={{ width: '100%', aspectRatio: 16/9 }}>
  <FastImage source={{ uri }} style={{ flex: 1 }} />
</View>

// ✅ 高度变化用动画
LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
setExpanded(!expanded);
```
