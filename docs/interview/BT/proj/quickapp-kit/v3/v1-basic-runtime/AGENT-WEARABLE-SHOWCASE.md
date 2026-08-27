# Agent 指令：穿戴设备 RPK Showcase

## 你的身份

你是 QuickApp Kit 的穿戴设备 Showcase 开发 Agent。你的任务是用现有 Runtime 能力，设计并实现面向圆形手表（240x240）和椭圆手环（194x368）的经典运动健康快应用 RPK。

## 目标

产出两个可构建、可运行的 Showcase RPK，展示 QuickApp Kit 嵌入式 Runtime 在穿戴设备上的完整能力闭环：

1. `wearable-fitness-watch` — 圆形手表 240x240，运动表盘风格
2. `wearable-fitness-band` — 椭圆手环 194x368，竖向卡片流风格

## 工程位置

```
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-fitness-watch/
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/wearable-fitness-band/
```

每个 Showcase 目录结构：

```
├── README.md
├── scripts/
│   └── build-<name>.mjs
├── src/
│   ├── app.ux
│   ├── manifest.json
│   ├── assets/images/   (本地 32x32 PNG)
│   └── pages/
│       ├── Home/index.ux
│       ├── Goals/index.ux
│       └── Detail/index.ux
└── dist/               (构建产物)
```

## 设计约束

### 屏幕形态

| 目标 | 逻辑分辨率 | 安全区域 | 布局策略 |
|------|-----------|----------|----------|
| 圆形手表 | 240x240 | 内切圆 r≈100 区域避免角落裁切 | 居中布局、环形进度、紧凑文字 |
| 椭圆手环 | 194x368 | 上下各留 16px、左右各留 12px | 竖向卡片流、纵向滚动列表 |

### 设计原则

- 文字精简，单行不超 8 个汉字
- 可交互区域 ≥ 44x44 逻辑像素（适应手指误触）
- 优先纵向滚动，避免横向操作
- 数据用数字 + 单位，不用长句描述
- 颜色使用深色背景 + 亮色强调（穿戴设备省电）
- 动效克制：无复杂过渡动画，状态切换即时生效

### 视觉风格

```
背景：#1a1a2e 或 #0f0f1a（深色）
主色：#00d4aa（活力绿/健康色）
辅助色：#ff6b6b（心率红）、#4ecdc4（步数青）、#ffe66d（卡路里黄）
文字：#ffffff（主）、#8892b0（次）
卡片：#16213e 带 4px 圆角
```

## 页面规划

### Home — 运动数据表盘

圆形手表版：
- 中心大字：今日步数（如 `6,842`）
- 环形进度条（用 View + 背景色模拟扇区填充）
- 下方三列小数据：心率 / 卡路里 / 距离
- 底部一个"查看目标"按钮

椭圆手环版：
- 顶部步数卡片
- 中间三个竖排数据卡片（心率/卡路里/距离）
- 底部"查看目标"按钮
- 纵向可滚动

数据来源：纯本地 state mock，不依赖 system.fetch 或传感器 API。

### Goals — 今日目标列表

- keyed for 列表：步行 10000 步 / 消耗 300 kcal / 站立 8 小时 / 喝水 8 杯
- 每项显示：图标 + 目标名 + 当前值/目标值 + 完成状态
- if 条件：已完成项显示"✓"标记
- 点击某项进入 Detail
- 点击"刷新"触发 state 更新（模拟数据变化）

### Detail — 目标详情

- 目标名称 + 大字当前值
- 进度描述文字
- 一张本地图标
- "返回"按钮 → router.back()

## 必须体现的 Runtime 能力

| 能力 | 在哪个页面 | 怎么体现 |
|------|-----------|----------|
| state 响应式更新 | Home / Goals | 步数/心率数值变化 |
| if 条件渲染 | Goals | 完成状态标记 |
| keyed for 列表 | Goals | 目标列表 + 重排 |
| Image 本地资源 | Home / Goals / Detail | 运动图标 |
| router.push / back | Goals → Detail → Goals | 页面导航 |
| system.prompt.showToast | Goals 刷新 | 操作反馈 |
| scroll 滚动 | Goals (手环版) | 列表超出屏幕 |

## 图片资源

使用 32x32 本地 PNG。需要准备以下图标（可用纯色方块 + 简单形状代替真实图标）：

- `steps.png` — 步行/脚印
- `heart.png` — 心率
- `fire.png` — 卡路里
- `water.png` — 饮水
- `target.png` — 目标/靶心

图片不需要精美设计，32x32 单色图标即可。重点是 RPK 打包和 LVGL Mount 能正确加载。

## 构建方式

参照现有 Showcase 的构建脚本模式：

```javascript
// scripts/build-<name>.mjs
// 调用 quickapp-toolkit 的 API 编译 src/ → dist/<name>.rpk
```

构建入口参考：`/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/gallery-001/scripts/build-gallery.mjs`

## 验收标准

1. `node scripts/build-<name>.mjs` 两次构建，RPK SHA-256 一致
2. RPK 内包含 manifest.json、app.js、页面 JS、页面 Page IR、runtime.json、assets/
3. manifest.json 声明正确的 entry route 和 features
4. Page IR 包含 View/Text/Button/Image、if、keyed for、click handler
5. Toolkit `npm test` 回归通过（不破坏现有 84+ 测试）
6. 可用以下命令加载运行：

```bash
cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/wearable-fitness-watch/dist/wearable-fitness-watch.rpk
```

7. 运行结果：首屏 Mount、state 更新、if/keyed for 增量、push/back、teardown 后资源归零

## 不允许做的事

- 不修改 `quickapp-runtime-core`、`quickapp-runtime-js`、`quickapp-runtime-lvgl` 的源码
- 不修改 `quickapp-toolkit` 的编译器或 CLI 逻辑
- 不修改公共 Contract、Schema 或 Bridge 协议
- 不引入 system.fetch、system.timer、system.device 或任何未验证的 Feature
- 不手写 Page IR、RenderTransaction 或 MountTransaction
- 不伪造运行通过结果
- 不新增 LVGL 组件类型或渲染能力

## 可以参考的现有案例

- `showcases/wearable-001/` — 已有的穿戴 Showcase，220x220 视口
- `showcases/gallery-001/` — 完整的构建脚本和运行验收模板
- `showcases/consumer-001/` — 多图片、列表、状态更新

## 产出物

完成后提交到 quickapp-examples 仓库，并在 INTEGRATION-HANDOFF.md 末尾追加一节交接记录，包含：

- RPK 路径和 SHA-256
- 两次构建确定性验证
- 自动验收命令和结果
- 截图需求（标注为 PENDING_MANUAL_SCREENSHOT）

## 补充：当前 Toolkit 支持的 DSL 能力白名单

```
组件：div (View), text, input[type=button] (Button), image, scroll, list
指令：if, for (tid= 指定 key)
事件：onclick
绑定：{{ expression }}
路由：@system.router (push / back)
能力：@system.prompt (showToast)
样式：width, height, margin, padding, flexDirection, justifyContent,
      alignItems, backgroundColor, color, fontSize, textAlign, borderRadius
```

超出此范围的组件、指令或 API 当前不可用。不要使用 `<canvas>`、`<video>`、`<web>`、`<tabs>` 等。

## 开始

直接开始编码。先完成 `wearable-fitness-watch`，验证通过后再做 `wearable-fitness-band`。
