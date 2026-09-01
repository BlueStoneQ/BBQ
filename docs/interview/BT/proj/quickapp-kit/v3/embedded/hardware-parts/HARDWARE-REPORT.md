# 器材清单与硬件报告

> 日期: 2026-08-27  
> 用途: QuickApp Kit 嵌入式运行时真机部署  

---

## 目录

- [1. 主控板 — ESP32-S3-DevKitC (N16R8)](#1-主控板--esp32-s3-devkitc-n16r8)
- [2. 显示屏 — 2.8寸 TFT SPI 带触摸 + SD卡](#2-显示屏--28寸-tft-spi-带触摸--sd卡)
- [3. 面包板](#3-面包板)
- [4. 杜邦线](#4-杜邦线)
- [5. 关键技术参数总结](#5-关键技术参数总结)
- [6. 对项目的影响与调整](#6-对项目的影响与调整)
- [7. 接线方案](#7-接线方案)
- [8. RPK 包传输方案](#8-rpk-包传输方案)
- [9. 注意事项](#9-注意事项)
- [10. 下一步](#10-下一步)

---

## 1. 主控板 — ESP32-S3-DevKitC (N16R8)

| 项目 | 详情 |
|------|------|
| 模组 | ESP32-S3-WROOM-1 (乐鑫维信科技/上海) |
| 型号标注 | MCN16R8 |
| Flash | 16 MB |
| PSRAM | 8 MB (Octal) |
| CPU | 双核 Xtensa LX7, 最高 240 MHz |
| USB | 双 Type-C: COM (CH343 串口) + USB-OTG (原生 USB) |
| 按钮 | RST (复位) + BOOT (下载模式) |
| LED | 板载 RGB (WS2812, 接 GPIO48 通常) |
| 认证 | FCC ID: 2AC7Z-ESPS3WROOM1, IC: 21098-ESPS3WROOM1, CMIIT: 2022DP2892 |
| PCB 颜色 | 深蓝 |

### 引脚布局（从背面看/黄色排针）

**左侧（从上到下）：**
```
GND, GND, 19, 20, 21, 47, 48, 45, 0, 35, 36, 37, 38, 39, 40, 41, 42
```

**右侧（从上到下）：**
```
GND, 5V, 5V, 4, RST, 3V3, 3V3, 46, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 7, 6, 5
```

**顶部排针：**
```
RX, TX, GND
```

**底部接口：**
```
COM (Type-C, CH343 串口调试) | USB-OTG (Type-C, 原生USB, 可传数据)
```

---

## 2. 显示屏 — 2.8寸 TFT SPI 带触摸 + SD卡

| 项目 | 详情 |
|------|------|
| PCB 型号 | KMRTM28028-SPI |
| 尺寸 | 2.8 英寸 |
| 分辨率 | 240 × 320 (竖屏) |
| 显示驱动IC | ILI9341 (标准 2.8寸 SPI TFT 驱动) |
| 触摸类型 | 电阻触摸 (XPT2046 控制器) |
| 通信接口 | SPI (显示 + 触摸共享 SPI 总线, 各自 CS) |
| SD卡 | 板载 MicroSD 卡槽 (SPI 接口) |
| 背光 | LED 引脚控制 |
| PCB 日期 | 2025-12-6 |
| PCB 颜色 | 红色 |
| 面板标注 | HC0801018 |

### 引脚定义（14 pin 排针，从 PCB 背面丝印读取）

| # | 引脚名 | 功能 | 说明 |
|---|--------|------|------|
| 1 | VCC | 电源 | 3.3V 或 5V (模块带稳压) |
| 2 | GND | 地 | |
| 3 | CS | LCD SPI 片选 | 低有效 |
| 4 | RESET | LCD 复位 | 低有效 |
| 5 | D/C | 数据/命令 | 高=数据, 低=命令 |
| 6 | SDI(MOSI) | SPI 主出从入 | LCD 数据输入 |
| 7 | SCK | SPI 时钟 | |
| 8 | LED | 背光控制 | 高电平点亮 |
| 9 | SDO(MISO) | SPI 主入从出 | LCD 数据输出 (可不接) |
| 10 | T_CLK | 触摸 SPI 时钟 | 可与 SCK 共用 |
| 11 | T_CS | 触摸 SPI 片选 | 低有效 |
| 12 | T_DIN | 触摸 SPI 数据输入 | 可与 MOSI 共用 |
| 13 | T_OUT | 触摸 SPI 数据输出 | 即 MISO |
| 14 | T_IRQ | 触摸中断 | 低电平=有触摸 |

### SD 卡引脚（底部 5 pin，独立区域）

| 引脚名 | 功能 |
|--------|------|
| SD_CS | SD 卡 SPI 片选 |
| SD_MOSI | SD SPI 数据输入 |
| SD_MISO | SD SPI 数据输出 |
| SD_SCK | SD SPI 时钟 |

---

## 3. 面包板

| 项目 | 详情 |
|------|------|
| 类型 | 标准全尺寸 (830 孔) |
| 布局 | a-e / f-j 列 × 30 行, 两侧各 2 列电源轨 (+/-) |
| 数量 | 1 块 |
| 用途 | 原型接线, 连接 ESP32 开发板与屏幕模块 |

---

## 4. 杜邦线

| 项目 | 详情 |
|------|------|
| 类型 | 母对母 / 公对母 / 公对公 (根据需要选用) |
| 用途 | 连接 ESP32 排针 ↔ 面包板 ↔ 屏幕排针 |

### 接线需求分析

本项目总共需要 **14 根杜邦线** 连接屏幕到 ESP32（不含 SD 卡则 12 根）：

| 连线类型 | 数量 | 说明 |
|----------|------|------|
| 电源线 | 2 根 | VCC → 3V3, GND → GND |
| LCD SPI 信号 | 5 根 | CS, RESET, D/C, MOSI, SCK |
| LCD 背光 | 1 根 | LED |
| LCD MISO | 1 根 | SDO (可选, 不读屏可省) |
| 触摸信号 | 2 根 | T_CS, T_IRQ (CLK/DIN/DOUT 共用SPI) |
| SD 卡 | 1 根 | SD_CS (其他共用SPI) |
| **合计** | **12~14 根** | |

### 推荐杜邦线颜色编码

```
红色  → VCC (3.3V)
黑色  → GND
黄色  → SCK (时钟)
绿色  → MOSI (数据输出)
蓝色  → MISO (数据输入)
白色  → CS 类 (片选信号)
橙色  → 控制信号 (D/C, RESET, IRQ)
```

### 接线方式

```
ESP32 开发板 (黄色排针)
    ↕ 公对母杜邦线
面包板 (中间跳转/汇聚电源)
    ↕ 公对母杜邦线
屏幕模块 (14-pin 排针)
```

或者直接：
```
ESP32 排针 ←母对母杜邦线→ 屏幕排针
```

> 建议用**母对母**杜邦线直连 ESP32 和屏幕排针，这样最简洁。  
> 面包板用于汇聚电源（多个 GND、3V3 需要分线时）和未来扩展。

---

## 5. 关键技术参数总结

| 维度 | 原方案 (GC9A01 圆屏) | **实际器件** |
|------|----------------------|-------------|
| 屏幕形状 | 圆形 1.28寸 | **矩形 2.8寸** |
| 分辨率 | 240×240 | **240×320** |
| 显示驱动 | GC9A01 | **ILI9341** |
| 触摸控制器 | CST816S (I2C 电容) | **XPT2046 (SPI 电阻)** |
| 触摸接口 | I2C | **SPI** |
| SD 卡 | 无 | **有 (暂无卡, 预留)** |

---

## 6. 对项目的影响与调整

### 需要修改的内容

1. **显示驱动**: GC9A01 → **ILI9341**
   - SPI 通信协议类似, 主要是初始化序列不同
   - 分辨率从 240×240 改为 240×320
   - LVGL 显示区域配置调整

2. **触摸驱动**: CST816S (I2C) → **XPT2046 (SPI)**
   - 从 I2C 改为 SPI 接口
   - XPT2046 需要 ADC 转换读取坐标 (12-bit)
   - 电阻触摸需要校准步骤
   - 触摸中断引脚 T_IRQ 可用于降低轮询频率

3. **RPK 存储方案**:
   - 主方案: **通过 USB (Type-C) 从电脑烧写到 Flash 分区** (见第 8 节)
   - 备选: 未来加 SD 卡后可从卡读取
   - Flash 分区保留 ~13MB 给 RPK 存储, 足够大部分应用

4. **SPI 总线规划**:
   - LCD、触摸共享 SPI 总线 (MOSI/MISO/SCK)
   - 通过各自的 CS 引脚区分设备
   - 使用 ESP32-S3 的 SPI2_HOST (FSPI)

---

## 7. 接线方案

### 完整接线表

| 屏幕引脚 | 功能 | → ESP32-S3 GPIO | 杜邦线颜色建议 |
|----------|------|-----------------|---------------|
| VCC | 电源 | 3V3 | 红色 |
| GND | 地 | GND | 黑色 |
| CS | LCD 片选 | GPIO 10 | 白色 |
| RESET | LCD 复位 | GPIO 4 | 橙色 |
| D/C | 数据/命令 | GPIO 5 | 橙色 |
| SDI(MOSI) | SPI 数据 | GPIO 11 | 绿色 |
| SCK | SPI 时钟 | GPIO 12 | 黄色 |
| LED | 背光 | GPIO 6 | 任意 |
| SDO(MISO) | SPI 读取 | GPIO 13 | 蓝色 |
| T_CS | 触摸片选 | GPIO 7 | 白色 |
| T_IRQ | 触摸中断 | GPIO 8 | 橙色 |
| T_CLK | 触摸时钟 | GPIO 12 | (共用 SCK) |
| T_DIN | 触摸数据入 | GPIO 11 | (共用 MOSI) |
| T_OUT | 触摸数据出 | GPIO 13 | (共用 MISO) |

> **重要更正**: T_CLK / T_DIN / T_OUT 与 LCD 的 SCK / MOSI / MISO 接到**同一个 GPIO**
> (GPIO 12 / 11 / 13), 但**每根线都必须物理连接** —— "共用 GPIO" 不等于 "不接线"。
> XPT2046 是独立 SPI 从设备, 缺少 CLK/DIN/OUT 任意一根都会导致触摸完全不工作。
>
> 由于 ESP32 每个 GPIO 引脚通常只有一个孔, 需用**面包板分线**:
> 把 GPIO 12/11/13 各引到面包板一行, 该行同时连 LCD 和触摸的对应引脚。

### 实际需要的杜邦线: 14 根

```
--- LCD (9 根) ---
1.  红色    VCC    → 3V3
2.  黑色    GND    → GND
3.  白色①  CS     → GPIO 10
4.  橙色①  RESET  → GPIO 4
5.  橙色②  D/C    → GPIO 5
6.  绿色    MOSI   → GPIO 11
7.  黄色    SCK    → GPIO 12
8.  任意    LED    → GPIO 6
    (下面 MISO 见 9)
9.  蓝色    MISO   → GPIO 13
10. 白色②  T_CS   → GPIO 7
11. 橙色③  T_IRQ  → GPIO 8
9.  蓝色    MISO   → GPIO 13

--- Touch (5 根, 其中 3 根与 LCD 并联同一 GPIO) ---
10. 白色②  T_CS   → GPIO 7   (独立)
11. 橙色③  T_IRQ  → GPIO 8   (独立)
12. 黄色②  T_CLK  → GPIO 12  (与 SCK 并联, 经面包板)
13. 绿色②  T_DIN  → GPIO 11  (与 MOSI 并联, 经面包板)
14. 蓝色②  T_OUT  → GPIO 13  (与 MISO 并联, 经面包板)
```

### SPI 总线分配

```
SPI2_HOST (FSPI):
  ┌─ MOSI: GPIO 11  (LCD SDI + Touch T_DIN)
  ├─ MISO: GPIO 13  (LCD SDO + Touch T_OUT)
  ├─ SCLK: GPIO 12  (LCD SCK + Touch T_CLK)
  └─ CS 设备:
      ├─ LCD:   GPIO 10
      └─ Touch: GPIO 7
```

### 其他 GPIO 使用

```
LCD_DC:    GPIO 5   (数据/命令切换)
LCD_RST:   GPIO 4   (硬件复位)
LCD_BLK:   GPIO 6   (背光, 可 PWM 调节亮度)
TOUCH_IRQ: GPIO 8   (触摸中断, 低有效)
```

### 面包板布局建议

```
┌─────────────────────────────────────────┐
│  电源轨(+)  │ a b c d e │ f g h i j │  电源轨(+)  │
│  电源轨(-)  │           │           │  电源轨(-)  │
├─────────────┼───────────┼───────────┼─────────────┤
│ 3V3 → (+)  │  ESP32-S3 开发板横插   │             │
│ GND → (-)  │  (占 a-e 和 f-j)      │             │
│             │           │           │             │
│             │  屏幕接线从右侧排针    │             │
│             │  引出到面包板空闲行    │             │
└─────────────┴───────────┴───────────┴─────────────┘
```

实际上因为 ESP32 和屏幕都有排针，最简单的方式是**母对母杜邦线直连**，面包板仅在需要分线（如多个 GND）时使用。

---

## 8. RPK 包传输方案

### 问题
没有 SD 卡，如何把 RPK 应用包从电脑传到 ESP32？

### 方案: 通过 USB Type-C 烧写到 Flash 分区

ESP32-S3 开发板有两个 Type-C 口，我们利用这个优势：

#### 方案 A: esptool 直接写 Flash 分区（推荐）

```bash
# 编译 RPK 后, 直接烧写到 Flash 的 rpk_store 分区
esptool.py --port /dev/cu.usbserial-* write_flash 0x310000 my_app.rpk
```

- 利用 `partitions.csv` 中定义的 `rpk_store` 分区 (起始地址 0x310000, 大小 ~13MB)
- 和烧固件一样, 通过 COM 口 (CH343) 传输
- 速度: 约 2MB/s (921600 波特率)
- 无需额外软件, ESP-IDF 自带 esptool

#### 方案 B: USB-OTG 虚拟 U 盘（进阶, 后期可选）

```
电脑 ←USB→ ESP32 USB-OTG 口
           ↓
    ESP32 模拟为 USB Mass Storage
           ↓
    电脑直接拖拽 RPK 文件到 "U盘"
           ↓
    文件写入 Flash/SPIFFS 分区
```

- 更友好, 像拷贝文件到U盘一样
- 需要额外固件代码 (TinyUSB MSC)
- 作为 v2 优化方案

#### 方案 C: 串口命令传输

```
电脑 ←串口→ ESP32
      发送: upload rpk <size>
      传输: 二进制数据流 (XMODEM 或自定义协议)
      ESP32 接收后写入 Flash
```

- 适合调试期间快速更换 RPK
- 需要简单的命令行 host 工具

### 推荐优先级

1. **方案 A** (esptool 写 Flash) — 最简单, 零额外开发, 现在就能用
2. **方案 C** (串口传输) — 调试方便, 少量开发
3. **方案 B** (USB U盘) — 产品化体验最好, 开发量最大

---

## 9. 注意事项

1. **SPI 速率**: ILI9341 最高支持 10MHz (读) / 40MHz (写); XPT2046 最高 2.5MHz — 切换设备时需调速率
2. **电阻触摸校准**: 首次使用需要执行触摸校准程序, 保存校准矩阵到 NVS
3. **背光功耗**: 2.8寸背光功耗较大 (~80mA), USB 供电即可
4. **面包板接线**: 杜邦线连接, 注意 SPI 线尽量短 (< 10cm) 以保证信号质量
5. **GPIO 冲突检查**: 所选 GPIO (4-13) 均为通用 IO, 不与 Flash/PSRAM (GPIO 26-37 内部占用) 冲突
6. **供电**: 开发阶段直接 USB 供电 (5V/500mA 足够驱动 ESP32 + 屏幕)
7. **杜邦线质量**: 如果遇到显示闪烁/花屏, 优先检查杜邦线接触是否良好

---

## 10. 下一步

- [ ] 准备 14 根杜邦线，按第 7 节完成触摸 SPI 三线并联
- [x] 安装并锁定 ESP-IDF v5.4 与 ESP32-S3 工具链
- [x] 完成 ILI9341 + XPT2046 驱动代码
- [x] 编译并真机验证 LVGL 显示初始化 (240×320)
- [ ] 烧录 minimal 固件并验证 XPT2046 点击坐标
- [ ] 实现触摸校准流程
- [ ] 通过 esptool 测试 RPK 烧写到 Flash 分区
- [ ] (后期) 购入 MicroSD 卡, 启用 SD 卡 RPK 加载

## 11. 2026-09-01 构建状态

- 工程：`quickapp-kit-ai/quickapp-embedded/quickapp-device-esp32`。
- 修复组件迁移后的根目录解析：由顶层 `QUICKAPP_KIT_ROOT` 统一指向
  `quickapp-kit-ai`，组件不再各自使用易失效的相对层级。
- 修复 minimal 模式：顶层根据 `main/minimal.mode` 唯一设置 `QA_MINIMAL`，
  Main 与 Runtime 组件只消费该开关。
- 当前机器未发现 `~/esp/esp-idf/export.sh`；实际可用且已验证的是工程内锁定环境，
  统一通过 `source ./activate.sh` 激活。脚本已内置
  `IDF_SKIP_CHECK_SUBMODULES=1`。
- 验证命令：`source ./activate.sh && idf.py reconfigure && idf.py build`。
- 结果：minimal 固件构建通过，`build/quickapp_device.bin` 为约 `562 KB`，
  最小应用分区剩余 `82%`。
- 当前 `/dev/cu.usbserial-1130` 不在线，因此本轮没有烧录；补齐触摸接线并连接
  COM 口后执行：`source ./activate.sh && idf.py -p /dev/cu.usbserial-1130 flash monitor`。
