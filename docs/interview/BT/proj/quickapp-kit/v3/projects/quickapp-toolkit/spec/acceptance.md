# Toolkit 总 Spec：验收

## 目录

- [1. 结论](#1-结论)
- [2. 总 Spec 通过条件](#2-总-spec-通过条件)
- [3. V1 产品验收](#3-v1-产品验收)
- [4. 失败验收](#4-失败验收)
- [5. 证据](#5-证据)

## 1. 结论

Toolkit 只有在**真实联盟 DSL 输入可以确定性地产生合同合法、可由 Runtime 加载的 Runtime RPK**时才算完成；Schema 单独通过不算完成。

## 2. 总 Spec 通过条件

- 需求覆盖输入、编译、产物、CLI、诊断和质量边界。
- 总体架构没有引入第二套 IR、Package 或 JS Module ABI。
- 每项 V1 责任都被唯一分 Spec 接住。
- 分 Spec 依赖无环，且不存在 Android、LVGL 或 iOS 实现依赖。
- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` 的构建责任与全局验收一致。
- 所有后置项明确，不被隐式放入 V1。

## 3. V1 产品验收

### 3.1 Case 001

```text
联盟源码
  -> build success
  -> app.js + page bundles + Page IR + runtime.json + RPK
  -> public schema and relation validation success
  -> Runtime Loader accepts package
```

必须证明：

1. App/Page route、moduleId、templateId 和依赖一一对应。
2. 页面标题、按钮、click Handler、router、prompt 和 Page Control 所需静态/动态事实完整。
3. Widget 输出明确的 V1 排除诊断，不静默打包。
4. 连续两次 clean build 的逻辑产物与哈希一致。
5. `require.context`、ES import/CommonJS require、global 注入和 Case 001 使用的 Less import/mixin/arithmetic/nested selector/CSS shorthand 均有成功 Golden。
6. `system.fetch` import 被保留为 deferred typed module reference；构建产物不包含 generic stub 或 Core fetch request。

### 3.2 Case 002

必须证明：

1. `count` 绑定只定位目标动态 prop。
2. `count=0` 的 Text evaluator Golden 值为字符串 `"0"`，不是 number。
3. `if` 输出可实例化和删除的 Block IR。
4. keyed `for` 输出稳定 key 所需 evaluator 和 Block 定义。
5. Bundle 不包含完整 VNode Tree Runtime。

`BLOCK-001` 必须额外产出可确定执行 keyed add/remove 的 Block IR、Binding/Handler exports 和 Golden；不得把它的覆盖归到 Case 002。

### 3.3 CLI

| 命令 | 通过条件 |
|---|---|
| `build` | 成功输出产物清单、大小、耗时和哈希；失败不留下可误用成品 |
| `inspect` | 能区分联盟包、Runtime RPK 和损坏包，并说明原因 |
| `run` | 以公开参数调用指定 Runtime，正确透传退出状态 |
| Runtime Profile | 读取公共 Runtime Composition Manifest，展示 Profile/JS Engine identity/实际链接模块，并对可静态确定的不兼容给出结构化诊断 |

### 3.4 第二期调用面（非 V1 门禁）

以下约束只记录扩展方向，不参与 Toolkit V1 完成判断：

1. Skill 能使 Agent 找到 V1 DSL 边界、Case、命令和 Diagnostic 处理方式，不携带可执行编译逻辑。
2. MCP 的 `build/inspect/run` 与 CLI 调用同一 Toolkit Application Service。
3. 同一输入经 CLI 与 MCP 得到相同成功状态、Diagnostic code、Artifact 哈希和 Runtime 启动结果。
4. MCP 不通过解析人类日志判断成功，不直接调用 Compiler 内部阶段或平台私有接口。

## 4. 失败验收

至少覆盖：

- Manifest route/module 关系错误。
- 未支持组件、Style、事件和无 key 列表。
- Page IR 环、多父、不可达节点和 scope 错配。
- Bundle export 与 Page IR ID 不一致。
- 重复 RPK member、非法路径、哈希不一致和版本不支持。
- 构建中断后不存在被误认成成功的最终 RPK。

## 5. 证据

- Case 001/002、`BLOCK-001` 与 `CAP-DEVICE-001` Golden 产物与结构化差异。
- 正例和负例测试报告。
- 两次 clean build 的哈希对比。
- Bundle、IR、Metadata、RPK 大小与阶段耗时。
- Runtime Loader 接受产物的集成记录。
- CLI 结构化结果与退出码记录；MCP/Skill 一致性证据后置。
- Runtime Composition Manifest inspect 输出与 Core 加载期兼容性结果对照。
