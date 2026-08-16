# Toolkit Requirements

## 目录

- [1. 结论](#1-结论)
- [2. V1 输入](#2-v1-输入)
- [3. V1 输出](#3-v1-输出)
- [4. 验收](#4-验收)

## 1. 结论

**Toolkit V1 先完成“联盟源码可发现、可校验、可编译、可打包”的闭环；不在 Toolkit 中实现 Runtime。**

## 2. V1 输入

- 项目根目录；
- `src/manifest.json`；
- `src/app.ux`；
- Manifest `router.pages` 声明的页面 `index.ux`；
- 页面和应用脚本引用的 JS 模块；
- Less、图片和其他静态资源。

Case 001 `quickapp-code-test1` 是 V1 的基线输入。

## 3. V1 输出

- `app.js`；
- 页面 JS Bundle；
- Template、Binding、Block、Handler、Style IR；
- Runtime Metadata；
- Manifest 索引；
- RPK 容器；
- 诊断报告和构建报告。

## 4. 验收

1. 缺失或非法 Manifest 必须稳定失败并带错误码。
2. Manifest 路由必须能解析到源码页面入口。
3. 相同输入和配置产生稳定的逻辑路径、ID、模块顺序和产物摘要。
4. Loader、编译器和 Packager 只能通过合同对象传递数据。
5. Runtime 可以仅依赖 RPK 逻辑索引加载 `app.js`、页面 Bundle 和 IR。
