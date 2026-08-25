# B3 List + Scroll Handoff

## 结论

B3 公共实现已完成：Toolkit 可以把真实联盟 DSL 中的 `List`、`Scroll`、keyed `for` 和四类滚动事件降低为公共 Page IR，并生成真实 `list-001.rpk`。Core 仍只有一棵 Runtime Tree；没有引入列表专用状态树、虚拟化、复用器或第二套路由。

本轮没有修改 Android、iOS、LVGL 或其他平台代码，也没有修改已有 RPK。

## 目录

1. [范围](#范围)
2. [合同](#合同)
3. [实现](#实现)
4. [RPK](#rpk)
5. [验证](#验证)
6. [边界](#边界)

## 范围

- `List`：明确的纵向列表 Host；列表项仍通过既有 keyed `for` Block 实例化、移动和删除。
- `Scroll`：明确的纵向滚动容器 Host；内容范围由 Core 的统一 Runtime Tree 布局结果和平台 viewport 决定。
- 事件：`scroll`、`scrollend`、`scrolltop`、`scrollbottom`。
- 滚动事件 payload 的公共字段：`scrollOffset`、`contentSize`、`viewportSize`，均为数值；边界事件表示到达顶部或底部。
- 不包含：虚拟化、瀑布流、多列布局、复杂复用和动画滚动。

## 合同

公共 Page IR 新增：

- Host Component：`List`、`Scroll`，当前不接受业务 props；样式仍走公共 Style/布局合同。
- EventType：`scroll`、`scrollend`、`scrolltop`、`scrollbottom`。
- Event Message、Page IR Schema、Host Component Schema 已同步枚举和结构。

通信路径保持不变：

```text
联盟 DSL
-> Toolkit Frontend / Canonical Lowering
-> Page IR + JS Module
-> JS typed ABI Event
-> C++ Core Event Router
-> Platform Scroll/Input Adapter
```

`List`/`Scroll` 不是第二棵树；Core 的唯一 Runtime Tree 仍是唯一权威节点结构。平台负责将原生滚动输入转换为 typed Event，不把平台指针或原生对象放入 ABI。

## 实现

代码仓库：`/Users/qy/code/my-github/quickapp-kit-ai`

- Core：
  - `quickapp-runtime-core/include/quickapp/core/package/page_ir.h`
  - `quickapp-runtime-core/src/page_ir.cpp`
  - `quickapp-runtime-core/src/page_ir_model.cpp`
  - `quickapp-runtime-core/src/event_router.cpp`
  - `quickapp-runtime-core/tests/core_m1_alpha_render_tests.cpp`
- JS ABI：
  - `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp`
  - `quickapp-runtime-js/tests/js_s02_contract_tests.cpp`
- Toolkit：
  - `quickapp-toolkit/src/compiler/frontend/ux-parser.ts`
  - `quickapp-toolkit/src/compiler/frontend/feature-matrix.ts`
  - `quickapp-toolkit/src/compiler/lowering/types.ts`
  - `quickapp-toolkit/src/compiler/lowering/canonical-lowerer.ts`
  - `quickapp-toolkit/src/compiler/emitter/page-ir-emitter.ts`
  - `quickapp-toolkit/test/integration/canonical-lowering.test.ts`
- Contract：
  - `v3/spec/contracts/host-component-contract.md`
  - `v3/spec/contracts/event-contract.md`
  - `v3/spec/contracts/schemas/host-component.schema.json`
  - `v3/spec/contracts/schemas/page-ir.schema.json`
  - `v3/spec/contracts/schemas/event-message.schema.json`

## RPK

基线源码：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/list-001`

构建命令：

```bash
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-toolkit
npm run build

cd /Users/qy/code/my-github/quickapp-kit-ai
node quickapp-examples/showcases/list-001/scripts/build-list.mjs
node quickapp-examples/showcases/list-001/scripts/build-list.mjs
```

产物：

- RPK：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/list-001/dist/list-001.rpk`
- 大小：18,826 bytes
- SHA-256：`f9087a6e1a9b0cc9c104a57586b6196636b8a2853d386ab68551fa2c0eb640c2`
- 两次构建：字节级一致，SHA-256 一致
- 页面：`pages/Home`
- 图片：1 张，`assets/images/item.png`，32x32，1,720 bytes
- 能力声明：仅 `system.router`
- RPK 成员包含：`app.js`、页面 `index.js`、Page IR、runtime metadata、manifest 和图片资源

## 验证

Toolkit：

- `npm test`
- 85 passed, 0 failed
- 包含 `TK-S13 list-001 lowers explicit List/Scroll and scroll handlers`

Core：

- `cmake --build build-m1-s2 -j2`
- `ctest --test-dir build-m1-s2 --output-on-failure`
- 17/17 passed
- 包含 List/Scroll Page IR、四类滚动 Handler、required component 和 wire name 检查

JS：

- `cmake --build build-m1-s2 -j2`
- `ctest --test-dir build-m1-s2 --output-on-failure`
- 10/11 passed；新增滚动事件 ABI 检查通过
- `js_s04_vm_lifecycle_tests` 仍失败于工作区既有的 `messages.size() == 5` 断言；本轮未修改其生命周期实现，单独记录，不归因于 B3 List/Scroll

Schema：

- Page IR、Event Message、Host Component 三个 JSON Schema 均可被 JSON parser 校验

## 边界

B3 只完成公共语义、编译产物和协议验证。Android、iOS、LVGL 的原生滚动控件创建、viewport 输入采集和滚动事件产生，需要各平台 Adapter 在后续平台集成阶段实现；本 handoff 不把该部分标记为已完成。

下一步应在不改变 Core 唯一 Runtime Tree 和公共事件合同的前提下，由平台 Agent 分别实现 `List`/`Scroll` 的 Native Mount 与 typed scroll event 回送，然后使用 `list-001.rpk` 做三端验收。
