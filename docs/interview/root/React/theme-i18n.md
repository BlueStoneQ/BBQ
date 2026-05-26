# Theme & i18n

## 目录

- [Theme（主题）](#theme主题)
- [i18n（国际化）](#i18n国际化)

---

## Theme（主题）

### 核心思路

主题 = 一套设计变量（颜色、字号、间距），通过 Context 或 CSS 变量全局切换。

### 方案一：CSS 变量（推荐，性能最好）

```css
/* theme.css */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #3b82f6;
  --radius: 8px;
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #f5f5f5;
  --color-primary: #60a5fa;
}
```

```tsx
// 切换主题：只改 HTML 属性，CSS 变量自动生效，零重渲染
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>切换</button>;
}

// 组件中使用：直接引用 CSS 变量
// .card { background: var(--color-bg); color: var(--color-text); }
```

**优点**：切换时不触发 React 重渲染（纯 CSS 层面切换），性能最好。

### 方案二：Context + JS 对象（灵活，适合动态主题）

```tsx
// 定义主题
const themes = {
  light: { bg: '#fff', text: '#1a1a1a', primary: '#3b82f6' },
  dark: { bg: '#1a1a1a', text: '#f5f5f5', primary: '#60a5fa' },
};

type Theme = typeof themes.light;
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>(null!);

// Provider
function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const value = useMemo(() => ({
    theme: themes[mode],
    toggle: () => setMode(m => m === 'light' ? 'dark' : 'light'),
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// 使用
function Card() {
  const { theme } = useContext(ThemeContext);
  return <div style={{ background: theme.bg, color: theme.text }}>内容</div>;
}
```

**缺点**：theme 变化 → 所有 consumer 重渲染。适合主题切换频率低的场景。

### 方案三：Tailwind CSS + dark: 前缀

```tsx
// tailwind.config.js: darkMode: 'class'
// HTML: <html class="dark">

function Card() {
  return (
    <div className="bg-white dark:bg-gray-900 text-black dark:text-white">
      内容
    </div>
  );
}
```

### 选型

| 方案 | 适用 | 性能 |
|------|------|------|
| CSS 变量 | 通用，主题变量固定 | ✅ 最好（纯 CSS） |
| Context + JS | 需要动态主题（用户自定义颜色） | ⚠️ 切换时全量重渲染 |
| Tailwind dark: | 已用 Tailwind 的项目 | ✅ 好（class 切换） |

---

## i18n（国际化）

### 核心思路

国际化 = 文案和代码分离，运行时根据语言加载对应文案。

### 方案：react-i18next（主流）

**安装**：
```bash
pnpm add i18next react-i18next
```

**配置**：

```tsx
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        welcome: 'Welcome, {{name}}',
        items_count: '{{count}} item',
        items_count_plural: '{{count}} items',
      },
    },
    zh: {
      translation: {
        welcome: '欢迎，{{name}}',
        items_count: '{{count}} 个项目',
      },
    },
  },
  lng: 'zh',           // 默认语言
  fallbackLng: 'en',   // 兜底语言
  interpolation: { escapeValue: false },
});

export default i18n;
```

**使用**：

```tsx
import { useTranslation } from 'react-i18next';

function Header() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('welcome', { name: '乔阳' })}</h1>  {/* 欢迎，乔阳 */}
      <p>{t('items_count', { count: 5 })}</p>     {/* 5 个项目 */}

      {/* 切换语言 */}
      <button onClick={() => i18n.changeLanguage('en')}>English</button>
      <button onClick={() => i18n.changeLanguage('zh')}>中文</button>
    </div>
  );
}
```

### 文案管理最佳实践

```
src/
├── locales/
│   ├── en/
│   │   ├── common.json      // 公共文案
│   │   ├── dashboard.json   // 按页面/模块拆分
│   │   └── settings.json
│   └── zh/
│       ├── common.json
│       ├── dashboard.json
│       └── settings.json
└── i18n.ts
```

**按需加载**（大型应用）：

```tsx
// 不一次性加载所有语言包，按路由懒加载
i18n.use(Backend).init({
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',  // 按需请求
  },
  ns: ['common'],          // 默认只加载 common
  defaultNS: 'common',
});

// 某个页面需要额外的 namespace
function DashboardPage() {
  const { t } = useTranslation('dashboard');  // 触发加载 dashboard.json
  return <h1>{t('title')}</h1>;
}
```

### 常见需求

| 需求 | 实现 |
|------|------|
| 插值 | `t('hello', { name: 'xxx' })` → `Hello, xxx` |
| 复数 | `t('items', { count: 5 })` → 自动选 plural 形式 |
| 嵌套 key | `t('nav.home')` |
| 日期/数字格式化 | 配合 `Intl.DateTimeFormat` / `Intl.NumberFormat` |
| RTL 布局（阿拉伯语） | CSS `direction: rtl` + 逻辑属性（`margin-inline-start`） |
| 语言检测 | `i18next-browser-languagedetector`（读 navigator.language） |

### 和 RN 的区别

| | Web (react-i18next) | RN |
|--|---|---|
| 文案存储 | JSON 文件 / 远端 CDN | 同，或打包在 bundle 内 |
| 语言检测 | navigator.language | `react-native-localize` 读系统语言 |
| RTL | CSS direction | `I18nManager.forceRTL(true)` |
| 热切换 | 直接 `changeLanguage` | 部分组件需要 reload（RN 限制） |
