# JS-S02 实现复核与下一步

> 本文记录返修前门禁；当前结论以 [`2026-08-17-w1-close-and-w2-launch.md`](./2026-08-17-w1-close-and-w2-launch.md) 为准。

## 目录

- [1. 结论](#1-结论)
- [2. 已通过](#2-已通过)
- [3. 阻塞项](#3-阻塞项)
- [4. 当前进度](#4-当前进度)
- [5. Agent 指令](#5-agent-指令)

## 1. 结论

JS-S02 的状态机、线程、背压、关联与销毁已经成立，但消息模型仍是动态字段表，因此暂不关闭 W1。

## 2. 已通过

| 项目 | 结果 |
|---|---|
| Source manifest | 全部匹配 |
| Debug | 5/5 |
| Release | 5/5 |
| ASan/UBSan | 5/5 |
| TSan | 5/5 |
| API-only | 构建通过 |
| allocator/业务 completion 边界 | 通过 |
| JS-S03 越界扫描 | 通过 |

## 3. 阻塞项

当前实现：

```cpp
template <CoreMessageKind Kind>
struct CoreMessage {
  RuntimeValue::Object fields;
};
```

这只让 `kind` 具备编译期类型，字段仍是字符串字典。其本质仍要求 Core 或 consumer 再解释字段名，与冻结的具体 C++ struct closed union 不一致。

正确边界：

```text
JS RuntimeValue
  -> strict decoder，字段名只在这里出现
  -> concrete C++ message with named members
  -> CoreIngressPort
```

公共合同明确声明的动态业务值可以作为具名 `RuntimeValue` 成员；整条消息不能继续携带通用 `RuntimeValue::Object`。

## 4. 当前进度

| 范围 | 完成 | 总数 | 状态 |
|---|---:|---:|---|
| Product V1 | 13 | 69 | `IN_PROGRESS` |
| M1 | 10 | 41 | `W1 IN_PROGRESS` |
| W1 | 5 | 6 | `5_OF_6 VERIFIED` |

## 5. Agent 指令

```text
继续当前 JS Runtime 对话。JS-S02 状态为 IMPLEMENTATION_CHANGES_REQUIRED；不得启动 JS-S03。

只做 typed message model 定向返修，不重写已通过的状态机、队列、correlation、teardown 和 Observation。

必须完成：
1. 删除 CoreMessage<Kind> / JsCallbackMessage<Kind> 中通用 RuntimeValue::Object fields 的消息模型。
2. 为 13 个 outbound 和 16 个 inbound message 定义具名字段的具体 C++ struct，并继续组成 closed std::variant。
3. decoder 必须把 JS RuntimeValue 字段提取到具名成员；decode 成功后 CoreIngressPort 不再按字符串查字段。
4. callback validator/consumer 同样使用具名成员，不再通过 message.fields.at(...) 读取。
5. 只有公共合同明确为动态值的叶子字段允许使用 RuntimeValue；禁止整条消息或通用 payload 使用 Object map。
6. Fake Core、callback slots 和 common ABI suite 必须直接断言具名成员与类型，不能只断言 kind 或字段表无损。
7. 加边界扫描：消息 struct 不得含通用 fields map，不得恢复 kind/payload、module/method/args 或 JSON Bridge。

保持不变：
- 14 个 Native Function 名称和数量。
- 每 AppRuntime 唯一 allocator 的非 S02 所有权。
- PendingRecord 四字段。
- 现有线程、背压、late/duplicate、销毁和资源归零语义。
- 公共合同、Schema 和 JS-S03 范围。

完成后：
1. 更新 A01-A50 映射和实现证据。
2. 重新生成 evidence/js-s02/source-manifest.sha256。
3. 重跑 Debug、Release、ASan/UBSan、TSan 5/5、API-only 与边界扫描。
4. 在 AGENT-HANDOFF.md 追加 READY_FOR_REVIEW 后停止。
```
