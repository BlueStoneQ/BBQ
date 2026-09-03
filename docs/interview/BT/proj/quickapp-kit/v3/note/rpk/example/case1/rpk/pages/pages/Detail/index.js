
// 先注册依赖
$app_define$("@quickapp-kit/page/pages/Detail", [], function ($app_require$, module, exports) {
  const router = $app_require$("@app-module/system.router").default;
  // 把页面初始数据包装成可观察的 Page VM，并建立“状态变化 -> Binding 更新 -> 渲染提交”的闭环。
  /**
   * 
    创建 Proxy
    -> 捕获 state 写入
    -> 标记相关 Binding / Block 为 dirty
    -> 注册一次 render microtask
    -> flush 时生成 RenderIntentTransaction
   */
  const __qak_reactive_page_vm__ = function (target, context, bindings) {
    let scheduled = false;
    let revision = 0;
    let sequence = 0;
    const dirty = new Set();
    const blockDefinitions = arguments[3] || {};
    let activeBlocks = new Map();
    let activeBlockSlots = new Map();
    const blockGenerations = new Map();
    let proxy;
    const blockSlot = function (definition, key) { return String(definition.templateBlockId) + "\u0000" + String(key); };
    const blockInstanceId = function (definition, key, generation) { const base = "blk:" + context.surfaceId + "-" + String(definition.templateBlockId) + "-" + String(key).replace(/[^A-Za-z0-9_.-]/g, "_"); return generation === 1 ? base : base + "-g" + String(generation); };
    const collectBlocks = function () {
      const result = [];
      const dynamicOffsets = {};
      Object.keys(blockDefinitions).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (id) {
        const definition = blockDefinitions[id];
        const parentKey = String(definition.parentTemplateNodeId);
        const append = function (key, scope) { const offset = dynamicOffsets[parentKey] || 0; result.push({ definition: definition, key: key, scope: scope, index: definition.staticIndex + offset }); dynamicOffsets[parentKey] = offset + 1; };
        if (definition.kind === "if") {
          if (definition.evaluate.call(proxy, {})) append("if", {});
          return;
        }
        const items = definition.evaluate.call(proxy, {});
        if (!Array.isArray(items)) return;
        items.forEach(function (item, index) { const scope = {}; scope[definition.indexAlias] = index; scope[definition.itemAlias] = item; append(definition.key.call(proxy, scope), scope); });
      });
      return result;
    };
    const blockBindings = function (item) {
      const values = {};
      Object.keys(item.definition.bindings).forEach(function (id) { values[id] = item.definition.bindings[id].call(proxy, item.scope); });
      return values;
    };
    const reconcileBlocks = function (initial) {
      const nextBlocks = new Map();
      const operations = [];
      collectBlocks().forEach(function (item) {
        const slot = blockSlot(item.definition, item.key);
        const previousId = activeBlockSlots.get(slot);
        const previous = previousId === undefined ? undefined : activeBlocks.get(previousId);
        const generation = blockGenerations.get(slot) || 0;
        const id = previousId === undefined ? blockInstanceId(item.definition, item.key, generation + 1) : previousId;
        if (previousId === undefined) blockGenerations.set(slot, generation + 1);
        if (previous === undefined) {
          const handlers = item.definition.handlers.map(function (handler) { return { ownerInstanceId: id, templateHandlerId: handler.templateHandlerId, handlerId: "hdl:" + context.surfaceId + "-" + String(handler.templateHandlerId) + "-" + id }; });
          operations.push({ kind: "instantiateBlock", templateBlockId: item.definition.templateBlockId, blockInstanceId: id, parent: { ownerInstanceId: "cmp:" + context.surfaceId, templateNodeId: item.definition.parentTemplateNodeId }, index: item.index, key: item.key, initialBindings: blockBindings(item), handlers: handlers });
        } else if (!initial && previous.index !== item.index) {
          operations.push({ kind: "moveBlock", blockInstanceId: id, parent: { ownerInstanceId: "cmp:" + context.surfaceId, templateNodeId: item.definition.parentTemplateNodeId }, index: item.index });
        }
        nextBlocks.set(id, { definition: item.definition, key: item.key, scope: item.scope, index: item.index, slot: slot });
      });
      if (!initial) activeBlocks.forEach(function (previous, id) { if (!nextBlocks.has(id)) operations.push({ kind: "removeBlock", blockInstanceId: id }); });
      const nextSlots = new Map(); nextBlocks.forEach(function (value, id) { nextSlots.set(value.slot, id); });
      return { operations: operations, nextBlocks: nextBlocks, nextSlots: nextSlots };
    };
    const commitBlocks = function (nextBlocks, nextSlots) { activeBlocks = nextBlocks; activeBlockSlots = nextSlots; };
    const flush = function () {
      scheduled = false;
      if (dirty.size === 0) return;
      const operations = [];
      dirty.forEach(function (id) {
        const binding = bindings[id];
        if (binding === undefined) return;
        operations.push({ kind: "updateBinding", ownerInstanceId: "cmp:" + context.surfaceId, templateBindingId: Number(id), value: binding.evaluate.call(proxy, {}) });
      });
      const blocks = reconcileBlocks(false);
      blocks.operations.forEach(function (operation) { operations.push(operation); });
      if (operations.length === 0) return;
      const nextRevision = revision + 1;
      const causalRequest = globalThis.$quickapp_current_request_id$;
      const message = { schemaVersion: 1, surfaceId: context.surfaceId, transactionId: "txn:" + context.surfaceId + "-" + String(++sequence), revision: nextRevision, operations: operations };
      if (typeof causalRequest === "string" && causalRequest.indexOf("req:") === 0) message.requestId = causalRequest;
      const result = globalThis.$quickapp_runtime_v1_submitRenderTransaction$(message);
      if (result && result.ok === true) { revision = nextRevision; dirty.clear(); commitBlocks(blocks.nextBlocks, blocks.nextSlots); }
    };
    // 用 Proxy 包装页面原始对象，得到响应式 Page VM
    proxy = new Proxy(target, {
      // 拦截 this.xxx = value
      set: function (object, property, value) {
        // 先把新值写入原始页面对象
        object[property] = value;

        // 把属性名统一转成字符串，例如 "title"
        const name = String(property);

        // 找出依赖该状态属性的 Binding，并标记为待更新
        Object.keys(bindings).forEach(function (id) {
          if (bindings[id].deps.indexOf(name) >= 0) {
            dirty.add(id);
          }
        });

        // 如果该状态影响 if/for，则标记动态结构需要重新计算
        Object.keys(blockDefinitions).forEach(function (id) {
          if (blockDefinitions[id].deps.indexOf(name) >= 0) {
            dirty.add("__qak_block__");
          }
        });

        // 同一轮多次状态写入只安排一次 flush
        if (!scheduled) {
          scheduled = true;

          // 当前 JS task 结束后执行渲染微任务
          Promise.resolve().then(flush);
        }

        // 告诉 Proxy：本次赋值成功
        return true;
      }
    });
    const initialBlocks = reconcileBlocks(true);
    commitBlocks(initialBlocks.nextBlocks, initialBlocks.nextSlots);
    Object.defineProperty(proxy, "__qak_initial_blocks__", { value: initialBlocks.operations });
    return proxy;
  };
  module.exports = {
    schemaVersion: 1,
    kind: "page",
    // target 就是页面原始对象，也就是 .ux 中 <script> 导出的页面定义实例
    createPageVm: function (context) { return __qak_reactive_page_vm__({ onBack() { router.back(); } }, context, {}, {}); },
    bindingEvaluators: {
    },
    handlerMethods: {
      "1": "onBack",
    },
  };
});

// 通知 QuickApp 运行时正式启动 Detail 页面
$app_bootstrap$(
  "@quickapp-kit/page/pages/Detail",
  {
    schemaVersion: 1,
    kind: "page",
    moduleId: "@quickapp-kit/page/pages/Detail",
    templateId: "page:/pages/Detail"
  }
);
