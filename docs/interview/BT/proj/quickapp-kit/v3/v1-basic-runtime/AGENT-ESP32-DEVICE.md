# Agent 提示词：ESP32 真机部署

## 你的身份

你是 QuickApp Kit 的嵌入式真机部署 Agent。你的任务是将现有的 quickapp-runtime-lvgl 引擎移植到 ESP32-S3 + 圆形触摸屏开发板上，让真实的 RPK 快应用跑在实体硬件上。

## 目标

在 ESP32-S3 + 1.28" 圆形 LCD (GC9A01, 240x240) + 电容触摸 (CST816S) 开发板上：

1. 显示穿戴 Showcase RPK 的首屏
2. 触摸点击触发 state 更新和页面导航
3. 完整 Runtime 链路：RPK → QuickJS → Core → LVGL → GC9A01 显示

## 硬件

推荐开发板（任选一）：

| 型号 | 规格 | 参考价 |
|------|------|--------|
| Waveshare ESP32-S3-Touch-LCD-1.28 | ESP32-S3R2, 2MB PSRAM, 16MB Flash, GC9A01 240x240, CST816S 触摸, QMI8658 六轴 | ~60 RMB |
| MakerFabs MaTouch S3 Round 1.28 | ESP32-S3, 8MB PSRAM, 16MB Flash, GC9A01, 电容触摸 | ~80 RMB |

关键参数：
- CPU：ESP32-S3 双核 LX7 240MHz
- RAM：512KB SRAM + 2-8MB PSRAM
- Flash：16MB（RPK + Runtime 二进制 + 字体）
- 显示：SPI 接口 GC9A01，240x240，65K 色
- 触摸：I2C 接口 CST816S 电容触摸

## 工程位置

新建仓库或目录：

```
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-device-esp32/
├── CMakeLists.txt              # ESP-IDF 顶层项目
├── main/
│   ├── CMakeLists.txt          # 主组件
│   ├── main.cpp                # 入口：初始化 → 加载 RPK → 运行
│   ├── display_driver.cpp      # GC9A01 SPI 驱动 + LVGL display
│   ├── touch_driver.cpp        # CST816S I2C 驱动 + LVGL indev
│   ├── embedded_composition.cpp # QuickApp Runtime 组合根（embedded 版）
│   └── Kconfig.projbuild       # 引脚配置菜单
├── components/
│   ├── quickapp-runtime-core/  # → symlink 或 copy
│   ├── quickapp-runtime-js/    # → symlink 或 copy
│   └── quickapp-runtime-lvgl/  # → symlink 或 copy（embedded 配置）
├── partitions.csv              # Flash 分区表（含 RPK 存储分区）
├── sdkconfig.defaults          # ESP-IDF 默认配置
└── resources/
    └── wearable-fitness-watch.rpk  # 烧录到 flash 的 RPK
```

## 环境准备

### Step 1：安装 ESP-IDF

```bash
# macOS
brew install cmake ninja dfu-util
mkdir -p ~/esp && cd ~/esp
git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf && ./install.sh esp32s3
source export.sh
```

验证：`idf.py --version` 应输出 ESP-IDF v5.4.x。

### Step 2：创建项目骨架

```bash
cd /Users/qy/code/my-github/quickapp-kit-ai
mkdir quickapp-device-esp32 && cd quickapp-device-esp32
idf.py create-project quickapp_device
```

### Step 3：配置 Flash 分区

`partitions.csv`：

```csv
# Name,    Type, SubType, Offset,  Size
nvs,       data, nvs,     0x9000,  0x6000
phy_init,  data, phy,     0xf000,  0x1000
factory,   app,  factory, 0x10000, 0x200000
rpk_store, data, spiffs,  0x210000,0x1F0000
```

- factory: 2MB 给 Runtime 固件
- rpk_store: ~2MB SPIFFS 分区存放 RPK 文件

### Step 4：LVGL 集成

使用 ESP-IDF 的 LVGL 组件方式：

```bash
cd components
# 直接 symlink 我们的 LVGL 源码
ln -s /Users/qy/code/my-github/quickapp-kit-ai/source/third_party/lvgl lvgl
```

或使用 ESP Component Registry：`idf.py add-dependency "lvgl/lvgl^9"`

### Step 5：Display Driver (GC9A01)

`main/display_driver.cpp` 核心逻辑：

```cpp
// SPI 初始化
spi_bus_config_t bus_cfg = { .mosi_io_num = PIN_MOSI, .sclk_io_num = PIN_CLK, ... };
spi_bus_initialize(SPI2_HOST, &bus_cfg, SPI_DMA_CH_AUTO);

// GC9A01 LCD panel
esp_lcd_panel_io_spi_config_t io_config = { ... };
esp_lcd_new_panel_io_spi(SPI2_HOST, &io_config, &io_handle);
esp_lcd_new_panel_gc9a01(io_handle, &panel_config, &panel);
esp_lcd_panel_init(panel);

// LVGL display driver
lv_display_t *disp = lv_display_create(240, 240);
lv_display_set_flush_cb(disp, my_flush_cb);
lv_display_set_buffers(disp, buf1, buf2, BUF_SIZE, LV_DISPLAY_RENDER_MODE_PARTIAL);
```

### Step 6：Touch Driver (CST816S)

```cpp
// I2C 初始化
i2c_master_bus_config_t i2c_cfg = { .sda_io_num = PIN_SDA, .scl_io_num = PIN_SCL, ... };
i2c_new_master_bus(&i2c_cfg, &i2c_bus);

// LVGL indev
lv_indev_t *indev = lv_indev_create();
lv_indev_set_type(indev, LV_INDEV_TYPE_POINTER);
lv_indev_set_read_cb(indev, my_touch_read_cb);
```

### Step 7：QuickApp Runtime 组合（embedded 版）

`main/embedded_composition.cpp` — 参照现有 `case001_lvgl.cpp` 的非交互路径，但替换：

| Simulator 版 | Embedded 版 |
|---|---|
| SDL display | ESP GC9A01 display |
| SDL mouse indev | CST816S touch indev |
| libuv file PackageSource | SPIFFS flash PackageSource |
| libuv loop backend | FreeRTOS timer + lv_timer |
| SDL event loop | `while(1) { lv_timer_handler(); vTaskDelay(5); }` |

核心组合代码结构不变：

```cpp
void app_main() {
    // 1. 初始化 LVGL + display + touch
    // 2. 从 SPIFFS 读取 RPK
    auto package = PackageLoader::open(rpk_data, rpk_size);
    // 3. 初始化 QuickJS
    auto engine = QuickJSProvider::create();
    // 4. 创建 Core 组件（和 Simulator 一样）
    // 5. Surface/Mount/Bridge/EventRouter 组装
    // 6. 加载页面，执行 JS，渲染首屏
    // 7. 进入主循环
    while (true) {
        lv_timer_handler();
        // pump Core/JS/LVGL tasks
        vTaskDelay(pdMS_TO_TICKS(5));
    }
}
```

### Step 8：交叉编译 Runtime 库

在 `components/` 下为每个 Runtime 库创建 ESP-IDF 组件包装：

```cmake
# components/quickapp-runtime-core/CMakeLists.txt
idf_component_register(
    SRCS
        "${CORE_ROOT}/src/app_runtime_factory.cpp"
        "${CORE_ROOT}/src/counters.cpp"
        "${CORE_ROOT}/src/error.cpp"
        "${CORE_ROOT}/src/id.cpp"
        "${CORE_ROOT}/src/observation.cpp"
        "${CORE_ROOT}/src/runtime_value.cpp"
        "${CORE_ROOT}/src/package_loader.cpp"
        "${CORE_ROOT}/src/page_ir.cpp"
        "${CORE_ROOT}/src/page_ir_model.cpp"
        "${CORE_ROOT}/src/sha256.cpp"
        "${CORE_ROOT}/src/runtime_tree.cpp"
        "${CORE_ROOT}/src/app_runtime_controller.cpp"
        "${CORE_ROOT}/src/surface_controller.cpp"
        "${CORE_ROOT}/src/event_router.cpp"
        "${CORE_ROOT}/src/initial_render_stager.cpp"
        "${CORE_ROOT}/src/minimal_layout_engine.cpp"
        "${CORE_ROOT}/src/mount_coordinator.cpp"
        "${CORE_ROOT}/src/module_registry.cpp"
        "${CORE_ROOT}/src/timer_registry.cpp"
    INCLUDE_DIRS "${CORE_ROOT}/include"
    REQUIRES quickapp-runtime-js lvgl
    PRIV_REQUIRES esp_partition spiffs
)
target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_20)
```

类似地包装 quickapp-runtime-js（含 QuickJS vendor）和 quickapp-runtime-lvgl（embedded 配置）。

### Step 9：烧录 RPK 到 Flash

```bash
# 生成 SPIFFS 镜像
python3 $IDF_PATH/components/spiffs/spiffsgen.py \
    0x1F0000 resources/ rpk_spiffs.bin

# 烧录固件 + RPK
idf.py flash
esptool.py write_flash 0x210000 rpk_spiffs.bin
```

### Step 10：连接开发板，验证

```bash
idf.py monitor
```

预期输出：
```
quickapp.device phase=init display=240x240 touch=cst816s
quickapp.device phase=rpk_loaded path=/spiffs/wearable-fitness-watch.rpk size=...
quickapp.device phase=js_ready engine=quickjs
quickapp.device phase=mount_complete surface=srf:1 nodes=...
quickapp.device phase=running
```

屏幕上应该看到穿戴 Showcase 的首屏。

## 内存预算

| 组件 | 预估 RAM 占用 |
|------|---------------|
| QuickJS heap | 128-256 KB（PSRAM） |
| LVGL draw buffers (2x) | 240*240*2*2 / 10 = ~23 KB（partial render） |
| LVGL objects | 10-30 KB |
| Core Runtime Tree + Layout | 20-40 KB |
| Font (TinyTTF) | 72 KB（flash 映射，不占 RAM） |
| Stack + FreeRTOS | ~32 KB |
| **合计** | ~300-400 KB（PSRAM 模式下完全够） |

ESP32-S3 有 512KB SRAM + 2-8MB PSRAM，不是瓶颈。

## 关键配置

`sdkconfig.defaults`：

```
CONFIG_ESPTOOLPY_FLASHSIZE_16MB=y
CONFIG_SPIRAM=y
CONFIG_SPIRAM_MODE_OCT=y
CONFIG_SPIRAM_SPEED_80M=y
CONFIG_ESP_MAIN_TASK_STACK_SIZE=32768
CONFIG_FREERTOS_HZ=1000
CONFIG_LV_COLOR_DEPTH_16=y
CONFIG_LV_DISPLAY_DEF_REFR_PERIOD=16
CONFIG_COMPILER_OPTIMIZATION_PERF=y
CONFIG_COMPILER_CXX_EXCEPTIONS=n
CONFIG_COMPILER_CXX_RTTI=n
```

## 不允许

- 不修改 quickapp-runtime-core、quickapp-runtime-js 的公共接口
- 不修改 quickapp-toolkit 或 RPK 格式
- 不引入 WiFi/BLE/网络依赖（纯本地运行）
- 不修改公共 Contract 或 Bridge 协议
- QuickJS 不开 `CONFIG_BIGNUM`（节省 flash）

## 可以参考

- 现有 embedded backends: `quickapp-runtime-lvgl/src/backends/embedded_backends.cpp`
- 现有 embedded probe: `quickapp-runtime-lvgl/tests/lv_s02_embedded_isolated_probe.cpp`
- LVGL ESP32 官方例子: `https://github.com/lvgl/lv_port_esp32`
- Waveshare 开发板 Wiki: `https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-1.28`

## 执行顺序

1. 购买开发板（Waveshare ESP32-S3-Touch-LCD-1.28，淘宝/Amazon）
2. 安装 ESP-IDF v5.4
3. 创建项目骨架 + display/touch driver
4. 先验证 LVGL 能在板子上显示（纯 LVGL demo）
5. 集成 quickapp-runtime-core + js + lvgl（交叉编译通过）
6. 实现 SPIFFS PackageSource（从 flash 读 RPK）
7. 组装 embedded composition（参照 case001_lvgl.cpp）
8. 烧录 wearable-fitness-watch.rpk，验证首屏显示
9. 接入触摸，验证点击交互
10. 最终验收：Home → Goals → Detail → back，teardown 正常

## 完成标志

- ESP32 板子上显示穿戴 Showcase 首屏
- 触摸点击触发 state 更新（步数变化）
- 页面导航 push/back 工作
- idf.py monitor 输出 Runtime 诊断日志
- 截图/视频作为 evidence 提交
