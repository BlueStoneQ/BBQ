# RPK Package Design

## 目录

- [1. 结论](#1-结论)
- [2. 包布局](#2-包布局)
- [3. 构建顺序](#3-构建顺序)
- [4. Loader 边界](#4-loader-边界)

## 1. 结论

```text
validated artifacts
  -> Runtime Metadata
  -> logical package index
  -> deterministic container
  -> optional signature
```

## 2. 包布局

```text
manifest.json
app.js
shared.js
pages/<route>/index.js
quickapp-kit/runtime-meta.json
quickapp-kit/pages/<route>/{template,bindings,blocks,handlers,styles}.ir.json
assets/**
META-INF/**
```

Manifest 管应用路由；Runtime Metadata 管 Bundle 和 IR；两者都必须显式列出逻辑路径。

## 3. 构建顺序

```text
Build Artifacts -> Validate -> Index -> Sort -> Pack -> Sign -> Report
```

Packager 不解析 AST、不执行 JS、不创建 Runtime Tree。任何校验错误都阻止打包。

## 4. Loader 边界

```text
Open -> Verify -> Index -> Load App/Page -> Close
```

Loader 只返回字节和已验证的 Artifact Descriptor；模板解释、JS 执行和平台渲染属于 Runtime。
