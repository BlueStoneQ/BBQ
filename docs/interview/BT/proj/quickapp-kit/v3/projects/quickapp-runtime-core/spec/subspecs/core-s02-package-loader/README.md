# CORE-S02 Package Loader

## 目录

- [1. 结论](#1-结论)
- [2. 范围](#2-范围)
- [3. 边界](#3-边界)
- [4. 交付物](#4-交付物)
- [5. 状态](#5-状态)

## 1. 结论

CORE-S02 把不可信 RPK 字节转换为可信、不可变、可按 ID 查询的 Runtime 输入。它只负责读取、解包、校验、索引和缓存，不执行 Bundle，也不创建或拥有 Runtime Tree。

Loader 的唯一成功产物是 `VerifiedPackage`；页面通过被 pin 的 `PageIrHandle` 交付，模块通过已校验的 `VerifiedModule` 交付。下游不能绕过这三个对象读取 ZIP、JSON 或路径。

## 2. 范围

本分 Spec 包含：

- `PackageSource` 异步随机读合同与 Package Session 生命周期。
- ZIP 索引、路径规范化、成员和解压资源限制。
- Manifest、Runtime Metadata、Page IR Schema 及跨文件关系校验。
- Runtime Composition 预检。
- `VerifiedPackage`、`PageIrHandle`、`VerifiedModule` 的不可变交付。
- Page IR 有界缓存、pin、unpin 和 eviction。
- Package/Module 关键阶段观测、错误映射、Fake Source 和恶意包夹具。

本分 Spec 不包含：

- Bundle 执行、模块 ABI 启动或业务生命周期。
- Runtime Tree、Block 实例、Render、Layout、Mount 或 Event。
- 签名校验、联盟 RPK/RPKS 兼容转换。
- 平台文件、流、句柄或具体执行引擎类型。

## 3. 边界

```text
Host-owned PackageSource
  -> PackageLoader
  -> VerifiedPackage
       -> PageIrHandle        -> CORE-S05
       -> VerifiedModule      -> CORE-S03/JS Port
```

- S02 拥有包验证状态和缓存，不拥有任何 Surface 或 Runtime Node。
- S05 只消费 `PageIrHandle`，不反向调用 Loader 的解析接口。
- 连接对象只包含公共 ID、Schema 的 typed representation 和不可变字节。

## 4. 交付物

| 文件 | 作用 |
|---|---|
| [requirements.md](./requirements.md) | 冻结 Loader 功能、限制和质量要求 |
| [design.md](./design.md) | 冻结接口、状态机、缓存、线程和错误设计 |
| [tasks.md](./tasks.md) | 实现顺序与完成定义 |
| [acceptance.md](./acceptance.md) | 正例、攻击面、故障和资源验收 |

## 5. 状态

`READY_FOR_REVIEW + CODE_BLOCKED`。必须通过独立分 Spec 校审并由工作看板显式放行后才能实现。
