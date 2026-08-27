# 穿戴 Showcase 能力补齐与执行计划

## 目录

- [需要补齐的能力](#需要补齐的能力)
- [Agent 分工](#agent-分工)
- [执行顺序](#执行顺序)
- [Agent A 提示词：LVGL 穿戴平台能力](#agent-a-提示词lvgl-穿戴平台能力)
- [Agent B 提示词：穿戴 Showcase DSL](#agent-b-提示词穿戴-showcase-dsl)
- [总结](#总结)

---

## 需要补齐的能力

| # | 能力 | 所属仓库 | 说明 |
|---|------|----------|------|
| C1 | Simulator viewport 参数化 + 圆形裁剪 | quickapp-runtime-lvgl + quickapp-examples | `--viewport 240x240 --shape round` |
| C2 | scroll/list 容器 LVGL Mount 验证 | quickapp-runtime-lvgl | 确认 scroll 容器在 MountHost 中正确创建可滚动 LVGL obj |
| C3 | 穿戴 Showcase DSL + RPK 构建 | quickapp-examples | 两个真实联盟 DSL 案例 |

## Agent 分工

### Agent A：LVGL Platform（quickapp-runtime-lvgl + quickapp-examples/composition）

负责 C1 + C2，是 Showcase 的前置依赖。

### Agent B：Showcase DSL（quickapp-examples/showcases）

负责 C3，等 Agent A 完成后启动（或可并行编写 DSL，但运行验证需要 A 完成）。

## 执行顺序

```
Agent A (C1 + C2)
    │
    │ 完成后
    ▼
Agent B (C3)
    │
    │ 完成后
    ▼
最终验收（真实 RPK 在圆形/椭圆 viewport 运行）
```

Agent B 的 DSL 编写可以和 Agent A **并行**（不依赖运行环境），但 RPK 运行验证必须等 A 完成。

---

## Agent A 提示词：LVGL 穿戴平台能力

```
你是 QuickApp Kit 的 LVGL 平台 Agent。

工程目录：
- /Users/qy/code/my-github/quickapp-kit-ai/quickapp-runtime-lvgl
- /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples

任务：为穿戴设备 Showcase 补齐 LVGL Simulator 的平台能力。

### 任务 1：Simulator viewport 参数化 + 圆形裁剪

修改 quickapp-examples/composition/case001_lvgl.cpp 中的 Simulator 入口：

1. 新增 --viewport <W>x<H> 参数，允许指定逻辑视口尺寸（默认保持 720x1280）
2. 新增 --shape round 参数：
   - 创建 display 后对 Page Root 设置 lv_obj_set_style_radius(root, LV_RADIUS_CIRCLE, 0)
   - 设置 lv_obj_set_style_clip_corner(root, true, 0)
   - 设置 lv_obj_set_style_bg_color(root, lv_color_black(), 0) 作为圆形外区域
3. --viewport 240x240 --shape round → 模拟圆形手表
4. --viewport 194x368 → 模拟椭圆手环（不需要 clip，矩形即可）
5. --zoom 仍然生效，作用于最终 SDL 窗口像素大小

SDL 窗口大小 = viewport * zoom。

### 任务 2：scroll/list 容器 LVGL Mount 验证

确认当前 LVGL MountHost 对 scroll 和 list Host Component 的处理：

1. 在 quickapp-runtime-lvgl/src/mount/mount_host.cpp 中检查是否已处理 scroll/list 类型
2. 如果未处理：为 scroll 创建一个 lv_obj 并设置 LV_OBJ_FLAG_SCROLLABLE + 纵向滚动方向
3. list 当作 scroll 的语义别名处理即可（不需要复杂虚拟列表）
4. 确保子节点正确挂载到 scroll 容器内部

### 验证

1. 现有 Showcase 回归：

SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/gallery-001/dist/gallery-001.rpk
# exit=0, resources_released=true

2. viewport 参数验证：

./build-m1-s2/quickapp_lvgl_simulator \
  --rpk showcases/wearable-001/dist/wearable-001.rpk \
  --viewport 240x240 --shape round
# simulator.ready, display=240x240, shape=round

3. LVGL CTest 回归：lv_s04 相关测试通过

### 不允许

- 不修改 quickapp-runtime-core、quickapp-runtime-js、quickapp-toolkit
- 不修改公共 Contract、Schema、Bridge
- 不修改现有 Showcase 的 DSL 或 RPK
- 不新增 Host Component 类型（scroll/list 使用既有 View 的可滚动变体）
- 不改变 Core Runtime Tree、Navigation、Event Router

### 完成标志

- --viewport 和 --shape 参数可用
- 圆形裁剪在 SDL 窗口中生效
- 现有 Gallery/Consumer/Wearable Showcase 回归 exit 0
- 追加验证证据到 quickapp-runtime-lvgl/evidence/
```

---

## Agent B 提示词：穿戴 Showcase DSL

```
你是 QuickApp Kit 的穿戴 Showcase 开发 Agent。

完整设计指令见：
/Users/qy/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/v3/v1-basic-runtime/AGENT-WEARABLE-SHOWCASE.md

工程目录：
/Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples/showcases/

任务：实现两个穿戴设备 Showcase RPK。

### 前置条件

Agent A 已完成 LVGL Simulator 的 --viewport 和 --shape round 支持。
如果你先于 Agent A 开始，可以先完成 DSL 编写和 Toolkit 构建验证，
运行验证等 Agent A 完成后再执行。

### 执行步骤

1. 创建 wearable-fitness-watch 目录结构
2. 编写 manifest.json（entry: pages/Home, routes: Home/Goals/Detail）
3. 编写 Home/Goals/Detail 三个页面的 .ux 文件
4. 准备 32x32 PNG 图标资源（可用简单色块代替）
5. 编写 build-wearable-fitness-watch.mjs 构建脚本
6. 验证 Toolkit 构建 + 两次确定性
7. 重复以上步骤创建 wearable-fitness-band
8. 使用 LVGL Simulator 运行验证：

cd /Users/qy/code/my-github/quickapp-kit-ai/quickapp-examples
SDL_VIDEODRIVER=dummy ./build-m1-s2/quickapp_case001_lvgl \
  --rpk showcases/wearable-fitness-watch/dist/wearable-fitness-watch.rpk
# exit=0, resources_released=true

./build-m1-s2/quickapp_lvgl_simulator \
  --rpk showcases/wearable-fitness-watch/dist/wearable-fitness-watch.rpk \
  --viewport 240x240 --shape round
# simulator.ready

### 设计要点

圆形手表（240x240）：
- 深色背景 #1a1a2e
- Home 居中布局：大字步数 + 三列小数据 + 底部按钮
- Goals 紧凑列表，每项 44px 高度
- 文字在内切圆安全区内（左右至少留 20px margin）

椭圆手环（194x368）：
- 深色背景 #0f0f1a
- 竖向卡片流，每个卡片 #16213e 圆角
- scroll 容器包裹 Goals 列表
- 按钮宽度 ≤ 160px

### 不允许

- 不修改 quickapp-runtime-core、quickapp-runtime-js、quickapp-runtime-lvgl、quickapp-toolkit
- 不引入 system.fetch、system.timer、system.device 或其他未验证 Feature
- 不手写 Page IR 或 RenderTransaction
- 只使用：div, text, input[type=button], image, scroll, list
- 只使用：if, for(tid=), onclick, {{ binding }}
- 只使用：system.router, system.prompt

### 完成标志

- 两个 Showcase RPK 各构建两次 SHA-256 一致
- Toolkit npm test 回归通过
- LVGL 自动验收 exit 0 + resources_released=true
- 追加交接记录到 INTEGRATION-HANDOFF.md
```

---

## 总结

| Agent | 仓库 | 任务 | 可并行 |
|-------|------|------|--------|
| Agent A | quickapp-runtime-lvgl + examples | viewport 参数化 + 圆形裁剪 + scroll 验证 | 先行 |
| Agent B | quickapp-examples/showcases | 两个穿戴 Showcase DSL + RPK | DSL 可并行，运行验证串行 |

建议：先启动 Agent A，同时启动 Agent B 写 DSL；Agent A 完成后 Agent B 做最终运行验证。
