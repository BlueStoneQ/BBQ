// 注册一个应用模块，模块 ID 是 "@quickapp-kit/app"
$app_define$("@quickapp-kit/app", [], function ($app_require$, module, exports) {
  // 导出应用模块定义
  module.exports = {
    // 模块接口版本
    schemaVersion: 1,

    // 声明这是应用模块，不是页面模块
    kind: "app",

    // 创建当前应用的 App VM
    createAppVm: function (context) {
      return {
        // 应用创建生命周期
        onCreate() {}
      };
    },
  };
});

// 启动已经注册的应用模块
$app_bootstrap$("@quickapp-kit/app", {
  schemaVersion: 1,
  kind: "app",
  moduleId: "@quickapp-kit/app"
});