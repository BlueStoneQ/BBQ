# rpk 中的 page.js

参照真实产物 `/tmp/sw-rpk/pages/Home/index.js`（已清掉死代码后的干净形态）。

## 第一性

page.js 本身不含响应式逻辑（机器在 framework）。它只是**一份料 + 交给 Core 的壳**：
喂料给 `createReactivePageVm`，导出给 Core 用的字段，登记模板身份。

## 实现

```js
$app_define$("@quickapp-kit/page/pages/Home", ["@quickapp-kit/framework-v1"],
function ($app_require$, module, exports) {
  const router = $app_require$("@app-module/system.router").default;
  const framework = $app_require$("@quickapp-kit/framework-v1").default;

  module.exports = {
    kind: "page",
    s s// createReactivePageVm 参考这个：BBQ/docs/interview/BT/proj/quickapp-kit/v3/note/js/js-framework.md
    createPageVm: (context) => framework.createReactivePageVm(

      // ── 参数1: target ──────────────────────────────────────────────
      // 是什么：页面的状态 + 方法。   哪来：DSL 的 data/methods 原样搬来。
      // 干什么：唯一"活"的数据，改它才触发响应式。
      // 谁怎么用：被 framework 用 Proxy 劫持；evaluate/事件方法里的 this 就指它。
      { steps: "6,842", heartRate: "72", calories: "186", distance: "3.2",
        hasGoal: true, goals: [{ id: "g1", name: "跑步" }, { id: "g2", name: "喝水" }],
        onGoals() { router.push({ uri: "/pages/Goals" }); } },

      // ── 参数2: context ──
      // 是什么：一个 JS obj，装这一屏的运行时身份（关键是 surfaceId）。
      // 哪来/谁传：Core 的 module loader 调 createPageVm 时传入（内容由 Core 上层构造）。
      // 谁用：framework 只读——拼实例 id、给事务打 surfaceId 归属。

      context,

      // ── 参数3: bindings ────────────────────────────────────────────
      // 是什么：静态绑定表。key = 编译期 templateBindingId（JS/IR/事务共用的地址）。
      // 哪来：toolkit 编译期从每个 {{...}} 抽出。
      // 干什么：deps=这个绑定依赖哪些 state 字段(编译期静态算好)；evaluate=怎么求值。
      // 谁怎么用：改 state → framework 按 deps 反查标脏 → flush 里跑 evaluate 得新值。
      // key： templateBindingId —— 编译期给这个 {{}} 分的号，指向模板里那个绑定点（steps 显示在哪个节点的哪个属性上）。一个数字，三处共用：JS 侧当 bindings 表 key、IR 里标"这号绑定挂在哪"、事务里带着它过桥。Core 拿到"1 号变成 6842"就知道更新到哪
      { 1: { deps: ["steps"],     evaluate() { return String(this.steps); } },
        2: { deps: ["heartRate"], evaluate() { return String(this.heartRate); } },

      // ── 参数4: blocks ──────────────────────────────────────────────
      // 是什么：动态节点表(if/for)。key = 编译期 templateBlockId。
      // 哪来：toolkit 编译期从 DSL 的 if/for 指令抽出。
      // 干什么：kind 区分 if/for；deps=依赖字段；evaluate=算存在/算列表；
      //         for 的 key=每项稳定身份(决定实例复用而非重建)。
      // 谁怎么用：framework 在 flush 里 reconcile，产出 block 的 增/删/移。
      { 5: { kind: "if",  deps: ["hasGoal"], evaluate() { return this.hasGoal; } },
        6: { kind: "for", deps: ["goals"],
             evaluate() { return this.goals; },
             key(scope) { return scope.item.id; } } }
    ),

    // bindingEvaluators：{bindingId: 求值函数}。哪来：toolkit 编译期从每个 {{...}} 抽出(与 bindings 同源)。
    //   Core 存下它，需要主动求某个绑定值时按 id 直接调。
    bindingEvaluators: {
      1: function () { return String(this.steps); },
      2: function () { return String(this.heartRate); },
    },
    // handlerMethods：{key: 方法名}。key = 编译期 templateHandlerId（模板里第几个事件绑定点，与 bindingId 同套路）。
    //   哪来：toolkit 编译期从 DSL 的事件绑定(如 @click)抽出。
    //   含义：模板里 1 号事件点触发时，调 target 上的 "onGoals" 方法。Core 存下它，事件发生按 id 查方法名。
    handlerMethods: { 1: "onGoals" },
  };
});

$app_bootstrap$("@quickapp-kit/page/pages/Home",
  { kind: "page", moduleId: "@quickapp-kit/page/pages/Home", templateId: "page:/pages/Home" });
```

## 要点

- input = state + bindings + blocks，全是死数据 + 纯函数；机器在 framework，page 不实现。
- id（bindings 的 `1~4`）是编译期分配的号，JS/IR/事务共用的稳定地址。
- surfaceId（动态分配，本质是页面实例id） 不写死在 page 里，运行时经 `context` 传入。
