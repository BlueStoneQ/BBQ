# T10 Case 001 End-to-End

## 主链

```text
quickapp-code-test1/src
-> quickapp build
-> RPK
-> inspect / validate
-> Runtime Loader
-> 首屏
-> Binding 更新
-> 页面跳转
-> 点击事件
```

## 验收

1. 首页和详情页入口可加载。
2. App 级 `$utils`、`$apis` 共享模块只初始化一次。
3. `@system.router` 和 `@system.prompt` 通过 Feature ABI 工作。
4. Template/Binding/Handler/Style IR 可被 Runtime 消费。
5. 产物大小、重复依赖和构建阶段可观测。

