# Android 性能自动化测试方案

> 骨架 → 支干 → 血肉。第一性原理理解本质。

## 一、本质：解决什么问题

**怎么自动化、可重复、大规模地测量移动设备上 App 的性能指标？**

手动测试的问题：
- 人工操作不可重复（每次滑动速度/力度不同）
- 覆盖面有限（100+ App × 多设备 × 多场景，人力不够）
- 数据不精确（人眼判断帧率/卡顿不可靠）

解决方案：**用 Python + pytest 驱动设备自动化操作，用外部采集卡 + Perfetto trace 精确测量性能数据。**

### 核心原理：为什么电脑上跑 Python 能操作手机？

**因为手机上有一个"Agent 服务端"在等命令。**

```
电脑（Python 脚本）              USB/WiFi              手机
───────────────────              ────────              ──────
Python 测试脚本
    ↓
uiautomator2 库
    ↓
ADB 命令 + 端口转发              ──────►              adbd 守护进程
                                                         ↓
                                                     uiautomator2-server（APK）
                                                         ↓
                                                     Android UiAutomation 框架
                                                         ↓
                                                     操作 UI（点击/滑动/读取元素）
```

**三平台通信原理一样：电脑发命令 → 通信通道 → 手机 Agent → 系统 UI 框架执行。**

| 平台 | 通信通道 | 手机端 Agent | 操作框架 |
|------|---------|-------------|---------|
| Android | ADB | uiautomator2-server APK | UiAutomation |
| HarmonyOS | HDC（华为的 ADB） | TDK Agent | Accessibility |
| iOS | tidevice | WebDriverAgent（WDA） | XCUITest |

**Python 的角色 = 编排层**：定义测试流程（打开 App → 等待 → 滑动 → 采集数据 → 分析），通过 ADB + Agent 间接操作手机。选 Python 因为：测试脚本不需要高性能，需要快速编写 + pytest 生态 + 数据分析库丰富。

---

## 二、骨架：系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    测试入口（main.py）                     │
│  本地执行 / MiATP 远程执行                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Framework   │  │   Service    │  │   RunParam    │  │
│  │  动态加载中枢 │  │  生命周期编排  │  │  配置状态管理  │  │
│  │  (单例)      │  │  (单例)      │  │  (单例)       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│  ┌──────┴─────────────────┴──────────────────────────┐  │
│  │              核心子系统                              │  │
│  │                                                    │  │
│  │  Model（22+ 测试模型）                              │  │
│  │    启动测试 / 滑动测试 / 点击测试 / 复合场景 / 视频    │  │
│  │                                                    │  │
│  │  Controller（设备控制）                              │  │
│  │    App 控制器 / UI 操作库 / 相机 / Perfetto          │  │
│  │                                                    │  │
│  │  View（UI 元素定位）                                │  │
│  │    Android / HarmonyOS / iOS                       │  │
│  │                                                    │  │
│  │  ExTools（分析工具）                                │  │
│  │    Perfetto 解析 / 内存工具 / 帧分析 / 进程老化       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │              基础设施                                │  │
│  │  ADB/HDC/iOS 命令 / 飞书集成 / FDS 存储 / DB / 日志  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    硬件层                                 │
│  Android 设备（ADB）/ HarmonyOS（HDC）/ iOS（tidevice）  │
│  大恒采集卡（外部相机精确采集帧数据）                       │
└─────────────────────────────────────────────────────────┘
```

---

## 三、核心设计

### 3.1 三平台覆盖

| 平台 | 通信方式 | UI 自动化 | 设备品牌 |
|------|---------|----------|---------|
| Android | ADB | uiautomator2 | 小米/三星/OPPO/vivo/一加/联想/realme |
| HarmonyOS | HDC | TDK | 华为/荣耀 |
| iOS | tidevice/TDK | TDK | Apple |

### 3.2 动态加载机制（核心模式）

框架不硬编码任何控制器/模型/视图，全部运行时动态解析：

```python
# 解析链路：产品专属 → 厂商基类 → 平台基类
Framework.dynamic_loading_app_ctrl()   # 加载 App 控制器
Framework.dynamic_loading_model()      # 加载测试模型
Framework.dynamic_ui_ctrl()            # 加载 UI 控制器
Framework.dynamic_loading_view()       # 加载视图定位器
```

根据 `DeviceType().phone_device_type` + `phone_manufacturer` + `phone_product` 自动选择最匹配的实现。

### 3.3 测试场景类型

| 场景 | 测量什么 | 目录 |
|------|---------|------|
| start_scene | App 冷启动/热启动耗时 | `case/start_scene/` |
| swipe_scene | 滑动流畅度（帧率/丢帧） | `case/swipe_scene/` |
| click_scene | 点击响应速度 | `case/click_scene/` |
| dynamic_scene | 动态性能（综合操作） | `case/dynamic_scene/` |
| composite_scene | 复合场景（多步骤组合） | `case/composite_scene/` |
| video_scene | 视频播放性能 | `case/video_scene/` |
| stop_scene | 退出/回收 | `case/stop_scene/` |

### 3.4 性能采集方式

| 方式 | 原理 | 精度 | 适用 |
|------|------|------|------|
| **大恒采集卡** | 外部相机拍摄设备屏幕，逐帧分析 | 极高（硬件级） | 帧率/启动时间/响应延迟 |
| **Perfetto trace** | 系统级 trace 采集（CPU/GPU/内存/调度） | 高 | 系统级性能分析 |
| **ADB dumpsys** | 读取系统服务数据 | 中 | 内存/进程信息 |

### 3.5 pytest 生命周期

```
session  → Service.before_test_session()    # 设备初始化、相机校准
class    → Model.model_before_test_round()  # 测试轮次准备
function → Model.model_before_test_function() # 单次测试准备
[测试执行]                                    # 操作设备 + 采集数据
function teardown → Model.model_after_test_function()  # 数据收集
class teardown    → Model.model_after_test_round()     # 轮次汇总
session teardown  → Service.after_test_session()       # 报告生成、资源释放
```

### 3.6 配置驱动（飞书表格）

测试配置不在本地 YAML，而是由**飞书表格驱动**：
- `run_test_config.yml` 映射模型名到飞书表格 URL
- `FeiShuDocUtil` 运行时拉取配置
- 测试执行顺序通过 `pytest_collection_modifyitems` hook 由飞书配置控制

好处：非开发人员（测试/产品）可以直接在飞书表格里配置测试计划，不需要改代码。

---

## 四、技术栈

| 层 | 技术 |
|---|------|
| 语言 | Python 3.10 |
| 测试框架 | pytest + allure |
| UI 自动化 | uiautomator2（Android）、TDK（鸿蒙/iOS） |
| 性能采集 | Perfetto、大恒采集卡 SDK、OpenCV |
| 图像识别 | OpenCV + rapidocr_onnxruntime（OCR） |
| 远程执行 | Pyro5（MiATP 远程调用） |
| 存储 | galaxy-fds-sdk（小米 FDS）、SQLite |
| 报告 | allure + Excel |
| CI | GitLab CI + tox |

---

## 五、能力延伸：云测平台方向

基于对这套自动化测试框架的理解，可以进一步设计：

### 设备注册可插拔的云测平台

```
┌─────────────────────────────────────────────────────────┐
│                    Web 管理端                             │
│  设备管理 / 任务调度 / 测试报告 / 实时监控                  │
├─────────────────────────────────────────────────────────┤
│                    调度引擎                               │
│  任务队列 / 设备匹配 / 并发控制 / 结果收集                  │
├─────────────────────────────────────────────────────────┤
│                    设备注册层（可插拔）                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 物理设备   │  │ 虚拟机    │  │ 云端设备   │             │
│  │ USB 连接   │  │ Android  │  │ 远程 ADB  │             │
│  │ ADB/HDC   │  │ Emulator │  │ STF/OpenSTF│             │
│  └──────────┘  └──────────┘  └──────────┘             │
├─────────────────────────────────────────────────────────┤
│                    测试执行引擎                           │
│  pytest + 动态加载 + Perfetto + 采集卡（可选）            │
└─────────────────────────────────────────────────────────┘
```

核心设计：
- **设备注册可插拔**：物理设备/虚拟机/远程设备统一抽象为 Device 接口，新增设备类型只需实现接口
- **任务调度**：按设备能力（品牌/系统版本/分辨率）匹配测试任务
- **并发执行**：多设备并行跑不同测试用例
- **结果聚合**：统一报告 + 趋势对比 + 告警

这是从"单机跑测试"到"平台化服务"的升级——DJI 如果要做多设备（无人机/相机/手机）的自动化测试，需要的就是这种平台。

---

## 六、面试价值

| 维度 | 体现 |
|------|------|
| 自动化测试能力 | 理解 pytest 生命周期 + 设备自动化 |
| 性能测试方法论 | 知道怎么精确测量 App 性能（不是手动看） |
| 多平台覆盖 | Android/HarmonyOS/iOS 三端 |
| 工程化思维 | 配置驱动 + 动态加载 + CI 集成 |
