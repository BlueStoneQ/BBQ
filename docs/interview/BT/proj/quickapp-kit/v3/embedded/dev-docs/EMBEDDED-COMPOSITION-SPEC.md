# 嵌入式运行时装配层 — 轻量设计说明 (Spec v0.1)

> 目标: 在 ESP32-S3 真机上跑起来一个 QuickApp RPK (首个: sport-watch),
> 用于演示录制。这是一份**轻量 spec**, 只约束结构与内存策略, 不追求完备。

---

## 1. 背景与问题

当前 `device_composition.cpp` 是从桌面模拟器 `case001_lvgl.cpp` 直接照搬来的:

- 是一个 **~800 行的单函数** `device_runtime_main()`
- 编译器实测栈帧 **102 KB** (`-fstack-usage` 测得)
- ESP32-S3 内部 RAM 最大连续块仅 **128 KB**, 任务一进入即爆栈 → 白屏
- 里面还夹带大量 sport-watch 用不到的东西: showcase 分支
  (gallery/controls/binding/case002/block001/s4back)、无头测试断言、
  命令行解析残留、调试 fprintf

**结论**: 不在照搬代码上打"栈改堆"补丁(易错、留死代码), 而是**重写一个
干净的、符合嵌入式约束的装配层**。

> 注: 这是**照搬 simulator 的问题**, 不是 core/js/lvgl 子项目的架构问题。
> 修复只在本 embedded 工程内进行, **不改任何其它子项目**。

---

## 2. 目标与边界

**做:**
- 真机跑通单个 RPK 的完整链路: 加载 → 校验 → 建运行时 → 挂载首页 → 渲染 → 触摸交互
- 先只保证 sport-watch (entry=/pages/Home, showcase/push 导航) 这一条路径
- 拆分为多个小函数, 每个栈帧可控
- 大对象一律堆分配

**不做:**
- 不碰 quickapp-runtime-core / -js / -lvgl 等子项目源码
- 不保留 simulator 的 showcase 分支、测试断言、命令行解析
- 不追求多 RPK/多路径通用 (后续再抽象)
- 不做优雅退出/资源回收 (设备常驻运行, 进程不结束)

---

## 3. 文件结构

保留现有: `display_driver.*`、`touch_driver.*`、`spiffs_package_source.*`、
`atomic_shim.c`(已验证有效)。

新增/重写:

| 文件 | 职责 |
|------|------|
| `device_app.cpp` | `app_main` 入口: LVGL init → tick → 创建 runtime 任务 |
| `device_runtime.h` | `DeviceRuntime` 类声明 (持有所有装配对象) |
| `device_runtime.cpp` | `DeviceRuntime` 实现: 分步装配 + 主循环 |
| `device_helpers.h` | 从 case001 抽出的平台无关辅助类 (Sink/Resolver/Ingress 等) |

`device_composition.cpp` 删除 (被上述替代)。

---

## 4. 内存策略 (核心)

1. **所有大型装配对象为成员/堆对象**, 不放函数栈:
   - `DeviceRuntime` 类的成员用 `std::unique_ptr<T>` 持有
   - `DeviceRuntime` 本身用 `new` 堆分配 (不放栈)
   - 栈上只出现指针/引用, 单函数栈帧控制在几 KB
2. **RPK 读进内存**: SPIFFS 一次性整包读入 (已实现于 spiffs_package_source)
3. **运行时任务栈放内部 RAM** (PSRAM 栈在关 cache 时不可访问, 已踩坑),
   拆分后帧变小, 32~48 KB 栈足矣
4. **中断看门狗**: bring-up 阶段维持关闭 (解析/首帧期间 CPU 占用较长)

---

## 5. 装配步骤 (每步一个小函数, 栈帧独立)

```
DeviceRuntime::init()
  1. initDisplayInput()   — ILI9341 display + XPT2046 indev
  2. loadPackage()        — SpiffsPackageSource → PackageLoader::open → VerifiedPackage
  3. buildHostBackends()  — OwnerTaskQueue / PageRootBackend / FeatureProvider /
                            SurfaceHostAdapter / MountHost / FontMeasure
  4. buildCore()          — EventRouter / TimerRegistry / MountCoordinator
  5. startJsEngine()      — QuickJsEngineProvider / JsEngineService.start
  6. bootstrapJs()        — ModuleLoader/RuntimeAbi/HandlerRegistry/VM + 加载
                            framework+app 模块 (在 JS executor 内)
  7. buildController()    — SurfaceController + PageResolver + platform 接线
  8. mountRootPage()      — 导航到 entry_route, 等待首个 surface 可见

DeviceRuntime::run()      — 常驻循环: service() + 绑定 click handler
DeviceRuntime::service()  — controller.drain / timer / tasks.pump /
                            mounts.service / surfaces.service / bridge.service /
                            lv_timer_handler
```

每个 `buildXxx()` 返回后其临时局部即释放, 不累积到一个巨帧。

---

## 6. 触摸 → 事件 桥接

复用 `touch_driver` (XPT2046 → LVGL indev) 已通; runtime 侧用
`LvglClickToCore` 把 LVGL 点击事件投递到 `EventRouter` (沿用 case001 的桥接类)。

---

## 7. 验收标准 (录视频用)

- 上电后屏幕显示 sport-watch 首页 (运动表盘)
- 触摸可交互 (点击进入 Goals / Detail 页, 返回)
- 串口无 panic / stack overflow / 看门狗复位, 稳定运行

---

## 8. 明确不在本次范围 (留给后续/架构)

- 把这套装配抽成 simulator/android/ios/embedded **四端共享**的装配层
  (当前是各自一份, 是既有技术债, 单独立项)
- 完整资源回收 / 多 RPK 切换 / 错误恢复
