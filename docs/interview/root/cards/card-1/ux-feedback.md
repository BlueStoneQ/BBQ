# 交互反馈（按钮状态机 / Pressable / 乐观更新）

> 问题：操作没反馈 = "搓玻璃板"，用户不知道按没按到
> 本质：每个用户动作都需要在 100ms 内得到视觉反馈
> 目标：全 App 统一的交互反馈体系

---

## 一、触摸反馈（Pressable）

**所有可点击元素都有按下态**，用 `Pressable` 组件：

```typescript
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.card,
    pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }
  ]}
>
  <Text>设备名称</Text>
</Pressable>
```

| 组件 | 推荐度 | 说明 |
|------|--------|------|
| `Pressable` | ✅ 推荐 | 完全自定义 pressed 态 |
| `TouchableOpacity` | 旧 API | 能用但不灵活 |
| `TouchableWithoutFeedback` | ❌ | 无反馈 = "搓玻璃板" |

**封装统一组件**：

```typescript
function PressableCard({ onPress, children, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}
```

---

## 二、按钮状态机

有异步操作的按钮需要完整状态：

```
idle → pressed → loading → success/error → idle
```

```typescript
<ActionButton
  onPress={handleConnect}
  loadingText="连接中..."
  successText="已连接"
  errorText="连接失败"
/>
```

**触摸反馈 vs 状态机的关系**：
- 触摸反馈（pressed）= 状态机的第一步，只管"按下那一瞬间"
- 状态机 = 完整异步操作生命周期（按下 → 等待 → 结果）
- 设备卡片 → 只需触摸反馈；"连接设备"按钮 → 需要完整状态机

---

## 三、乐观更新（Optimistic Update）

**用户操作后 UI 立即更新，不等服务端响应。失败了再回滚。**

```typescript
function changeMode(newMode) {
  // 1. UI 立即更新（乐观）
  setMode(newMode);
  // 2. 发送指令
  bleService.sendCommand({ mode: newMode }).catch(() => {
    // 3. 失败回滚 + 提示
    setMode(previousMode);
    toast.error('指令发送失败');
  });
}
```

| 适用 | 不适用 |
|------|--------|
| 控制指令（调档位/开关） | 需要服务端确认的（支付/配网） |
| 收藏/取消 | 不可逆操作 |
| 设置修改 | 涉及多方同步的 |

---

## 四、BLE 操作反馈

| 操作 | 反馈 |
|------|------|
| 连接设备 | 按钮 loading + 进度提示 + 连接动画 |
| 发送指令 | 乐观更新 + 失败 shake 动画 |
| 断连 | 状态栏提示 + 自动重连指示 |
| 配网 | 分步进度条（扫描→连接→传密码→验证） |
