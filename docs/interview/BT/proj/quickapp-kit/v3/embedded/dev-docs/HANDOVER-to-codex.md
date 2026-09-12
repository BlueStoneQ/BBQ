# 交接文档 — sport-watch RPK 在 ESP32-S3 真机 bring-up

交接给：Codex (GPT-5.x)。目标：让 sport-watch RPK 在 ESP32-S3 + ILI9341(240x320) + XPT2046 触摸屏上跑起来，点击/返回导航可用，录制演示视频。

---

## 0. 当前状态一句话

固件、运行时、RPK、点击链路**软件层全部验证通过**（有串口日志实锤）。唯一卡点是**触摸硬件接触不稳**（面包板+杜邦线），触摸失灵时驱动读不到任何按下。返回按钮(hdl:5)是唯一未验证成功的软件疑点，需触摸稳定后才能确认。

---

## 1. 工程路径与环境

- 工程根：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-embedded/quickapp-device-esp32/`
- 激活环境：`source <工程根>/activate.sh`（zsh 下注意：activate.sh 输出里不要跟 `#` 注释，会被 zsh 当命令报 `command not found: #`）
- venv python（抓串口用）：`<工程根>/deps-source/espressif/python_env/idf5.4_py3.9_env/bin/python`
- 串口：`/dev/cu.usbserial-1130`
- ESP-IDF v5.4

## 2. 构建 / 烧录 / 抓日志命令

构建（必带 RPK 路径，首次已缓存进 CMake）：
```
source activate.sh
idf.py -DQA_RPK_PATH=/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-android/app/build/generated/host-rpk/sport-watch.rpk build
```
（后续 rebuild 直接 `idf.py build` 即可，路径已缓存）

烧录前先释放串口：
```
P=$(lsof -t /dev/cu.usbserial-1130); if [ -n "$P" ]; then kill -9 $P; fi; sleep 1
```

烧录（分区：0x0 bootloader / 0x8000 分区表 / 0x10000 app(2.6MB) / 0x310000 rpk_store(13MB)）：
- **全量烧**（app 或 rpk 变了都烧）：`idf.py -p /dev/cu.usbserial-1130 -b 460800 flash`
- **只烧 app**（rpk 没变时，快）：
```
<venv python 上面那个> -m esptool --chip esp32s3 -p /dev/cu.usbserial-1130 -b 460800 \
  --before default_reset --after hard_reset write_flash --flash_mode dio --flash_freq 80m --flash_size 16MB \
  0x10000 build/quickapp_device.bin
```
- 波特率经验：460800 大多数时候 OK，但**接触不良时会中途掉线**（见过 78%/26% 断）。掉线就重试；反复掉线说明是物理连接问题，不是软件。掉线会写坏 app 分区 → 白屏，必须重烧完整。
- 校验成功标志：日志里 `Hash of data verified`（全量应出现 4 次）。

抓串口日志（重要——这块板子只有**复位方式**能读到日志，被动读恒为 0 字节）：
- 脚本 `/tmp/mon4.py`：classic reset(setDTR(False);setRTS(True);sleep0.15;setRTS(False)) 后读 26 秒 → 写 `/tmp/mon2.txt`，打印 `BYTES N`
- 用法：`<venv python> /tmp/mon4.py`，复位后约 6 秒出首页，之后有 ~20 秒窗口点屏幕
- **坑**：`execute_bash` 常把命令 stdout 吞掉（显示空），别慌，直接读结果文件 `/tmp/mon2.txt`
- 分析：`grep -aE "\[TOUCH\] press|handler=hdl|navigation_push|navigation_back|lvgl.input.dispatch|runtime ready|installed=" /tmp/mon2.txt | tr -d '\r' | sed -E 's/^[IEWD] \([0-9]+\) //'`
- `idf.py monitor` 在 agent 环境跑不了（需 TTY），只能用上面的 python 脚本

## 3. 已验证通过的证据（软件层是好的）

一次成功抓取（460800 全量烧后）串口日志确认了完整点击链路：
```
touch: [TOUCH] press x=147 y=64
lvgl.input.dispatch request=req:p-1 surface=srf:1 node=node:19 accepted=1
js.core.navigation_push request=req:j-100001 uri=/pages/Goals source=srf:1
js.core.instantiate surface=srf:2 template=page:/pages/Goals handlers=5
simulator.event_binding pushed_surface=1 surface=srf:2 handlers=64
```
启动日志全绿：`RPK opened package=com.quickappkit.sport.watch entry=/pages/Home` → `display+touch ready 240x320` → `showcase.click_handlers installed=1` → `runtime ready, entering device loop` → `free heap=7.5MB`。无 backtrace/abort。

## 4. 唯一遗留软件疑点：返回按钮(hdl:5) 未验证成功

- sport-watch 三页：Home(entry) → Goals → Detail。均为 showcaseRpk + `router.push` 前进 / `router.back` 返回。
- RPK 已解包在 `/tmp/sw-rpk/`（`pages/{Home,Goals,Detail}/index.js` + `index.ir.json`）。
- **Home 页** handler：`{"1":"onGoals"}` → hdl:1 → `router.push(/pages/Goals)`。已验证通。
- **Goals 页** handler：`{"1":"onStepsDetail","2":"onCaloriesDetail","3":"onStandDetail","4":"onWaterDetail","5":"onBack"}`。hdl:1~4 是"详情"按钮(push 到 Detail)，**hdl:5 = "返回"按钮 = onBack = router.back()**。
- Goals 页 IR 布局关键点（`/tmp/sw-rpk/pages/Goals/index.ir.json`）：
  - 根 node 1：View，width=240 **height=240**（屏幕是 240x320！），flexDirection=column, justifyContent=center。
  - 4 个"详情"按钮(node 10/15/20/25)在一个 **Scroll(node 4)→List(node 5)** 容器里。
  - "返回"按钮(node 26, text="返回", 92x26)在 Scroll **外面**，是根的最后一个子节点 → 渲染在页面底部。
- **两个待查假设**（未证实，二选一或都不是）：
  1. **物理位置**：用户点返回时坐标偏上，命中的是 Scroll 里的详情按钮(hdl:1)而非底部返回按钮。曾观测到用户在 Goals 点击命中 hdl:1 → push 到 Detail(而非 back)，坐标都在 y=64 上方。→ 需实锤：点返回时 `[TOUCH] press` 的 y 值 vs 返回按钮实际渲染 y。
  2. **back 路径在 ManualPump 下没被 pump 够**：push 轻(一两轮 pump 成)，back 重(涉及 surface close→destroy→reveal 下层+teardown barrier)。simulator(OwnedThread)返回正常，真机(ManualPump)可能销毁链路没驱动完成。日志从未见过 `navigation_back`。→ 需实锤：点到返回按钮后有没有 `handler=hdl:5` dispatch、有没有 `navigation_back`。
- **排查方法**：抓日志，看点返回那一刻 `[TOUCH] press x= y=` 坐标 + `handler=hdl:?`。若命中 hdl:5 但无 navigation_back → 是 back/pump 问题(看 service() pump 预算)；若根本没命中 hdl:5 → 是位置问题(改 Goals 布局，见下)。

## 5. 若判定为布局问题的修法（需改 RPK 源 + 重生成 rpk + 全量烧）

把 Goals 页返回按钮移出 Scroll、放页面顶部固定、加大到整行宽，或把根 height 设 320 让布局铺满。RPK 源工程需定位(当前只有解包产物在 /tmp/sw-rpk 和 host-rpk/sport-watch.rpk)。改完重新生成 rpk → 全量烧(rpk 分区变了)。

## 6. 代码改动清单（均未提交，都在工作区）

### 仓库 A：quickapp-embedded（主体）路径 `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-embedded`
`main/` 目录（工程根 = quickapp-device-esp32）：
- `device_composition.cpp`（新增, 核心）：从 `quickapp-examples/composition/case001_lvgl.cpp` 移植的完整装配层。去 SDL 换 ILI9341/XPT2046。`kInteractiveSimulator=true`。大对象全部 `auto& x = *new T(...)` 堆分配（**勿改回栈**，否则 102KB 栈帧溢出）。主循环：`while(true){ service(); bindShowcaseClickHandlers(); bindInteractiveDetailBack(); vTaskDelay(5); }`。`service()` 里 `engine.pump(16)` + 各 backend service + `lv_timer_handler()`。app_main 用 pthread_create + esp_pthread cfg.stack_size=100KB 绑 core0 创建 runtime 线程(不能用裸 xTaskCreate，JS 引擎依赖 pthread)。
- `atomic_shim.c`（新增）：用 portENTER_CRITICAL 实现 `__atomic_test_and_set`/`__atomic_clear`（工具链 -mdisable-hardware-atomics 无 libatomic）。
- `touch_driver.cpp`（改）：XPT2046 驱动 + 一行诊断日志 `[TOUCH] press x= y=`（released→pressed 边沿打一次，无害，可保留或删）。
- `display_driver.cpp`（改）：ILI9341 + flush_cb 里 `lv_draw_sw_rgb565_swap` 字节序交换（否则颜色失真）。
- `spiffs_package_source.cpp/.h`（改）：RPK 整包读进内存(不逐次 fread，否则解析慢拖垮)。
- `lv_conf.h`（改）：`LV_USE_LODEPNG 1`。
- `CMakeLists.txt` / `main/CMakeLists.txt`（改）：FULL 模式 SRCS 用 device_composition.cpp。
- `sdkconfig.defaults`（改）：`CONFIG_ESP_INT_WDT=n`（关看门狗）、`CONFIG_SPIFFS_USE_MAGIC_LENGTH=y`（spiffsgen 须 --use-magic-len，clean build 保证镜像匹配）。
- `main/minimal.mode`（删）：删掉=FULL 模式；存在=MINIMAL 模式(main_minimal.cpp 纯 LVGL TAP ME 按钮测试, 无 JS/RPK)。

### 仓库 B：quickapp-runtime-core（ManualPump，**架构已批准**）路径 `/Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-core`
- `runtime/js/include/quickapp/js/engine/engine_types.h`（改）：JsEngineConfig 加 `ExecutorMode executorMode{ExecutorMode::OwnedThread}`（默认不变）。
- `runtime/js/include/quickapp/js/engine/js_engine_service.h`（改）：加 `std::size_t pump(std::size_t maxTasks) noexcept`。
- `runtime/js/src/engine/js_engine_service.cpp`（改）：start() 里 `backend_->start(engineConfig_.executorMode)`（原来写死 OwnedThread）；新增 pump() 有限预算循环调 `backend_->pumpOne()`。
- `docs/runtime-composition-migration-spec.md`（新增文档）。
- **对 lvgl simulator 无影响**（已核实）：唯一"改动"行是把写死的 OwnedThread 换成读配置，默认值仍 OwnedThread；simulator 不设 executorMode/不调 pump；OwnedThread 下 pumpOne() 恒 false，pump() 为 no-op；未动 simulator 源文件。这是纯加法，符合架构批准前提。

## 7. 关键架构决策（勿推翻）

- **ManualPump 单线程**（非 OwnedThread 双线程）：内部 RAM 装不下两个大栈(最大连续块~128KB)。架构批准的加法式接入，验收三条：有限预算 pump / 同线程调用 / 销毁期继续 pump。
- **大对象堆分配**（非加大栈）：栈放 PSRAM 会 cache assert；内部 RAM 栈 160KB/200KB 分配都失败。
- **RPK 整包读内存**（非逐次 fread）。
- 触摸"又挂了"多次：确认是**硬件/上电状态**（minimal 同款驱动也挂），重烧+重新上电恢复，非软件。

## 8. 用户约束（务必遵守）

- 让用户转发给别人的内容，**用代码块包裹**，方便复制。
- 改 runtime 子项目（core/js）**先汇报**：300 字说清怎么改+影响，等架构批准。ManualPump 已批准。
- 用户目标是**先录视频**，别过度重构；架构调整放录完之后。

## 9. 攻坚全历程（背景，详见同目录 ESP32-BRINGUP-JOURNEY.md）

看门狗超时→关 INT_WDT；SPIFFS 慢→RPK 整包读内存；包解析同步递归→蹦床拉平；102KB 单函数栈帧→大对象堆分配(降到 44KB)；pthread_self assert→runtime 线程用 pthread；双大栈装不下→ManualPump 单线程(改 js 子项目)；SPIFFS 镜像不匹配→clean build 对齐 --use-magic-len；颜色失真→RGB565 字节序交换；点击无反应→触摸诊断定位(最终锁定为硬件接触)。

## 10. Codex 接手第一步建议

1. 先让用户把杜邦线/USB 接稳（触摸不稳时软件层做不了任何事）。
2. 全量烧 460800 → mon4.py 抓日志确认启动全绿 + 能看到 `[TOUCH] press`。
3. 触摸稳定后，专门验证返回按钮：进 Goals → 点返回 → 看 `[TOUCH] press` 坐标 + 是否 `handler=hdl:5` + 是否 `navigation_back`，据此走 §4 的两条假设分支。
4. 全部通过后：提交两个仓库(§6)，commit message 写清；用户要先录视频再动架构。
