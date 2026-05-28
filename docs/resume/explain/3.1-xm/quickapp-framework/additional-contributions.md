# 快应用框架 — 补充大活

## 目录

- [已有大活（简历中）](#已有大活简历中)
- [补充大活 1：自动化测试体系](#补充大活-1自动化测试体系)
- [补充大活 2：渲染性能优化](#补充大活-2渲染性能优化)

---

## 已有大活（简历中）

| # | 大活 | 核心指标 |
|---|------|---------|
| 1 | 包体优化（R8 + 条件编译 + 模块裁剪） | 153MB → ~60MB，DEX -39% |
| 2 | 启动内存优化（DEX 布局优化） | PSS MAX 41MB → 35.8MB |
| 3 | JS Bridge → J2V8 同步通信改造 | 异步 → 同步，通信耗时从 ms 级降到 μs 级 |

---

## 补充大活 1：自动化测试体系

### 问题

- 快应用框架每次发版需要验证兼容性（几百个三方快应用能否正常运行）
- 人工测试覆盖不全、效率低、无法回归
- 多端（Android / HarmonyOS / iOS）验证成本 ×3

### 方案

**架构：C/S 模式**（PC 发指令 → 设备上 Agent 执行 → 返回结果）

```
PC（pytest 测试脚本）
  │ HTTP / USB
  ▼
设备上的 Agent 服务
  - Android: ATX Agent（uiautomator2 自动安装到设备）
  - iOS: WebDriverAgent（Xcode 编译安装到设备）
  - HarmonyOS: hdc shell 直接操作
```

**各端驱动库**：

| 平台 | Python 客户端 | 设备端 Agent | 通信方式 |
|------|-------------|-------------|---------|
| **Android** | `uiautomator2` | ATX Agent（自动推送安装） | USB + HTTP（adb forward） |

> **ATX = Android Test eXtension**（openatx 开源组织，国人维护）。本质是 Google 官方 UiAutomator 的 Python 封装 + HTTP 服务化。Google UiAutomator 只能在 Java 测试工程里用，ATX 把它包装成设备上的 HTTP 服务，PC 用 Python 远程调用。首次 `u2.connect()` 时自动通过 adb 推送安装 ATX Agent APK 到设备。
| **iOS** | `tidevice` + `facebook-wda` | WebDriverAgent（需 Xcode 签名安装） | USB + HTTP |
| **HarmonyOS** | 自研 driver（基于 `hdc`） | 系统内置 uitest 服务 | USB + hdc 命令 |

**统一抽象层**（一套用例三端跑）：

```python
# 抽象 driver 接口，三端实现不同，用例层不感知平台差异
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
        self.d = uiautomator2.connect()  # 连接设备上的 ATX Agent
    def click(self, selector):
        self.d(text=selector).click()

# iOS 实现
class IOSDriver(DeviceDriver):
    def __init__(self):
        self.c = wda.Client()  # 连接设备上的 WebDriverAgent
    def click(self, selector):
        self.c(name=selector).tap()

# 用例层（平台无关）
def test_app_launch(driver: DeviceDriver):
    driver.launch_app("com.example.quickapp")
    driver.click("允许")
    assert driver.screenshot() is not None
```

**测试覆盖**：

```
Python + pytest + uiautomator2（Android）/ tidevice（iOS）/ hdc（HarmonyOS）
  │
  ├── 启动测试：安装 rpk → 启动 → 检测首屏渲染完成 → 截图对比
  ├── 交互测试：滑动 → 点击 → 输入 → 验证 UI 状态
  ├── 性能采集：启动时间 / 帧率 / 内存（自动化过程中采集）
  ├── 稳定性测试：连续启动退出 100 次，检测 Crash
  └── 多机型并行：CI 触发，多台设备同时跑
```

**性能采集实现**（通过 adb 命令，在自动化测试过程中穿插采集）：

```python
import subprocess

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
    # 先重置帧数据
    subprocess.run(['adb', 'shell', 'dumpsys', 'gfxinfo', package, 'reset'])
    time.sleep(2)  # 等待采集 2 秒的帧数据
    result = subprocess.run(
        ['adb', 'shell', 'dumpsys', 'gfxinfo', package],
        capture_output=True, text=True
    )
    # 解析 Total frames rendered
    for line in result.stdout.splitlines():
        if 'Total frames rendered' in line:
            frames = int(line.split(':')[1].strip())
            return frames / 2.0  # 2 秒内的帧数 → fps
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

# 在测试用例中穿插采集
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
    fps = get_fps("com.example.quickapp")  # 滑动期间采集
    assert fps >= 55, f"帧率 {fps}fps，低于阈值"
```

### 效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 回归测试耗时 | 2 人天 | 2 小时（自动化） |
| 覆盖快应用数量 | ~20 个（人工挑选） | 200+（全量回归） |
| 兼容通过率 | 92%（发现晚） | 98%（CI 提前拦截） |
| 多端覆盖 | Android only | Android + HarmonyOS + iOS |

### 技术亮点

- 统一测试框架抽象层，三端共用一套用例，只替换 driver
- CI 集成：每次框架发版前自动跑，不通过不发布
- 性能基线：每次跑完自动对比历史数据，劣化自动告警

---

## 补充大活 2：渲染性能优化

### 问题

- 复杂页面（长列表 + 多图 + 动画）帧率低于 50fps
- 页面切换时白屏 ~400ms
- 低端机（2GB RAM）滑动明显卡顿

### 方案

| 优化点 | 手段 | 原理 |
|--------|------|------|
| **View 复用池** | 页面切换时不销毁 View，放入池中复用 | 减少 View 创建开销（类似 RecyclerView） |
| **布局层级优化** | 自动检测 + 告警超过 8 层嵌套 | 减少 measure/layout 递归深度 |
| **图片异步解码** | 大图在子线程解码，主线程只做绘制 | 避免主线程阻塞 |
| **列表预渲染** | 可视区外预创建 2~3 个 item | 滑动时直接显示，无创建延迟 |
| **动画下沉 Native** | CSS 动画编译为 Native Animator | 不经过 JS 线程，60fps 稳定 |

### 效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 复杂页面帧率 | 48~52fps | 56~60fps |
| 页面切换白屏 | ~400ms | ~150ms |
| 低端机滑动丢帧率 | 15% | 5% |
| 列表首屏渲染 | ~600ms | ~350ms |

### 技术亮点

- View 复用池：按 View 类型分池，LRU 淘汰策略
- 布局检测工具：集成到 IDE 静态检测评分中
- 动画下沉：JS 侧声明式描述 → 编译为 Native ObjectAnimator，零 Bridge 通信
