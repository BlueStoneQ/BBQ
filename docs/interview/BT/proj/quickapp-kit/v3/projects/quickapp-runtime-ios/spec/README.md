# iOS Runtime Spec

## 目录

- [1. 目标](#1-目标)
- [2. 总 Spec](#2-总-spec)
- [3. 状态](#3-状态)

## 1. 目标

定义 iOS Runtime Host、PackageSource、UIKit Platform Surface/Host Adapter、prompt/device PlatformProvider、字体 Measure Adapter、页面生命周期、输入转换和主线程提交；复用共享 Core 与 JS Runtime。UIKit 类型不得进入 Core。

## 2. 总 Spec

- [需求](./requirements.md)
- [总体架构](./architecture.md)
- [分 Spec 索引](./subspec-index.md)
- [验收](./acceptance.md)

## 3. 状态

第五次定向复核 `PASS`；当前 `DESIGN_ALLOWED + CODE_BLOCKED`，允许设计 IOS-S01。
