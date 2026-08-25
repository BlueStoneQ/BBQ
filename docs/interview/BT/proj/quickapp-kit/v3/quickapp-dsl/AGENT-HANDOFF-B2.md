# B2 Slider + Picker 公共实现交接（2026-08-25）

## 结论

已完成 B2 公共 Core/Page IR/JS typed ABI/Toolkit 最小扩展，并生成真实 `controls-002.rpk`。Router、三大系统、既有 RPK 和平台目录未修改。

## 公共语义

- Slider：`min/max/step/value/enabled` 数值/布尔 props；`change` payload 至少为 `{ value: number, isFromUser: boolean }`。
- Picker：V1 只做 `mode="text"`；`range` 是本地 `|` 分隔字符串，`selected` 是零基整数；`change` payload 至少为 `{ selected: number, value: string }`。
- 受控数值通道加入既有 typed ABI `BindingValue`，支持 `string | boolean | number`；没有引入通用 JSON Bridge。
- C++ Runtime Tree 仍是唯一权威树；平台 Native 映射不在本 Agent 范围内。

## 主要文件

- `quickapp-runtime-core/include/quickapp/core/package/page_ir.h`
- `quickapp-runtime-core/src/page_ir.cpp`
- `quickapp-runtime-core/src/page_ir_model.cpp`
- `quickapp-runtime-core/include/quickapp/core/runtime_tree/runtime_tree.h`
- `quickapp-runtime-core/src/runtime_tree.cpp`
- `quickapp-runtime-core/src/mount_coordinator.cpp`
- `quickapp-runtime-js/include/quickapp/js/abi/runtime_abi_types.h`
- `quickapp-runtime-js/src/abi/runtime_abi_codec.cpp`
- `quickapp-runtime-js/src/render/alpha_initial_transaction_builder.cpp`
- `quickapp-toolkit/src/compiler/frontend/ux-parser.ts`
- `quickapp-toolkit/src/compiler/frontend/feature-matrix.ts`
- `quickapp-toolkit/src/compiler/lowering/types.ts`
- `quickapp-toolkit/src/compiler/lowering/canonical-lowerer.ts`
- `quickapp-toolkit/src/compiler/emitter/page-ir-emitter.ts`
- `v3/spec/contracts/host-component-contract.md`
- `v3/spec/contracts/event-contract.md`
- `v3/spec/contracts/render-contract.md`
- `v3/spec/contracts/schemas/host-component.schema.json`
- `quickapp-examples/showcases/controls-002/`

## RPK

- 构建命令：`node quickapp-examples/showcases/controls-002/scripts/build-controls.mjs`
- 产物：`quickapp-examples/showcases/controls-002/dist/controls-002.rpk`
- 大小：`16427` bytes
- 两次构建 SHA-256：`b738c890107d54f82ecf2c3f949c5df3688b6760e45d326b08f4c23de53d297a`
- 路由：`/pages/Home`
- 能力声明：`system.router`
- 资源：1 张 32x32 PNG，`1720` bytes
- Page IR 已包含 `Slider`、`Picker` 和两个 `change` Handler。
- RPK 由 Toolkit 从联盟 DSL 生成，未手写 Page IR、RenderTransaction 或 MountTransaction。

## 测试

- Core build：通过
- Core CTest：`17/17` 通过
- Toolkit：`84 passed, 0 failed`
- JS build：通过
- JS CTest：其余测试通过；工作区既有 `js_s04_vm_lifecycle_tests` 在消息数量断言 `messages.size() == 5` 处失败，未由 B2 修改引入。

## 剩余问题

1. Android/iOS/LVGL 仍需实现 Slider/Picker Native 映射和 `change` payload，平台代码本轮未修改。
2. 当前 `controls-002` 使用静态初始值；动态数值 Binding evaluator 和真实平台交互回写需由后续平台/JS Framework 任务继续验证。
3. 日期、时间、多列 Picker 不在 B2 范围内。
