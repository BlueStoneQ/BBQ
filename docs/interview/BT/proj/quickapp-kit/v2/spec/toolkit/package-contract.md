# Toolkit Package Contract

## 目录

- [1. 结论](#1-结论)
- [2. 包结构](#2-包结构)
- [3. 加载索引](#3-加载索引)
- [4. 页面加载](#4-页面加载)
- [5. 版本与兼容](#5-版本与兼容)

## 1. 结论

**RPK 是部署容器；Manifest 是入口索引；JS Bundle 和 Runtime IR 是 Runtime 的两类输入。**

## 2. 包结构

```text
app.rpk
├── manifest.json
├── app.js
├── shared.js                       # 有公共模块时
├── pages/
│   └── <route>/index.js
├── quickapp-kit/
│   ├── runtime-meta.json
│   └── pages/<route>/
│       ├── template.ir.json
│       ├── bindings.ir.json
│       ├── blocks.ir.json
│       ├── handlers.ir.json
│       └── styles.ir.json
├── assets/
└── META-INF/
```

实际文件布局可以优化，但 Manifest 必须提供逻辑索引，Runtime 不得依赖目录猜测。

## 3. 加载索引

`runtime-meta.json` 最小字段：

```json
{
  "schemaVersion": 1,
  "runtimeAbi": "quickapp-kit-v1",
  "entry": {
    "app": "app.js",
    "pages": {
      "pages/Demo": "pages/Demo/index.js"
    }
  },
  "templates": {
    "pages/Demo/index": "quickapp-kit/pages/Demo/template.ir.json"
  },
  "bindings": {
    "pages/Demo/index": "quickapp-kit/pages/Demo/bindings.ir.json"
  },
  "blocks": {
    "pages/Demo/index": "quickapp-kit/pages/Demo/blocks.ir.json"
  },
  "handlers": {
    "pages/Demo/index": "quickapp-kit/pages/Demo/handlers.ir.json"
  },
  "styles": {
    "pages/Demo/index": "quickapp-kit/pages/Demo/styles.ir.json"
  }
}
```

Manifest 负责应用路由和资源；QuickApp Kit Runtime Metadata 负责 JS/IR 的内部加载索引。

## 4. 页面加载

```text
启动 App
  -> 加载 app.js
  -> 建立 App ModuleRegistry
  -> 根据路由加载首页 Shared Chunk / Page Bundle / IR

页面跳转
  -> 查找 Page Entry
  -> 加载缺失 Shared Chunk
  -> 加载 Page Bundle
  -> 加载 Page IR
  -> 在同一 App JS Runtime 创建页面实例
```

规则：

- 同一 App Runtime 内 Shared Module 只执行一次。
- 页面实例销毁不等于卸载 Shared Module。
- 页面 IR 按需加载；页面销毁后可释放。
- Runtime 不要求所有页面在启动时全部解析。

## 5. 版本与兼容

Runtime 必须校验：

```text
package format
runtimeAbi
ir schemaVersion
toolkitVersion
minPlatformVersion
```

版本不兼容时必须在加载前失败，并报告明确错误；不得执行部分页面 Bundle 后才发现 IR 不兼容。
