# ESP32-S3 真机跑通 QuickApp Runtime 攻坚记录

> 目标: 把 QuickApp 完整 runtime (Core + QuickJS + LVGL host) + sport-watch RPK
> 部署到 ESP32-S3 真机 (2.8寸 ILI9341 + XPT2046 电阻触摸), 用于演示。
>
> 本质: 这套 runtime 是"桌面血统"(为 simulator/android/ios 设计, 假设大内存/大栈/
> 多线程)。搬到 MCU (ESP32-S3: 内部 RAM ~512KB, 最大连续块 128KB, 栈受限) 需要
> 一系列"嵌入式化"适配。下面按遇到的顺序记录每个坎和解法。

---

## 攻坚清单 (按遇到顺序)

| # | 问题现象 | 根因 | 解法 |
|---|---------|------|------|
| 1 | 启动即崩溃重启, 中断看门狗超时 | RPK 解析期 CPU 长时间不让出, 触发 INT_WDT(300ms) | 关闭 `CONFIG_ESP_INT_WDT`, 放宽任务看门狗 |
| 2 | 解析 RPK 极慢/卡死 | SPIFFS 逐次 fseek+fread 太慢, 包解析发大量小读 | RPK 开机一次性整包读进内存(PSRAM), read_at 从内存切片 |
| 3 | 栈溢出崩溃 (LoadProhibited) | PackageLoader 逐 artifact 校验用同步内联回调 → N 个成员嵌套 N 层调用栈 | SpiffsPackageSource 加**蹦床(trampoline)**: read_at 只入队+立即返回, 最外层排空队列, 把递归拉平成迭代 |
| 4 | 任务一进入就爆栈 (102KB 单帧) | 装配函数 device_runtime_main 把几十个大对象全声明为**栈上局部变量**, 编译器一次性预留整帧 (实测 `-fstack-usage` = 102KB > 128KB 连续块) | 大对象改**堆分配** (`auto& x = *new T`), 栈上只留指针 → 帧降到 44KB |
| 5 | pthread_self assert | runtime 用了 C++ std 线程原语(promise/future/this_thread), 但跑在裸 xTaskCreate 任务里, ESP-IDF pthread 层找不到线程 | runtime 线程改用 `pthread_create` + esp_pthread 配置(大栈, 绑 core) |
| 6 | JS worker `std::thread` 创建失败 → abort | JsExecutor 默认 OwnedThread 模式开独立 worker 线程跑 QuickJS, 需第二个大栈; 但内部 RAM 装不下两个 50-60KB 大栈(碎片化) | **架构批准**: JS 引擎暴露 **ManualPump 单线程模式** (JsEngineConfig.executorMode=ManualPump), 主循环 service() 里 `engine.pump(N)` 有限预算驱动, 不再开第二线程。改了 quickapp-runtime-core/runtime/js 3 个文件(加法式, 不改默认行为, 其他平台零影响) |
| 7 | SPIFFS 挂载失败 ESP_FAIL → 重启 | 镜像生成命令(spiffsgen)与运行时 SPIFFS 配置不匹配: sdkconfig `CONFIG_SPIFFS_USE_MAGIC_LENGTH=y` 但缓存的 spiffsgen 命令缺 `--use-magic-len` (中途 rm sdkconfig 重置默认值后缓存不一致) | clean build 让 spiffsgen 重新生成正确命令(含 --use-magic-len), 镜像与运行时配置对齐 |
| 8 | 颜色失真严重 | ILI9341(esp_lcd) 期望大端 RGB565, LVGL 输出小端, 字节序相反 | flush_cb 里 `lv_draw_sw_rgb565_swap(px_map, px_count)` 交换高低字节 |
| 9 | 点击无反应 | 触摸诊断定位 (加 [TOUCH]/[BIND]/[TCB] 日志) → XPT2046 读取问题 | 触摸诊断定位后修复 |

---

## 关键技术约束 (MCU 特有, 后续开发牢记)

1. **任务栈不能放 PSRAM** — 运行时会在关 cache 的临界区(flash/atomic)执行, PSRAM 栈在 cache 关闭时不可访问 → assert。栈必须内部 RAM。
2. **内部 RAM 最大连续块 ~128KB** — 单个任务栈 + 单个函数帧都受此限。不能有两个大栈线程。
3. **runtime 线程必须是 pthread** — std 线程原语依赖 ESP-IDF pthread 层。
4. **JS 引擎用 ManualPump** — 单线程串行驱动, 契合 MCU (省线程/省栈/省切换)。有限预算 pump(N), 防止饿死 LVGL/触摸。
5. **装配代码必须堆分配大对象** — 不能像 simulator 那样堆栈上。
6. **SPIFFS 镜像与运行时配置必须一致** — page-size / use-magic / use-magic-len / obj-name-len / meta-len 全部对齐。

---

## 涉及改动的仓库/文件

**quickapp-embedded (embedded 工程, 主要改动):**
- `main/device_composition.cpp` — 装配层(大对象堆分配 + ManualPump pump + 触摸/点击绑定)
- `main/display_driver.cpp` — ILI9341 SPI + RGB565 字节序交换
- `main/touch_driver.cpp` — XPT2046 SPI 电阻触摸
- `main/spiffs_package_source.cpp` — 整包读内存 + 蹦床拉平递归
- `main/atomic_shim.c` — __atomic_test_and_set/clear (工具链缺 libatomic)
- `sdkconfig.defaults` — 关 INT_WDT, Flash/PSRAM 配置

**quickapp-runtime-core (runtime/js, 架构批准的 ManualPump 支持):**
- `runtime/js/include/quickapp/js/engine/engine_types.h` — JsEngineConfig 加 executorMode
- `runtime/js/include/quickapp/js/engine/js_engine_service.h` — 暴露 pump(maxTasks)
- `runtime/js/src/engine/js_engine_service.cpp` — start() 用配置的 mode; 实现 pump()

---

## 遗留 / 后续 (给架构的技术债)

1. **装配层三端重复** — case001(simulator)/android/ios 各有一份近乎重复的运行时装配代码(~1800行), 未抽象成共享层。嵌入式又抄了一份(device_composition.cpp)。应立项抽出平台无关的共享装配层。
2. **嵌入式装配层重写** — 当前 device_composition.cpp 是从 simulator 照搬改的, 应按 EMBEDDED-COMPOSITION-SPEC.md 拆成小函数 + 干净的堆分配结构。
3. **ManualPump 验收项** (架构要求): 有限预算 pump / 同线程调用 / 销毁期持续 pump 三项需进正式验收。
