# W2 实现验收

## 目录

- [1. 结论](#1-结论)
- [2. 验收结果](#2-验收结果)
- [3. 唯一待修项](#3-唯一待修项)
- [4. 下一步](#4-下一步)

## 1. 结论

**TK-S04、LV-S03、LV-S06 已验证完成。CORE-S03 功能与并发验证通过，但全局源码清单未刷新，暂不计入完成；CORE-S04 设计通过，待该证据修复后开始编码。**

本轮没有发现公共合同、线程所有权或平台边界偏离。

## 2. 验收结果

| 分 Spec | 状态 | 本机复核证据 |
|---|---|---|
| TK-S04 | `VERIFIED` | `npm test` 71/71；CLI 17/17；Case 001/002、确定性、取消、深不可变通过 |
| LV-S03 | `VERIFIED` | Debug、Release、ASan/UBSan、TSan 各 10/10；embedded-only 7/7；压力和边界扫描通过 |
| LV-S06 | `VERIFIED` | Debug、Release、ASan/UBSan、TSan 各 10/10；embedded-only 7/7；压力和边界扫描通过 |
| CORE-S03 | `EVIDENCE_CORRECTION_REQUIRED` | Release、ASan/UBSan、TSan 各 10/10；但全局 source manifest 与当前 CMakeLists 不一致 |
| CORE-S04 | `PASS + CODE_ALLOWED_AFTER_EVIDENCE` | Revision 规则已同步并消费公共合同；等待 CORE-S03 evidence 修复 |

## 3. 唯一待修项

`quickapp-runtime-core/evidence/source-manifest.sha256` 中的 `CMakeLists.txt` 仍为旧 SHA-256，当前文件与 CORE-S03 证据中的 SHA-256 一致。

修复必须重新生成完整 manifest，纳入 CORE-S03 新增源码、测试和边界扫描文件，再执行：

```text
shasum -a 256 -c evidence/source-manifest.sha256
```

这只是证据可追溯性修复，不改变产品代码、公共合同或架构决策。

## 4. 下一步

完整可复制指令见 [当前 Agent 指令](./2026-08-18-current-agent-instructions.md)。

1. Core Agent 刷新 CORE-S03 source manifest 并提交通过结果；随后实现 CORE-S04。
2. JS Agent 实现 JS-S03；JS-S04 继续等待 JS-S03 实现通过。
3. Toolkit Agent 开始 TK-S05/TK-S06 分 Spec设计，不编码。
4. LVGL Agent 开始 LV-S04 分 Spec设计，不编码。
5. 不启动 W3 产品代码，不启动 JS-S04、LV-S05/LV-S07 或 CORE-S06。
