# tsconfig 与工程化

> 解决什么问题：tsconfig.json 配什么？严格模式开不开？路径怎么映射？多包项目怎么配？
> 原则：开严格模式、用路径别名、monorepo 用 Project References。

---

## 目录

- [tsconfig 核心字段](#tsconfig-核心字段)
- [严格模式](#严格模式)
- [路径映射](#路径映射)
- [模块解析](#模块解析)
- [Monorepo 配置](#monorepo-配置)
- [声明文件](#声明文件)
- [常见问题](#常见问题)

---

## tsconfig 核心字段

```jsonc
{
  "compilerOptions": {
    // 一、严格模式（建议全开）
    "strict": true,               // 开启所有严格检查

    // 二、目标与模块
    "target": "ES2022",           // 编译目标（现代浏览器/Node 18+）
    "module": "ESNext",           // 模块系统（ESM）
    "moduleResolution": "bundler", // 模块解析策略（Vite/Webpack 用 bundler）
    "lib": ["ES2022", "DOM", "DOM.Iterable"],  // 可用 API 声明

    // 三、路径
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],           // 路径别名
      "@components/*": ["src/components/*"]
    },

    // 四、输出
    "outDir": "dist",
    "declaration": true,          // 生成 .d.ts（给库用）
    "declarationMap": true,       // .d.ts 的 sourcemap
    "sourceMap": true,

    // 五、互操作
    "esModuleInterop": true,      // 允许 import x from 'cjs-module'
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,    // import json 文件
    "isolatedModules": true,      // 每个文件独立编译（Vite/esbuild 需要）

    // 六、JSX
    "jsx": "react-jsx",           // React 17+ 不需要 import React
    // Vue 用 "jsx": "preserve"

    // 七、类型检查增强
    "noUnusedLocals": true,       // 未使用变量报错
    "noUnusedParameters": true,   // 未使用参数报错
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true           // 跳过 node_modules .d.ts 检查（加速）
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 严格模式

`"strict": true` 等于同时开启：

| 选项 | 作用 | 为什么要开 |
|------|------|-----------|
| `strictNullChecks` | null/undefined 不能赋给其他类型 | 避免空指针 |
| `noImplicitAny` | 不允许隐式 any | 强制类型声明 |
| `strictFunctionTypes` | 函数参数类型严格检查 | 避免传参错误 |
| `strictPropertyInitialization` | class 属性必须初始化 | 避免 undefined |
| `noImplicitThis` | this 必须有类型 | 避免 this 指向错误 |
| `alwaysStrict` | 输出 "use strict" | ES5 严格模式 |

**建议**：新项目直接 `"strict": true`。老项目渐进开启（先开 `strictNullChecks`，影响最大但收益最高）。

---

## 路径映射

### 配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@api/*": ["src/api/*"],
      "@hooks/*": ["src/hooks/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

### 配合打包工具

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@api': path.resolve(__dirname, 'src/api'),
    }
  }
});
```

**注意**：tsconfig 的 paths 只管类型检查和 IDE 补全，实际运行时的路径解析由 Vite/Webpack 的 alias 处理。两边要一致。

---

## 模块解析

| moduleResolution | 适用 | 说明 |
|-----------------|------|------|
| `bundler` | Vite / Webpack 5 | 最新推荐，理解 exports 字段 |
| `node16` / `nodenext` | Node.js 原生 ESM | 纯 Node 项目 |
| `node` | 旧项目 | 传统 CommonJS 解析（已过时） |

**2026 年新项目用 `bundler`**——它理解 package.json 的 `exports` 字段，和 Vite/Webpack 行为一致。

---

## Monorepo 配置

### Project References（多包共享配置）

```
monorepo/
├── tsconfig.base.json        # 共享的基础配置
├── packages/
│   ├── core/
│   │   └── tsconfig.json     # extends base + 自己的特殊配置
│   ├── ui/
│   │   └── tsconfig.json
│   └── web/
│       └── tsconfig.json
└── tsconfig.json             # 根：references 指向各包
```

```jsonc
// tsconfig.base.json（共享配置）
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}

// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true        // 开启 Project References
  },
  "include": ["src/**/*"]
}

// 根 tsconfig.json
{
  "references": [
    { "path": "packages/core" },
    { "path": "packages/ui" },
    { "path": "packages/web" }
  ]
}
```

**好处**：`tsc --build` 可以增量编译，只编译变化的包。

---

## 声明文件

### 什么时候需要

| 场景 | 需要 .d.ts？ | 怎么做 |
|------|-------------|--------|
| 第三方库没有类型 | 是 | `npm i -D @types/xxx` 或自己写 |
| 全局变量（window.xxx） | 是 | `declare global { ... }` |
| 非 TS 文件（.vue/.svg/.css） | 是 | shims 文件 |
| 自己发布的库 | 是 | `"declaration": true` 自动生成 |

### 常见 shims

```ts
// src/env.d.ts 或 src/shims.d.ts

// Vue SFC
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 图片
declare module '*.png' {
  const src: string;
  export default src;
}

// CSS Modules
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

// 全局变量
declare global {
  interface Window {
    __INITIAL_STATE__: unknown;
    gtag: (...args: unknown[]) => void;
  }
}
```

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 找不到模块 '@/xxx' | tsconfig paths 没配 / Vite alias 没配 | 两边都配一致 |
| .vue 文件报错 | 缺少 vue shims 声明 | 加 `declare module '*.vue'` |
| 隐式 any 报错 | 开了 strict 但没给类型 | 加类型声明或关闭 noImplicitAny（不推荐） |
| 第三方库没类型 | 没有 @types/xxx | 自己写 .d.ts 或用 `declare module 'xxx'` |
| 类型对但运行报错 | TS 只管编译时，运行时数据可能不符 | 加运行时校验（zod/io-ts） |
| tsc 编译慢 | 大项目全量编译 | `skipLibCheck` + Project References 增量编译 |
