# Theme 适配 + 国际化方案

> 问题：出海产品的两个基本要求——Dark Mode 适配 + 多语言支持
> 场景：Root 只适配了 Light Theme，国际化需要覆盖多个市场
> 本质：颜色和文案不能写死，要走变量系统，运行时动态切换

---

## 目录

- [一、Theme 系统（Light/Dark）](#一theme-系统lightdark)
- [二、国际化方案（i18n）](#二国际化方案i18n)
- [三、Theme + i18n 的统一架构](#三theme--i18n-的统一架构)

---

## 一、Theme 系统（Light/Dark）

### 为什么必须做？

- 母婴场景：半夜喂奶/查看设备 → 白色界面刺眼
- App Store / Google Play：Dark Mode 是审核加分项
- iOS 15+ / Android 10+：系统级 Dark Mode 已普及，用户期望 App 跟随

### RN 怎么检测系统主题？

```typescript
import { useColorScheme } from 'react-native';

function App() {
  const colorScheme = useColorScheme();  // 'light' | 'dark' | null
  // 系统切换主题时自动触发重渲染
}
```

`useColorScheme` 是 RN 内置 Hook，监听系统主题变化，自动返回当前值。

### Theme 架构设计

```typescript
// 1. 定义色板（设计师出两套色值）
const lightColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#1A1A1A',
  textSecondary: '#666666',
  primary: '#4A90D9',
  border: '#E0E0E0',
  card: '#FFFFFF',
  error: '#E53935',
  success: '#43A047',
};

const darkColors = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  primary: '#6AB0FF',
  border: '#333333',
  card: '#2A2A2A',
  error: '#EF5350',
  success: '#66BB6A',
};

// 2. Theme Context
const ThemeContext = createContext(lightColors);

function ThemeProvider({ children }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

// 3. 使用：组件里取 theme 变量，不写死色值
function DeviceCard() {
  const colors = useContext(ThemeContext);
  return (
    <View style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <Text style={{ color: colors.text }}>设备名称</Text>
    </View>
  );
}
```

### 核心原则

| 原则 | 做什么 | 为什么 |
|------|--------|--------|
| **颜色不写死** | 所有颜色走 `colors.xxx` | 切换主题时自动生效 |
| **语义化命名** | `colors.text` 不是 `colors.black` | Dark 下 text 是白色，叫 black 就矛盾了 |
| **图片适配** | 准备 Dark 版图片 或 用 tintColor | 白色图标在深色背景上看不见 |
| **阴影适配** | Dark 下用 border 替代 shadow | 深色背景上阴影不可见 |
| **StatusBar 适配** | Light 主题用深色状态栏，Dark 反之 | 状态栏文字要和背景对比 |

```typescript
// StatusBar 跟随主题
<StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
```

### 落地步骤

```
1. 设计出 Dark Mode 色板（和 Light 一一对应）
2. 抽取所有写死的颜色 → 替换为 theme 变量
3. 封装 ThemeProvider + useTheme hook
4. 组件库统一用 theme（改一处全局生效）
5. 图片/图标检查（白色图标加 Dark 版本）
6. 测试：系统切换主题 → App 实时跟随
```

### Theme 切换是实时的吗？

**是的，不需要重启 App。** `useColorScheme()` 是响应式的：

```
用户在系统设置切换 Dark Mode
  → iOS/Android 通知 RN
  → useColorScheme() 返回值从 'light' 变为 'dark'
  → ThemeProvider 重渲染
  → 所有用了 colors.xxx 的组件自动更新颜色
  → 无需重启，实时切换
```

### WebView 里的第三方网页怎么处理？

第三方网页（微博/淘宝）你控制不了它的主题——它是别人的页面。

| 方案 | 做什么 | 效果 |
|------|--------|------|
| WebView 容器适配 | 导航栏/状态栏跟随 App 主题 | 至少"壳"是 Dark 的 |
| 注入 CSS（自有 H5） | 对自己控制的 H5 注入 Dark CSS | 自有页面跟随 App |
| forceDarkOn（Android 13+） | Android WebView 强制反色 | 效果一般，iOS 不支持 |
| 接受现状 | 第三方页面就是 Light | 业界通用做法 |

**实际做法**：自有 H5 → 注入主题；第三方 → 不处理（接受）；尽量减少 WebView 使用（Deep Link + 内容内置）。

---

## 二、国际化方案（i18n）

### 核心方案：i18next + react-i18next

```bash
yarn add i18next react-i18next react-native-localize
```

### 架构

```
src/
├── locales/
│   ├── en.json      → { "device.connect": "Connect", "common.cancel": "Cancel" }
│   ├── zh.json      → { "device.connect": "连接", "common.cancel": "取消" }
│   ├── ja.json      → { "device.connect": "接続", "common.cancel": "キャンセル" }
│   └── index.ts     → 统一导出
├── i18n.ts           → 初始化配置
└── ...
```

### 初始化

```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: getLocales()[0].languageCode,  // 跟随系统语言
  fallbackLng: 'en',                  // 找不到翻译 → 用英文兜底
  interpolation: { escapeValue: false },
});

export default i18n;
```

### 使用

```typescript
import { useTranslation } from 'react-i18next';

function DeviceCard({ device }) {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{device.name}</Text>
      <Button title={t('device.connect')} />
      {/* 带参数 */}
      <Text>{t('device.battery', { level: device.battery })}</Text>
      {/* en.json: "device.battery": "Battery: {{level}}%" */}
    </View>
  );
}
```

### 复数处理

```json
// en.json
{
  "device.count_one": "{{count}} device",
  "device.count_other": "{{count}} devices"
}
// zh.json（中文没有复数变化）
{
  "device.count": "{{count}} 个设备"
}
```

```typescript
t('device.count', { count: 3 })  // en: "3 devices" | zh: "3 个设备"
```

### 日期/数字格式化

```typescript
// 日期：跟随 locale 格式化
const date = new Intl.DateTimeFormat(locale, {
  year: 'numeric', month: 'short', day: 'numeric'
}).format(new Date());
// en: "May 22, 2026" | zh: "2026年5月22日" | ja: "2026年5月22日"

// 数字/货币
const price = new Intl.NumberFormat(locale, {
  style: 'currency', currency: 'USD'
}).format(29.99);
// en: "$29.99" | zh: "US$29.99" | ja: "$29.99"
```

### RTL 支持（阿拉伯语/希伯来语）

**RTL = Right-To-Left**，阿拉伯语/希伯来语的文字从右往左写，整个 UI 布局要镜像翻转：

```
LTR（英语/中文/日语）：        RTL（阿拉伯语/希伯来语）：
┌──────────────────┐          ┌──────────────────┐
│ ← 返回    标题   │          │   标题    返回 → │
│ [头像] 设备名称   │          │   设备名称 [头像] │
│         连接按钮 →│          │← 连接按钮         │
└──────────────────┘          └──────────────────┘
```

导航栏、列表、按钮位置、滑动方向——全部镜像。

```typescript
import { I18nManager } from 'react-native';
import RNRestart from 'react-native-restart';

function setRTL(isRTL: boolean) {
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    RNRestart.restart();  // RTL 切换需要重启 App 生效（RN 限制）
  }
}
```

**为什么 RTL 切换需要重启？** RN 的 Flexbox 布局方向是 App 启动时确定的（Native 层全局配置），运行时改了要重新构建整个布局树，所以必须 restart。（Dark/Light 切换不需要重启，因为只是颜色变了，布局没变。）

RN 的 Flexbox 在 RTL 下自动镜像（`row` 变成从右到左），但以下需要手动处理：
- 带方向的图标（箭头/返回）
- 绝对定位的元素（left/right 互换）
- 自定义动画方向

**对 Root 的建议**：如果目标市场不包含中东（阿拉伯语地区），RTL 可以暂时不做。欧美/亚洲市场都是 LTR。

### 翻译文件管理

| 团队规模 | 方案 | 工具 |
|---------|------|------|
| 小团队 | JSON 文件放代码仓库，开发维护 | 手动 |
| 中团队 | 翻译平台，翻译人员在线翻译，CI 同步 | Crowdin / Lokalise |
| 大团队 | 翻译平台 + 审核流程 + 自动化检测未翻译 key | Phrase / Transifex |

### 常见坑

| 坑 | 原因 | 解决 |
|----|------|------|
| 文案溢出 | 德语/法语比英语长 30-50% | 设计时预留空间 / 用 `numberOfLines` |
| 拼接字符串 | `"Hello" + name` 在其他语言语序不同 | 用参数插值 `t('hello', { name })` |
| 图片里有文字 | 图片不能翻译 | 文字用 Text 覆盖在图片上，或按 locale 换图 |
| 硬编码文案 | 开发写了中文/英文字面量 | ESLint 规则禁止硬编码字符串 |
| 首次加载闪烁 | 翻译文件异步加载，先显示 key | 翻译文件打包进 Bundle（不异步加载） |

---

## 三、Theme + i18n 的统一架构

```typescript
// App 根组件：Theme + i18n 统一 Provider
import './i18n';  // 初始化 i18n

function App() {
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MainNavigator />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

// 组件中同时使用
function DeviceCard({ device }) {
  const colors = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ backgroundColor: colors.card }}>
      <Text style={{ color: colors.text }}>{device.name}</Text>
      <Button title={t('device.connect')} color={colors.primary} />
    </View>
  );
}
```

### 统一设计 Token

```typescript
// 把 Theme + Typography + Spacing 统一管理
const theme = {
  colors: colorScheme === 'dark' ? darkColors : lightColors,
  typography: {
    h1: { fontSize: 24, fontWeight: '700' },
    body: { fontSize: 14, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '300' },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  borderRadius: { sm: 4, md: 8, lg: 12 },
};
```

这样全 App 的颜色/字体/间距/圆角都走统一变量，改一处全局生效。

---

## 概念速查

| 概念 | 一句话 |
|------|--------|
| useColorScheme | RN 内置 Hook，返回系统当前主题（'light'/'dark'） |
| i18next | 国际化框架，key-value 翻译 + 参数插值 + 复数 |
| react-native-localize | 获取系统语言/地区/时区 |
| RTL | Right-to-Left，阿拉伯语/希伯来语的布局方向 |
| I18nManager | RN 内置模块，控制全局 RTL 方向 |
| fallbackLng | 找不到翻译时的兜底语言（通常是 en） |
| Design Token | 颜色/字体/间距的统一变量系统 |
| Intl API | JS 内置的国际化 API（日期/数字/货币格式化） |
