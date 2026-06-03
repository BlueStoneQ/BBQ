# 自动化性能测试体系（pytest + uiautomator2 三端）

> 问题：框架每次发版需验证几百个三方快应用兼容性，人工测试覆盖不全、效率低、无法回归
>
> 方案：C/S 架构自动化 + 统一抽象层三端共用 + 性能数据自动采集
>
> 效果：回归耗时 2 人天 → 2 小时，覆盖量 20 → 200+

---

## 目录

- [架构](#架构)
- [各端驱动](#各端驱动)
- [统一抽象层](#统一抽象层)
- [测试覆盖](#测试覆盖)
- [性能采集实现](#性能采集实现)
- [效果](#效果)

---

## 架构

**C/S 模式**：PC 发指令 → 设备上 Agent 执行 → 返回结果

```
PC（pytest 测试脚本）
  │ HTTP / USB
  ▼
设备上的 Agent 服务
  - Android: ATX Agent（uiautomator2 自动安装到设备）
  - iOS: WebDriverAgent（Xcode 编译安装到设备）
  - HarmonyOS: hdc shell 直接操作
```

---

## 各端驱动

| 平台 | Python 客户端 | 设备端 Agent | 通信方式 |
|------|-------------|-------------|---------|
| **Android** | `uiautomator2` | ATX Agent（自动推送安装） | USB + HTTP（adb forward） |
| **iOS** | `tidevice` + `facebook-wda` | WebDriverAgent（需 Xcode 签名安装） | USB + HTTP |
| **HarmonyOS** | 自研 driver（基于 `hdc`） | 系统内置 uitest 服务 | USB + hdc 命令 |

> **ATX = Android Test eXtension**（openatx 开源组织）。本质是 Google UiAutomator 的 Python 封装 + HTTP 服务化。首次 `u2.connect()` 时自动通过 adb 推送安装 ATX Agent APK 到设备。

### ATX 是平台无关的吗？

**不是。ATX / uiautomator2 只支持 Android。** iOS 和 HarmonyOS 需要各自的方案：

| 平台 | 驱动方案 | 底层原理 | Python 客户端 |
|------|---------|---------|--------------|
| **Android** | ATX Agent（uiautomator2） | Google UiAutomator → AccessibilityService 获取 UI 树 | `pip install uiautomator2` |
| **iOS** | WebDriverAgent（WDA） | Apple XCTest 框架 → Accessibility API 获取 UI 树 | `pip install facebook-wda` + `pip install tidevice` |
| **HarmonyOS** | 系统内置 uitest | hdc shell uitest 命令 | 自研 driver（封装 hdc） |

三者原理相同（通过系统无障碍服务读取 UI 树 + 模拟触摸），但各平台 API 不同，所以才需要统一抽象层。

### iOS 怎么做

```bash
# 1. 安装 Python 客户端
pip install facebook-wda tidevice

# 2. 在 iOS 设备上安装 WebDriverAgent（需要 Mac + Xcode + 开发者证书）
#    WDA 是 Facebook 开源的 iOS 自动化 Agent，基于 Apple 的 XCTest 框架
tidevice wdaproxy -B com.facebook.WebDriverAgentRunner

# 3. Python 侧使用
import wda
c = wda.Client()              # 连接设备上的 WDA
c(name="允许").tap()           # 按 accessibility label 点击
c.swipe_up()                  # 滑动
c.screenshot("screen.png")    # 截图
```

**iOS 比 Android 麻烦的地方**：WDA 需要 Xcode 签名编译安装到设备（Apple 安全限制），不像 Android 的 ATX Agent 通过 adb 自动推送就行。

### 这种测试叫什么

**UI 自动化测试**，属于 **E2E 测试（End-to-End，端到端测试）** 的一种。

```
测试金字塔：

        /  E2E 测试  \          ← 我们做的（通过 UI 操作验证整个系统）
       / 集成测试      \        ← 多模块配合验证
      / 单元测试（最多） \      ← 单个函数/类验证
```

| 测试类型 | 验证什么 | 速度 | 稳定性 | 代表工具 |
|---------|---------|------|--------|---------|
| 单元测试 | 单个函数逻辑 | 极快 | 高 | Jest / Vitest |
| 集成测试 | 多模块协作 | 快 | 中 | Testing Library |
| **E2E / UI 自动化** | 完整用户流程（真设备真 App） | 慢 | 低（UI 易变） | uiautomator2 / Appium / Detox |

### 是最适合 GUI 的测试方式吗？

**适合"验证用户可见行为"，但不是唯一方式，也不应该是主力**。

| 场景 | 最适合的测试方式 | 为什么 |
|------|----------------|--------|
| "按钮点击后数据正确" | 单元测试 / 集成测试 | 快、稳、易维护 |
| "页面是否能打开不白屏" | **UI 自动化** | 必须真机验证渲染结果 |
| "滑动是否流畅 60fps" | **UI 自动化 + 性能采集** | 必须真设备真操作才能测帧率 |
| "200 个三方 App 兼容性" | **UI 自动化**（批量跑） | 人工不可能覆盖 |
| "启动时间 / 内存回归" | **UI 自动化 + adb 采集** | 需要真实启动流程 |

**我们的场景（性能 + 兼容性验证）必须用 UI 自动化**——因为要在真设备上真操作，采集真实性能数据。单元测试测不出帧率和内存。

但日常业务逻辑验证不该靠 E2E（太慢、太脆弱）——应该单元测试为主，E2E 只覆盖关键路径和性能回归。

---

## 统一抽象层

一套用例三端跑，只替换 driver：

```python
class DeviceDriver(ABC):
    @abstractmethod
    def click(self, selector: str): ...
    @abstractmethod
    def swipe(self, direction: str): ...
    @abstractmethod
    def screenshot(self) -> bytes: ...
    @abstractmethod
    def launch_app(self, package: str): ...

# Android 实现
class AndroidDriver(DeviceDriver):
    def __init__(self):
        self.d = uiautomator2.connect()
    def click(self, selector):
        self.d(text=selector).click()

# iOS 实现
class IOSDriver(DeviceDriver):
    def __init__(self):
        self.c = wda.Client()
    def click(self, selector):
        self.c(name=selector).tap()

# 用例层（平台无关）
def test_app_launch(driver: DeviceDriver):
    driver.launch_app("com.example.quickapp")
    driver.click("允许")
    assert driver.screenshot() is not None
```

---

## 测试覆盖

```
pytest + uiautomator2（Android）/ tidevice（iOS）/ hdc（HarmonyOS）
  │
  ├── 启动测试：安装 rpk → 启动 → 检测首屏渲染完成 → 截图对比
  ├── 交互测试：滑动 → 点击 → 输入 → 验证 UI 状态
  ├── 性能采集：启动时间 / 帧率 / 内存（自动化过程中采集）
  ├── 稳定性测试：连续启动退出 100 次，检测 Crash
  └── 多机型并行：CI 触发，多台设备同时跑
```

---

## 性能采集实现

通过 adb 命令，在自动化测试过程中穿插采集：

```python
import subprocess
import time

def get_memory_pss(package: str) -> int:
    """通过 adb dumpsys meminfo 获取 PSS（单位 KB）"""
    result = subprocess.run(
        ['adb', 'shell', 'dumpsys', 'meminfo', package],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        if 'TOTAL' in line and 'PSS' not in line:
            return int(line.split()[1])
    return 0

def get_fps(package: str) -> float:
    """通过 adb dumpsys gfxinfo 获取平均帧率"""
    subprocess.run(['adb', 'shell', 'dumpsys', 'gfxinfo', package, 'reset'])
    time.sleep(2)
    result = subprocess.run(
        ['adb', 'shell', 'dumpsys', 'gfxinfo', package],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        if 'Total frames rendered' in line:
            frames = int(line.split(':')[1].strip())
            return frames / 2.0
    return 0

def get_startup_time(package: str, activity: str) -> int:
    """通过 adb am start -W 获取冷启动时间（ms）"""
    subprocess.run(['adb', 'shell', 'am', 'force-stop', package])
    result = subprocess.run(
        ['adb', 'shell', 'am', 'start', '-W', f'{package}/{activity}'],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        if 'TotalTime' in line:
            return int(line.split(':')[1].strip())
    return 0
```

**在测试用例中穿插**：

```python
def test_memory_stability(driver):
    driver.launch_app("com.example.quickapp")
    mem_start = get_memory_pss("com.example.quickapp")

    for _ in range(10):
        driver.swipe("up")
        time.sleep(0.5)

    mem_end = get_memory_pss("com.example.quickapp")
    growth = mem_end - mem_start
    assert growth < 20_000, f"内存增长 {growth}KB，疑似泄漏"

def test_scroll_fps(driver):
    driver.launch_app("com.example.quickapp")
    fps = get_fps("com.example.quickapp")
    assert fps >= 55, f"帧率 {fps}fps，低于阈值"
```

---

## 效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 回归测试耗时 | 2 人天 | 2 小时（自动化） |
| 覆盖快应用数量 | ~20 个（人工挑选） | 200+（全量回归） |
| 兼容通过率 | 92%（发现晚） | 98%（CI 提前拦截） |
| 多端覆盖 | Android only | Android + HarmonyOS + iOS |

---

## 技术亮点

- 统一测试框架抽象层，三端共用一套用例，只替换 driver
- CI 集成：每次框架发版前自动跑，不通过不发布
- 性能基线：每次跑完自动对比历史数据，劣化自动告警
