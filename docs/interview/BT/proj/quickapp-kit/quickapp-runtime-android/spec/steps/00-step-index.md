# QuickApp Runtime Android - 步骤索引

## 概述
本文档提供 quickapp-runtime-android 项目所有实现步骤的快速导航入口。每个步骤包含第一性描述和核心动作，点击标题可跳转到详细步骤文档。

---

## 📋 目录
- [概述](#概述)
- [📋 步骤索引](#-步骤索引)
  - [Step 01: Android NDK 基础骨架](#step-01-android-ndk-基础骨架)
  - [Step 02: 平台桥接与 JNI 交互](#step-02-平台桥接与-jni-交互)
  - [Step 03: JavaScript 引擎集成](#step-03-javascript-引擎集成)
  - [Step 04: 事件循环与线程模型](#step-04-事件循环与线程模型)
  - [Step 05: JS Bridge 与模块扩展](#step-05-js-bridge-与模块扩展)
  - [Step 06: RPK 包加载与解析](#step-06-rpk-包加载与解析)
  - [Step 07: JS Framework 与 VM 模型](#step-07-js-framework-与-vm-模型)
  - [Step 08: 页面 Bundle 加载与启动](#step-08-页面-bundle-加载与启动)
  - [Step 09: 虚拟节点与样式解析](#step-09-虚拟节点与样式解析)
  - [Step 10: Yoga 布局计算](#step-10-yoga-布局计算)
  - [Step 11: Android 视图渲染器](#step-11-android-视图渲染器)
  - [Step 12: 完整渲染管线与事件](#step-12-完整渲染管线与事件)
  - [Step 13: 路由导航与交互组件](#step-13-路由导航与交互组件)
- [🚀 快速开始](#-快速开始)
- [🔧 技术栈概览](#-技术栈概览)

---

## 📋 步骤索引

### [Step 01: Android NDK 基础骨架](./01-android-ndk-skeleton.md)
**第一性描述**: 建立 Android NDK 项目基础结构，为后续 Native 扩展提供宿主环境  
**核心动作**:
- 创建 Android Studio NDK 项目
- 配置 CMake 构建系统
- 实现 Core 与平台层分离架构

### [Step 02: 平台桥接与 JNI 交互](./02-platform-bridge-jni.md)
**第一性描述**: 打通 C++ Core 与 Java Android 平台的 JNI 通信通道  
**核心动作**:
- 定义 PlatformBridge Core 接口
- 实现 Android JNI Bridge
- 建立双向通信的最小闭环

### [Step 03: JavaScript 引擎集成](./03-jsengine-quickjs.md)
**第一性描述**: 集成 QuickJS 引擎，提供 JavaScript 执行环境  
**核心动作**:
- 定义 JSEngine 抽象接口
- 集成 QuickJS 源码到构建系统
- 实现 Native 函数注册和调用机制

### [Step 04: 事件循环与线程模型](./04-eventloop-thread.md)
**第一性描述**: 建立异步事件处理机制和多线程调度框架  
**核心动作**:
- 定义 RuntimeEventLoop 接口
- 集成 libuv 事件循环库
- 实现 RuntimeThread 封装和调度

### [Step 05: JS Bridge 与模块扩展](./05-js-bridge.md)
**第一性描述**: 提供 JavaScript 调用 Native 功能的桥接机制  
**核心动作**:
- 实现 NativeModule 注册框架
- 注入宿主全局函数
- 实现 Router、Prompt 等基础模块

### [Step 06: RPK 包加载与解析](./06-rpk-manifest.md)
**第一性描述**: 加载和解析快应用打包格式(RPK)及其配置文件  
**核心动作**:
- 集成 minizip 解压库
- 实现 RPKLoader 包加载器
- 解析 Manifest 配置文件

### [Step 07: JS Framework 与 VM 模型](./07-js-framework-vm.md)
**第一性描述**: 实现快应用框架的 JavaScript 运行时环境  
**核心动作**:
- 实现 framework.js 核心库
- C++ 侧加载和执行框架代码
- 建立 VM 生命周期管理

### [Step 08: 页面 Bundle 加载与启动](./08-page-bundle-load.md)
**第一性描述**: 加载和执行快应用页面 JavaScript 代码包  
**核心动作**:
- 实现 Runtime 启动完整序列
- 执行 app.js 应用入口
- 加载和 eval 页面 bundle

### [Step 09: 虚拟节点与样式解析](./09-vnode-style.md)
**第一性描述**: 将 JSX 模板转换为 C++ 虚拟节点并解析样式  
**核心动作**:
- 定义 VNode 数据结构
- JS template → C++ VNode 转换
- 实现样式解析器

### [Step 10: Yoga 布局计算](./10-yoga-layout.md)
**第一性描述**: 使用 Yoga 布局引擎计算组件位置和大小  
**核心动作**:
- 集成 Yoga 布局库
- VNode → YGNode 映射转换
- 布局计算和结果回填

### [Step 11: Android 视图渲染器](./11-view-renderer.md)
**第一性描述**: 将布局计算结果渲染到 Android 原生视图  
**核心动作**:
- 实现 ViewRenderer Kotlin 类
- 节点类型和样式映射
- TitleBar 渲染和事件监听

### [Step 12: 完整渲染管线与事件](./12-render-pipeline-events.md)
**第一性描述**: 建立从事件触发到界面更新的完整渲染流程  
**核心动作**:
- 串通完整渲染链路
- Android → C++ 事件通道
- JS VM 方法调用机制

### [Step 13: 路由导航与交互组件](./13-router-prompt-titlebar.md)
**第一性描述**: 实现页面导航、提示和标题栏等用户交互功能  
**核心动作**:
- C++ Router 页面导航
- Prompt Toast 提示实现
- TitleBar 动态更新

---

## 🚀 快速开始

1. **新手入门**: 建议从 [Step 01](./01-android-ndk-skeleton.md) 开始，按顺序实现
2. **核心功能**: 重点关注 02(JNI)、03(JS引擎)、05(JS Bridge)、11(渲染)
3. **测试验证**: 每个步骤都包含验证方法，确保实现正确性

## 🔧 技术栈概览
- **语言**: C++17、Kotlin、JavaScript
- **工具链**: Android Studio、CMake、NDK
- **核心库**: QuickJS、libuv、Yoga、minizip
- **平台**: Android 原生视图系统

---

*最后更新: 2026-08-05*  
*文档维护: quickapp-runtime-android 项目组*