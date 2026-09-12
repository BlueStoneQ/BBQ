# 模块和依赖系统

# 内部feature（runtime service）
$app_define$：登记模块
$app_require$：请求模块
  - import 不会走ESM之类的，而是编译成这个
ModuleLoader：查表、加载依赖、执行和缓存