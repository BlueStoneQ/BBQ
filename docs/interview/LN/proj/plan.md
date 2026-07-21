# 开源项目规划

## 目录

- [核心思路](#核心思路)
- [项目总览](#项目总览)
- [统一架构模型：双端三层](#统一架构模型双端三层)
- [项目 1：CardFlow（DAG + 卡片渲染）](#项目-1cardflowdag--卡片渲染)
- [项目 2：Prism（3D Plugin）](#项目-2prism3d-plugin)
- [项目 3：Xflutter](#项目-3xflutter)
- [项目 4：Pulse（IoT BLE）](#项目-4pulseiot-ble)
- [实施顺序](#实施顺序)
- [每个项目的标准产出](#每个项目的标准产出)

---

## 核心思路

通过项目驱动，吃透技术的同时建立完整的跨端能力模型。

```
1. DAG + 卡片渲染: LVGL卡 + flutter card
- cli + ai skills
- DAG编排端APP: flutter + 预览组件:可能涉及双端三层 + AIchat生成:接入qwen小模型
- 渲染端APP:提供service + AAR/IOS: framework
- 渲染端:
  - 手机端: flutter-pkg
  - 手表等小屏: C++ yoga LVGL卡
2. 3D flutter + RN plugin, 双端三层
- 优先flutter plugin
3. Xflutter: 双端三层
4. IOT 蓝牙 flutter + RN, 双端三层
- 买蓝牙开发板: esp32S3 + 一个显示屏:作为受限设备渲染东西
  - 录制小屏渲染
```

---

## 项目总览

| # | 项目 | 定位 | 核心技术 | 产出形态 |
|---|------|------|----------|----------|
| 1 | CardFlow | 跨端卡片编排与多端渲染 | Flutter, C++, Yoga, LVGL, AI | CLI + App + Plugin + AAR/Framework + 嵌入式渲染 |
| 2 | Prism | 跨端 3D 渲染能力封装 | Flutter Plugin, RN Plugin, 原生 3D SDK | Flutter/RN Plugin + Demo App |
| 3 | Xflutter | 跨端基础设施框架 | Flutter, 双端三层架构 | 框架 + 文档 + 示例工程 |
| 4 | Pulse | 跨端蓝牙通信与受限设备渲染 | Flutter, BLE, ESP32-S3, LVGL | App + 硬件 Demo + 录屏 |

---

## 统一架构模型：双端三层

四个项目共享同一套分层思路：

```
┌─────────────────────────────┐
│  第一层：跨端业务层           │  Flutter / RN / CLI / App UI
├─────────────────────────────┤
│  第二层：跨端适配层           │  Flutter Plugin / RN Plugin / MethodChannel / FFI / Bridge
├─────────────────────────────┤
│  第三层：原生与底层实现层     │  Android / iOS / C++ / SDK / BLE / LVGL / 3D Engine
└─────────────────────────────┘
```

| 项目 | 第一层 | 第二层 | 第三层 |
|------|--------|--------|--------|
| CardFlow | Flutter 编排端 App | Flutter Plugin | AAR, Framework, C++, LVGL |
| Prism | Flutter/RN App | Flutter/RN Plugin | Android/iOS 3D SDK |
| Xflutter | Flutter/RN API | 统一跨端 Bridge | Android/iOS/C++ Core |
| Pulse | Flutter/RN App | BLE Plugin | CoreBluetooth, Android BLE, ESP32, LVGL |

---

## 项目 1：CardFlow（DAG + 卡片渲染）

### 子项目构成

| 子项目 | 说明 | 技术栈 |
|--------|------|--------|
| CLI 工具 | 项目脚手架、卡片模板生成、构建工具 | Dart CLI / Node CLI |
| AI Skills | AI 生成 DAG 配置、卡片描述 | Qwen 小模型接入、流式响应 |
| DAG 编排端 App | 可视化编排 DAG、卡片预览、AI Chat 交互 | Flutter, Riverpod, 路由 |
| 卡片预览组件 | 渲染卡片描述为 Widget | Flutter 自定义渲染、布局算法 |
| Flutter Plugin | 提供原生渲染能力给 Dart 层 | Platform Channel, Texture/PlatformView |
| Android 渲染 SDK | 卡片渲染 AAR 封装 | Kotlin, Android View |
| iOS 渲染 SDK | 卡片渲染 Framework 封装 | Swift, UIKit |
| C++ 渲染核心 | 跨平台布局 + 绘制 | C++, Yoga 布局引擎 |
| LVGL 小屏渲染 | 在手表等受限设备上渲染卡片 | C, LVGL, ESP32/嵌入式平台 |

### 数据流

```
卡片 DSL / JSON 描述
    ↓
DAG 编排（App 或 CLI）
    ↓
Flutter 预览（App 内）
    ↓
Plugin 调用原生渲染
    ↓
Android AAR / iOS Framework
    ↓
C++ 核心（Yoga 布局 + 绘制）
    ↓
LVGL 小屏设备渲染
```

---

## 项目 2：Prism（3D Plugin）

### 子项目构成

| 子项目 | 说明 | 技术栈 |
|--------|------|--------|
| Flutter 3D Plugin | 封装原生 3D 渲染为 Flutter Widget | Flutter Plugin, PlatformView/Texture |
| Android 3D 实现 | Android 端 3D 模型加载与渲染 | Kotlin, OpenGL ES / Filament |
| iOS 3D 实现 | iOS 端 3D 模型加载与渲染 | Swift, Metal / SceneKit |
| RN 3D Plugin | 复用原生核心，封装 RN 组件 | React Native Native Module |
| Demo App | 展示 3D 模型加载、手势交互、动画 | Flutter / RN |

### 实施策略

```
阶段1: Flutter Plugin + 原生 3D View
    ↓
阶段2: 模型加载 + 手势交互
    ↓
阶段3: RN Plugin（复用同一套原生核心）
```

---

## 项目 3：Xflutter

### 子项目构成

| 子项目 | 说明 | 技术栈 |
|--------|------|--------|
| 跨端 API 层 | 统一的 Dart/JS API 接口定义 | Dart, TypeScript |
| Plugin/Bridge 层 | 跨端通信协议与适配 | MethodChannel, FFI, EventChannel |
| Android 实现层 | Android 原生能力封装 | Kotlin |
| iOS 实现层 | iOS 原生能力封装 | Swift |
| C++ 共享核心 | 跨平台公共逻辑 | C++, CMake |
| 示例工程 | 集成演示 | Flutter App + RN App |
| 文档与发布 | API 文档、版本管理、发布流程 | pub.dev / npm |

### 定位

从项目 1、2、4 中沉淀出的共性能力：
- 插件接口设计规范
- 跨端协议定义
- Android/iOS 差异屏蔽
- 原生模块复用模式
- SDK 版本管理与发布
- 测试与兼容性策略

---

## 项目 4：Pulse（IoT BLE）

### 子项目构成

| 子项目 | 说明 | 技术栈 |
|--------|------|--------|
| Flutter BLE App | 扫描、连接、读写、通知管理 | Flutter, flutter_blue_plus / 自研 Plugin |
| BLE 状态管理 | 设备连接状态机、重连策略 | Riverpod, 状态机模式 |
| 通信协议 | App ↔ 设备的二进制协议定义 | 自定义协议、编解码 |
| Android BLE 实现 | Android 端蓝牙适配 | Kotlin, Android BLE API |
| iOS BLE 实现 | iOS 端蓝牙适配 | Swift, CoreBluetooth |
| ESP32-S3 固件 | 设备端 GATT Server、指令处理 | C, ESP-IDF |
| LVGL 小屏渲染 | 设备端 UI 渲染 | C, LVGL |
| RN BLE Plugin | 复用原生 BLE 核心 | React Native Native Module |

### 硬件清单

- ESP32-S3 开发板
- SPI/I2C 显示屏（用于 LVGL 渲染演示）

### 数据流

```
Flutter App
    ↓ BLE 扫描 + 连接
ESP32-S3 (GATT Server)
    ↓ 接收指令
解析协议
    ↓
更新状态 / 渲染内容
    ↓
LVGL → 显示屏输出
```

### 产出

- 完整 App（扫描 → 连接 → 控制设备）
- 通信协议文档
- 设备端固件
- 小屏渲染录屏（作为项目演示）

---

## 实施顺序

```
阶段0: Flutter 基础（case1 练习项目）
    ↓
阶段1: IoT BLE 最小闭环（扫描 → 连接 → 读写）
    ↓
阶段2: DAG + 卡片渲染主项目（逐步展开）
    ↓
阶段3: 3D Flutter Plugin
    ↓
阶段4: Xflutter 抽象沉淀
```

---

## 每个项目的标准产出

- README（项目说明 + 架构图）
- 目录结构文档
- 核心技术难点记录
- 关键代码注释
- 性能数据
- 异常处理方案
- 测试记录
- Demo 视频 / 录屏
- 问题复盘
