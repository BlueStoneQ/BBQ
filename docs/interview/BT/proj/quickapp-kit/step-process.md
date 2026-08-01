# QuickApp Kit 工作交接文档

> 最后更新：core Step 10 完成时
> 本文档是新会话的唯一入口。读完本文档 + 一个标杆 step 即可继续工作。

---

## 一、项目定位

一套多平台快应用运行时框架。兼容现有快应用 DSL 和核心 API，以 C++ 作为跨平台基座，对接不同平台的渲染端。

**最终目标：** 通过文档驱动实现的方式，反向建设快应用框架解决方案的技术与架构能力。

**输入：** 标准快应用 RPK 包（ZIP），由工具链从 `.ux` DSL 编译产出。Runtime 不含编译器，只消费产物。

```text
应用层    QuickApp RPK (.ux → 编译 → RPK)
    ↓
JS 引擎层  QuickJS / framework.js / page bundles
    ↓ JS Bridge（零序列化）
C++ Core  Router · VNode · StyleResolver · Layout · EventLoop · RenderPipeline
    ↓ PlatformBridge
平台层    Android View │ iOS UIKit │ C++/LVGL（嵌入式）
```

---

## 二、仓库位置

```text
代码仓库
/Users/qiaoyang/code/my-github/quickapp-kit/
└── quickapp-runtime-android/     ← 唯一已有代码的项目（可编译运行）

文档仓库
/Users/qiaoyang/code/my-github/BBQ/docs/interview/BT/proj/quickapp-kit/
├── step-process.md               ← 本文档
├── dev-context.md                ← 项目总上下文
├── rpk.md                        ← RPK 包结构分析
├── quickapp-runtime-android/spec/ ← 已完成（密度标准来源）
├── quickapp-runtime-core/spec/    ← 进行中
├── quickapp-runtime-cpp/          ← 空
├── quickapp-reuntime-ios/         ← 空（目录名有 typo: reuntime）
├── quickapp-runtime-js/           ← 由另一个 agent 负责
└── quickapp-toolkit/              ← 由另一个 agent 负责

规范文件
/Users/qiaoyang/code/my-github/BBQ/.kiro/steering/step-writing-rules.md
```

---

## 三、当前进度快照

| 项目 | 状态 | 负责 |
|---|---|---|
| quickapp-runtime-android | 代码 + 13 steps 全部完成 | 已完成 |
| **quickapp-runtime-core** | **spec 三件套 + steps 01-10 完成，仅 11 待写** | **本 agent** |
| quickapp-runtime-cpp | 完全空 | 本 agent |
| quickapp-reuntime-ios | 完全空 | 本 agent |
| quickapp-runtime-js | 完全空 | 另一个 agent |
| quickapp-toolkit | spec + steps 01-09 完成，10 部分，11-14 待写 | 另一个 agent |

### core 已完成的文件

```text
quickapp-runtime-core/spec/
├── requirements.md    13 个需求，EARS 验收标准
├── design.md          架构/双主线/接口/正确性属性/错误模型/测试策略
├── tasks.md           5 Phase / 11 Step
└── steps/
    ├── 01-extract-strategy.md      抽取清单、边界划分、依赖剥离
    ├── 02-cmake-third-party.md     独立 CMake + QuickJS 编译
    ├── 03-log-abstraction.md       qa_log.h 日志抽象
    ├── 04-jsengine.md              JSEngine 接口 + QuickJSEngine
    ├── 05-eventloop-thread.md      RuntimeEventLoop + RuntimeThread
    ├── 06-platform-bridge.md       PlatformBridge + PlatformEventSink
    ├── 07-module-jsbridge.md       NativeModule + Registry + JS Bridge
    ├── 08-rpk-manifest.md          RPKLoader（手写 ZIP）+ ManifestParser
    ├── 09-vnode-style-layout.md    VNode + StyleResolver + LayoutEngine + RenderPipeline
    └── 10-runtime-bootstrap.md     framework.js + RuntimeBootstrap + RuntimeHost
```

### core 待写

```text
11-platform-integration.md  三端集成 —— 已写 2600 行，未完成
```

#### Step 11 的精确断点

已完成的小节：

```text
✓ 目标 + 目录
✓ 11.1 集成契约（平台层职责、只需 include 两个头文件、调用序列）
✓ 11.2 Android 替换实施
    11.2.1 记录基线（编译/so大小/logcat/截图/Kotlin签名）
    11.2.2 删除内嵌 core（45 个文件，剩 3 个）
    11.2.3 改写 CMakeLists.txt（add_subdirectory + FORCE 配置）
    11.2.4 改写 jni_bridge.cpp（3 部分：全局状态与JNI工具 / 6个Bridge实现+日志handler / 8个JNI导出函数）
    11.2.5 Kotlin 侧线程切换（uiHandler.post）
✓ 11.3 实测 Babel interop 风险（3 种可能结果 + 修复方案 + 测试固化 + 真机验证）
✓ 11.4 Android 回归验证（编译/产物对比/运行/截图/交互/生命周期/反复启动/清理）
✓ 11.5 iOS 集成方案（CMake生成Xcode + QuickAppViewRenderer完整ObjC++ + PlatformBridge 6实现 + QuickAppRuntime封装 + 5条注意事项）
✓ 11.6.1 LVGL 构建配置（CMakeLists）
✓ 11.6.2 LVGL 内存约束调整（quickapp_lvgl_config.h + 发现的 Core 接口缺口）
✓ 11.6.3 LVGL Widget 渲染器（lvgl_renderer.cpp 完整实现）
✓ 11.6.4 前半（文件行 2668-3247）
    - 补 lvgl_renderer.h（11.6.3 的 .cpp include 了它但没写）
    - 修正 11.6.3 的 bug：ClickCallback 别名原本在匿名 namespace，
      导致对外函数 initRenderer 的参数类型跨编译单元不可见 → 已提到头文件
    - 线程模型方案 A / 方案 B 对比表 + 选 A 的三条理由
    - @update quickapp_lvgl_config.h 追加队列常量
      （kMaxKeyLength=24 / kMaxValueLength=64 / kCommandQueueCapacity=512
        / kQueuePushTimeoutMs=200 / kPumpIntervalMs=5，含容量估算算术）
    - lvgl_bridge.h 完整（launch / shutdown / host 三个函数）
    - lvgl_bridge.cpp 第一部分：RenderCommand 结构 + copyBounded
      + RenderCommandQueue 类（ring buffer + mutex + condvar，
        push 带超时背压、pop 非阻塞、close/reopen）
✓ 11.6.4 后半 a-f（文件行 3248-3775，会话 A 完成）
    - a. 全局状态（g_queue / g_host / g_pumpTimer / g_root / g_rpkData）
    - b. 6 个 PlatformBridge 实现（lvglCreateElement/SetAttr/SetStyle/
         SetEvent/RemoveElement/ShowToast，只 push 不碰 lv_*）
    - c. pumpTimerCb（lv_timer 回调，循环 pop 分发到 renderer，
         每 tick 上限 kCommandQueueCapacity 条防饿死 LVGL 重绘）
    - d. onLvglClick（PlatformEventSink 通道，不走队列，
         直接调 g_host->dispatchClick）
    - e. lvglLogHandler（printf + fflush，LOG_BACKEND=CALLBACK）
    - f. launch() / shutdown() / host() + unwindPlatformState 清理函数
```

待写的小节：

```text
🔲 11.6.4 后半 g-h（紧接 3775 行往下写）
          g. 方案 B 若要落地需要的 Core 改动：
             RuntimeEventLoop 加 runOnce(timeoutMs)、
             RuntimeHostConfig 加线程模式开关、
             RuntimeHost 内部 RuntimeThread 变可选 + 暴露 pumpOnce()
          h. 11.6.4 的验证：编译 + 队列压满测试 + TSan
🔲 11.6.5 SDL 模拟器（sim/sdl_driver.h/.cpp + sim/main.cpp）
          sdl_driver：SDL 窗口 + texture、lv_disp_draw_buf/flush_cb、
                     鼠标 indev read_cb、lv_tick_inc 来源
                     注意 lv_conf.h 的 LV_COLOR_DEPTH 32（目标板常是 16）
          main.cpp：读 RPK 文件（桌面做 IO，Core 不做 —— 决策 4）→ lv_init
                   → 建 root 容器 → lvgl::launch → 主循环
                   （SDL_PollEvent + lv_timer_handler + lv_tick_inc + delay）
                   → 退出时 lvgl::shutdown
          给出 cmake/运行命令 + 预期 stdout
🔲 11.7 三端对照与验证清单（表格：6个Bridge函数在三端的实现方式对照 +
          各端必做验证项 + 三端差异汇总）
🔲 技术决策（预计 8-10 条）
          必须包含：为什么 Android 保留 .so 名不变、
          为什么线程切换放平台层而非 Core、
          iOS 的 px→pt 转换、LVGL 的字体档位限制、
          Core 接口缺口（JSEngineLimits）的发现与补充
          11.6.4 已经定下、技术决策里要收口的（不要推翻）：
            - 选方案 A：Core 零改动 + 三端集成代码形状一致 + 长 JS 不卡帧
            - 命令队列用静态 ring buffer + 定长字符串：躲开堆碎片，
              代价是 value 超 63 字节截断（截断记 WARN，不静默）
            - 队列满时阻塞背压而非丢命令：丢 create 会让 LVGL 视图树与
              VNode 树永久不一致；带 200ms 超时避免 Runtime Thread 永久挂住
            - 队列容量必须装下整个首屏：start() 阻塞期间没人消费队列
            - LVGL showToast 用 lv_layer_top + lv_obj_del_delayed，
              不用 msgbox（msgbox 要手动关）
🔲 QA（预计 8-10 条）
🔲 下一步（指向 cpp 项目）
```

#### Step 11 发现的 Core 接口缺口（需回改）

集成 LVGL 时发现 `QuickJSEngine::initialize` 硬编码了 64MB heap（Step 04），
嵌入式设备跑不起来。需要补充配置入口：

```cpp
// include/js_engine.h 新增
struct JSEngineLimits {
    size_t heapLimit = 64 * 1024 * 1024;
    size_t stackLimit = 1024 * 1024;
};
std::unique_ptr<JSEngine> createJSEngine(const JSEngineLimits& limits);

// include/runtime_host.h 的 RuntimeHostConfig 新增字段
JSEngineLimits jsLimits;
```

改动 3 处，向后兼容（默认值不变）。已写入 Step 11.6.2，
但 Step 04 和 Step 10 的文档需要同步补充这个重载。

### PlatformBridge 6 个函数签名速查（来自 Step 06，免去回读全文）

```cpp
// C++ Core → Platform，单向。Core 在 Runtime Thread 调用，
// 平台实现负责投递到自己的 UI 执行上下文。
// 所有 const char* 只在函数返回前有效，要保存必须自行拷贝。
using CreateElementFn  = void (*)(int id, const char* type,
                                  float x, float y, float width, float height);
using SetAttrFn        = void (*)(int id, const char* key, const char* value);
using SetStyleFn       = void (*)(int id, const char* key, const char* value);
using SetEventFn       = void (*)(int id, const char* eventType,
                                  const char* methodName);
using RemoveElementFn  = void (*)(int id);
using ShowToastFn      = void (*)(const char* message);

bool isReady() const;   // 只检查 createElement/setAttr/setStyle 三个必填项

void registerPlatformBridge(PlatformBridge bridge);   // 按值传，Core 存副本
const PlatformBridge& getPlatformBridge();
void clearPlatformBridge();

// Platform → C++，独立通道（不要塞进 PlatformBridge）
// dispatch* 可从任意线程调用，处理器在 Runtime Thread 执行
PlatformEventSink::initialize(RuntimeEventLoop*, EventHandler);
PlatformEventSink::shutdown();          // 之后到达的事件被丢弃
PlatformEventSink::dispatchClick(int nodeId);
PlatformEventSink::dispatchInput(int nodeId, const char* text);
PlatformEventSink::dispatchChange(int nodeId, const char* value);
PlatformEventSink::dispatchLifecycle(const char* name);
PlatformEventSink::isActive();
```

`RuntimeEventLoop` 只有阻塞式 `run()`，**没有** `runOnce()` —— 这是
11.6.4 方案 B 需要新增 Core 接口的原因。

### Step 10 已产出的对外 API（Step 11 的集成入口）

平台层只需 include 两个头文件：`platform_bridge.h` + `runtime_host.h`

注：`getTitleBarConfig` 的输出参数是 `std::string&` 引用，不是指针：

```cpp
bool getTitleBarConfig(const char* pageName, std::string& outTitle,
                       std::string& outBgColor, std::string& outTextColor) const;
```

```cpp
RuntimeHost host;
RuntimeHostConfig cfg;
cfg.bridge = /* 平台实现的 6 个函数指针 */;
cfg.rpkData = data; cfg.rpkSize = size;
cfg.viewportWidth = w; cfg.viewportHeight = h;

host.create(cfg);      // 校验配置 + 注册 bridge
host.start();          // 阻塞，返回时首屏已渲染（约 12ms 桌面 / 30-50ms 移动）
host.dispatchClick(nodeId);
host.dispatchInput(nodeId, text);
host.dispatchLifecycle("onShow");
host.navigateTo("/pages/X");
host.setViewport(w, h);
host.destroy();        // 逆序清理，幂等

// 诊断
host.state();          // Created/Starting/Running/Stopping/Destroyed/Failed
host.failedStage();    // 11 个阶段名之一
host.getLastError();
host.getTitleBarConfig(page, &title, &bg, &fg);   // 平台渲染标题栏用
```

Step 10 新增源文件：`src/runtime_bootstrap.cpp`、`src/runtime_host.cpp`
Step 10 新增构建产物：`js/framework.js` + `cmake/embed_js.cmake` → `build/generated/framework_js.h`

### Step 09 已产出的关键接口（Step 10 会用到）

```cpp
// render_pipeline.h
RenderPipeline::initialize(engine, viewportW, viewportH);  // 注册 __native_render__ 真实处理器
RenderPipeline::findNode(nodeId) -> VNode*;                // 事件处理时按 ID 找节点
RenderPipeline::currentRoot() -> VNode*;
RenderPipeline::shutdown();                                // 必须在 engine.destroy 之前

// vnode.h
node->events.at("click")   // 得到 VM 方法名，Step 10 用它调 JS
```

Step 09 新增的源文件（已在 CMakeLists 中）：
`src/vnode.cpp`、`src/style_resolver.cpp`、`src/layout_engine.cpp`、`src/render_pipeline.cpp`

---

## 四、文档密度标准（硬性要求）

**基准文件：** `quickapp-runtime-android/spec/steps/02-platform-bridge-jni.md` 和 `core/spec/steps/04-jsengine.md`。

每个 step 必须包含以下结构：

```text
1. 一级标题：# Step N：主题
2. 目录（锚点链接，覆盖所有二级标题）
3. 目标
   - 一句话结论（加粗）
   - 职责表格（层 / 职责 / 文件）
   - 验收标准（可执行的检查项）
   - 本步不包含（明确边界，指向后续 Step）
4. 分小节实操步骤（Step N.1 / N.1.1 ...）
5. 完整可粘贴代码（不用省略号，不写「此处略」）
6. 逐层验证（编译 → 测试 → sanitizer → 专项验证 → 平台无关性回归）
   每个验证给出命令 + 预期输出 + 常见错误排查
7. 技术决策（6-9 条，说明为什么这样做，含对比表格）
8. QA（7-10 条，回答实现者会问的问题）
9. 下一步（指向下一个 step）
```

### 代码变更标注

```text
@add <文件路径>（新建文件）
@add <文件路径> — 在 <位置描述> 后插入
@update <文件路径> — 替换 <位置描述>
@update <文件路径>（整个替换）
```

### 代码注释要求（用户明确强调，不可省略）

- **函数**：`@param` 说明每个参数的含义、单位、取值范围；`@return` 说明返回值语义（成功/失败条件）
- **类**：说明职责、线程所有权、生命周期、与其他类的协作关系
- **结构体字段**：逐字段说明
- **关键决策点**：注释说明"为什么这样做"，不重复"是什么"
- **对 C++ 初学者友好**：函数指针、匿名 namespace、RAII、JNI 引用规则、`const_cast`、`memory_order` 等给简短解释

标准示例：

```cpp
/**
 * 创建一个平台元素。
 * @param id     节点 ID，Core 生成，后续用来更新/删除
 * @param type   节点类型："text"、"div" 等
 * @param x      布局计算出的 X 偏移（物理像素）
 * @param width  布局计算出的宽度（物理像素）
 */
using CreateElementFn = void (*)(int id, const char* type,
                                 float x, float y, float width, float height);
```

### 术语规范

- 使用通用技术概念，不自创术语
- 禁用："能力合同"、"第一性"、"宿主"、"赋能"
- 容器 > 宿主；接口 > 能力；说明/解释 > 第一性解释
- PlatformBridge = 跨层通信通道（不再额外解释 bridge 是什么）

### 三条通道不能混写（架构上最容易出错的地方）

```text
JS Bridge         JS ↔ C++            QuickJS C API 直调，零序列化
PlatformBridge    C++ → Platform      渲染命令（createElement/setAttr/setStyle/setEvent/removeElement）
PlatformEventSink Platform → C++      事件（click/input/change/lifecycle），独立通道
```

---

## 五、已确定的技术决策（贯穿所有文档，不要推翻）

### 架构层面

1. **PlatformBridge 用函数指针结构体，不用虚接口** — LVGL 端可能是纯 C，无法实现 C++ 虚类
2. **JS Bridge / PlatformBridge / PlatformEventSink 三通道独立** — 方向、线程规则、生命周期都不同
3. **Core 不负责 UI 线程调度** — 平台实现 PlatformBridge 时自行投递到各自 UI 线程
4. **Core 不做文件 IO** — RPKLoader 只接收 `const uint8_t* + size_t`，平台负责读文件
5. **Runtime 不包含编译器** — 只消费 RPK 产物
6. **单 Runtime 假设** — PlatformBridge 和 ModuleRegistry 用全局单例，多 Runtime 是 V2
7. **Core 编译为静态库** — 三端通过 CMake `add_subdirectory` 引入

### 实现层面

8. **日志通过 `QA_LOGI/W/E` 宏** — 编译期后端（STDERR/CALLBACK）+ 运行期 `setLogHandler` 回调
9. **JSEngine 抽象保留 `getRawContext()` 逃生口** — JS Bridge / ManifestParser / VNode 三处需要
10. **JS 资源边界** — `JS_SetMemoryLimit(64MB)` + `JS_SetMaxStackSize(1MB)` + 微任务 10000 上限
11. **NativeModule + Registry 模式** — 新增模块零改 `js_bridge.cpp`，方法挂 prototype 共享
12. **JSClass finalizer 必须为空** — 模块实例归 Registry，不随 JS 对象 GC 释放
13. **`$app_require$` 未知模块返回 undefined 而非抛异常** — 让 framework.js 能回退查组件表
14. **JSON 解析复用 `JS_ParseJSON`** — 零新增依赖
15. **`JS_EVAL_TYPE_GLOBAL` 而非 MODULE** — RPK bundle 是 webpack IIFE，不是 ES Module

### V1 替代方案（因网络无法访问 GitHub，需在文档中如实反映）

| 原计划 | 实际实现 | 接口兼容 | 替换时机 |
|---|---|---|---|
| libuv | `posix_event_loop`（mutex + condvar + min-heap） | ✓ RuntimeEventLoop 不变 | 需要 fetch/socket 时 |
| Yoga | 手写 `layout_engine`（column + width/height/margin/padding） | ✓ calculateLayout 签名不变 | 需要完整 Flex 时 |
| minizip | 手写 ZIP Central Directory 解析 + zlib inflate | ✓ RPKLoader 不变 | 无需替换 |
| cJSON | QuickJS `JS_ParseJSON` | ✓ ManifestParser 不变 | 无需替换 |
| GoogleTest | 自定义 `CHECK` 宏 + `ctest` | — | 网络恢复后可升级 |

---

## 六、待验证风险点（必须实测确认）

### 风险 1：Babel interop 导致 `$app_require$` 返回值多一层 default

**现象描述：**

core 原 `tasks.md` 的 Step 05 验收标准写的是：

```javascript
$app_require$("@app-module/system.router").default.push({uri:"/test"})
```

注意 `.default`。而 core Step 07 实现的 `native_app_require` 直接返回模块对象，测试写的是：

```javascript
$app_require$("@app-module/system.router").push({uri:"/test"})
```

**根因推测：**

如果工具链用 Babel 转换 ES Module 语法，`import router from '@system.router'` 会被编译为：

```javascript
var _interopRequireDefault = function(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
};
var _m = _interopRequireDefault($app_require$('@app-module/system.router'));
_m.default.push({uri: '/x'});          // 多了一层 .default
```

如果 Core 返回的对象没有 `__esModule` 标记，Babel 会把它包一层，实际调用变成 `_m.default.push`。而如果 Core 又额外提供了 `default` 字段，就会出现 `_m.default.default.push`。

**验证方法（Step 11 集成时必做）：**

```bash
# 解出真实 bundle 看编译产物形态
unzip -p <真实RPK> pages/Demo/index.js | grep -n "app_require\|interopRequire\|__esModule"
```

**两种备选实现：**

```cpp
// 方案 A：模块对象加 __esModule 标记，让 Babel 跳过包装
JS_SetPropertyStr(ctx, obj, "__esModule", JS_TRUE);
// 结果：_m 就是模块本身，_m.default 为 undefined
// 需要确认 bundle 用的是 _m.default 还是 _m

// 方案 B：模块对象加 default 自引用
JSValue self = JS_DupValue(ctx, obj);
JS_SetPropertyStr(ctx, obj, "default", self);
// 结果：_m.push 和 _m.default.push 都能用，兼容两种形态
// 代价：形成循环引用，需确认 QuickJS GC 能正确处理
```

**当前状态：** core Step 07 未加任何标记。此项在 Step 11 实测后决定，可能需要回改 Step 07 的 `native_module.cpp` 和对应 QA。

### 风险 2：setTimeout 被取消后回调函数的 JSValue 泄漏

core Step 07 的 `native_setTimeout` 用 `JS_DupValue` 增加了回调函数的引用计数，在三个路径释放：

```text
1. 回调正常执行后           ✓ 已实现
2. postDelayed 投递失败时    ✓ 已实现
3. Timer 被 cancelTimer 取消 ✗ 未实现
```

第 3 种情况下 lambda 被 EventLoop 丢弃时不会调 `JS_FreeValue`（`JSValue` 是 POD，无析构函数），回调函数对象会泄漏到 `JS_FreeRuntime` 才回收。

**影响评估：** 不是持续泄漏（Runtime 销毁时统一回收），但频繁 `setTimeout` + `clearTimeout` 的页面会累积。

**修复方案：** 用 RAII 包装 JSValue

```cpp
class ScopedJSValue {
    JSContext* ctx_;
    JSValue val_;
public:
    ScopedJSValue(JSContext* ctx, JSValue val) : ctx_(ctx), val_(val) {}
    ~ScopedJSValue() { JS_FreeValue(ctx_, val_); }
    ScopedJSValue(ScopedJSValue&&) noexcept;   // 移动构造
    JSValue get() const { return val_; }
};
```

**当前状态：** 已记录在 Step 07 的技术决策 6 中，标为 V2 修复项。

### 风险 3：`native_module.h` 依赖 quickjs.h 破坏了 PUBLIC/PRIVATE 边界

`include/native_module.h` 是 PUBLIC 头文件，但它 `#include "quickjs.h"`，而 QuickJS 的 include 路径在 CMake 里是 PRIVATE。

**后果：** 平台层如果 include `native_module.h` 会编译失败（找不到 quickjs.h）。

**当前规避：** 平台层不需要注册模块，所以不会 include 它。Step 11 需明确说明：平台特有能力应通过"加 PlatformBridge 函数指针 + Core 侧写模块转发"的方式实现（参考 `PromptModule` → `showToast`）。

**彻底解决：** 设计不依赖引擎类型的中间层函数签名 + 参数转换适配器（约 300 行），V2 工作。

### 风险 4：Yoga 替代品的能力缺口

手写 `layout_engine` 只支持：

```text
✓ flexDirection: column（垂直堆叠）
✓ width / height（固定值）
✓ margin / padding（四边）
✗ flexDirection: row
✗ justifyContent / alignItems
✗ flex-grow / flex-shrink / flex-basis
✗ 百分比尺寸
✗ 换行（flexWrap）
```

**影响：** 真实快应用的页面大量使用 row 布局和居中对齐。Step 09 必须明确这个边界，并在 Step 11 的验证里说明哪些页面能正确渲染、哪些会错位。

**当前状态：** Step 09 待写，需在"本步不包含"里如实列出，并给出 Yoga 替换的接口契约。

---

## 七、core 剩余 3 个 step 的内容大纲

### Step 09：VNode + StyleResolver + LayoutEngine

**产出文件：**

```text
include/vnode.h            + src/vnode.cpp
include/style_resolver.h   + src/style_resolver.cpp
include/layout_engine.h    + src/layout_engine.cpp
tests/test_vnode_layout.cpp
```

**必须覆盖的内容：**

1. VNode 结构体：`id / type / attrs / styles / events / classList / children / layout`
2. 节点 ID 全局自增分配
3. `buildVNode(JSContext*, JSValue templateObj)` 递归遍历 JS 模板对象
   - 处理 `attr` 里的函数值（数据绑定：`function(){ return this.title }`）需要以 VM 为 this 调用
   - 处理 `events` 映射：`{ click: 'goDetail' }`
4. StyleSheet 结构：选择器（`.wrapper`）→ 样式属性 map
5. `StyleResolver::resolve(VNode*, const StyleSheet&)` 按 classList 顺序叠加合并
6. `LayoutEngine::calculateLayout(VNode*, float w, float h)` 垂直堆叠 Flex
7. **接入 `setNativeRenderHandler`**：把 Step 07 的 `__native_render__` 桩替换为真实实现
8. 遍历 VNode 树发送 PlatformBridge 命令（参考 Step 06 的 6.2.3 调用约定）
9. 明确布局能力边界（见风险 4）+ Yoga 替换接口契约

**验证要点：** 3 节点树布局计算、classList 多类叠加覆盖、mock bridge 收到正确命令序列、ASan 无泄漏

### Step 10：RuntimeBootstrap + RuntimeHost + framework.js

**产出文件：**

```text
include/runtime_bootstrap.h + src/runtime_bootstrap.cpp
include/runtime_host.h      + src/runtime_host.cpp
js/framework.js
tests/test_bootstrap.cpp
```

**必须覆盖的内容：**

1. `framework.js` 完整实现（约 400 行）
   - `$app_define$(name, deps, factory)` 维护组件表
   - `$app_bootstrap$(name, options)` 创建 VM 实例
   - `$app_require$` 包装：先查 C++ 模块，undefined 则查组件表
   - VM 模型：private 数据初始化、method 绑定、`onInit`/`onShow`/`onReady` 生命周期
   - 模板求值：递归处理 `attr` 里的函数，以 VM 为 this
   - 调用 `__native_render__(evaluatedTemplate, style)`
2. framework.js 的两种加载方式（编译期字符串常量 vs 平台传入），给出选择
3. `bootstrapRuntime()` 完整启动序列（11 步，见 design.md 的 Data Flow）
4. `RuntimeHost` 四个方法：`create / start / dispatchEvent / destroy`
5. 事件处理器接线：`PlatformEventSink::initialize(loop, handler)`，handler 内查 VNode 找方法名调 JS
6. Router 的 `NavigateHandler` 接线：URI → `findPageByUri` → 读 bundle → eval → 渲染
7. **销毁顺序**（关键）：`EventSink.shutdown → EventLoop.stop → thread.join → Registry.clear → engine.destroy → clearPlatformBridge`

**验证要点：** mock RPK + mock bridge 完整启动、点击事件到达 JS 方法、router.push 触发页面切换、20 轮创建销毁无泄漏

### Step 11：三端集成指引

**必须覆盖的内容：**

1. **Android 替换**（有真实代码可验证）
   - 删除 `app/src/main/cpp/{core,third_party,platform/common}`
   - 改 `CMakeLists.txt` 用 `add_subdirectory(${CORE_DIR})`
   - `jni_bridge.cpp` 改为 include Core 的 PUBLIC 头文件
   - 实现 6 个 PlatformBridge 函数（含 runOnUiThread 投递）
   - 注册 `androidLogHandler`（见 Step 03 的 3.4 示例）
   - 事件回传：Kotlin → JNI → `PlatformEventSink::dispatchClick`
   - **验证：`./gradlew clean :app:assembleDebug` 仍然 BUILD SUCCESSFUL + 屏幕显示与抽取前一致**
   - **实测风险 1（Babel interop）并回写结论**
2. **iOS 集成**（桩实现，无真实工程）
   - Xcode 引入 Core：CMake 生成 Xcode project 或直接加源码
   - ObjC++ 实现 PlatformBridge（UILabel/UIView/UIButton）
   - `dispatch_get_main_queue()` 投递
   - `os_log` 日志 handler
   - Bitcode / 架构（arm64 + x86_64 模拟器）配置
3. **LVGL 集成**（桩实现）
   - CMake `add_subdirectory`
   - LVGL Widget 映射（`lv_obj_create` / `lv_label_create` / `lv_btn_create`）
   - 单线程环境下的 PlatformBridge（可能不需要投递）
   - `QA_LOG_BACKEND=CALLBACK` + `QA_LOG_MIN_LEVEL=3` 裁剪
   - 内存受限调整：`JS_SetMemoryLimit` 降到 8MB
4. 三端需实现的函数清单对照表
5. 抽取前后的回归对比（编译通过 / .so 体积 / logcat 输出一致）

---

## 八、cpp 和 ios 项目的规划

两个项目都以 Android 为标准，结构与 core 一致：

```text
<project>/spec/
├── requirements.md
├── design.md
├── tasks.md
└── steps/
    ├── 01-xxx.md
    ├── ...
    └── NN-integration-assembly.md   ← 每个平台必须有集成组装 step
```

### quickapp-runtime-cpp（LVGL 嵌入式）

建议 steps 划分：

```text
01-lvgl-env-setup.md        LVGL 环境 + 模拟器（SDL）搭建
02-cmake-integration.md     引入 Core 作为子项目
03-platform-bridge-lvgl.md  6 个渲染命令的 LVGL Widget 实现
04-widget-mapping.md        div/text/input → lv_obj/lv_label/lv_btn
05-style-mapping.md         CSS 样式 → lv_style_t
06-event-sink-lvgl.md       LVGL 事件回调 → PlatformEventSink
07-single-thread-model.md   单线程环境的适配（无需 UI 投递）
08-memory-constrained.md    内存裁剪：JS heap 8MB、日志裁剪、无 assets
09-titlebar-lvgl.md         标题栏渲染
10-integration-assembly.md  完整组装 + 在模拟器跑通示例 RPK
```

### quickapp-reuntime-ios（UIKit）

建议 steps 划分：

```text
01-xcode-project-setup.md    Xcode 工程 + Core 静态库集成
02-objcpp-bridge-basics.md   ObjC++ 混编基础 + PlatformBridge 骨架
03-platform-bridge-uikit.md  6 个渲染命令的 UIKit 实现
04-view-renderer.md          div/text/input → UIView/UILabel/UIButton
05-style-mapping.md          CSS 样式 → UIKit 属性
06-main-queue-dispatch.md    dispatch_get_main_queue 投递 + 线程安全
07-event-sink-ios.md         UIControl 事件 → PlatformEventSink
08-rpk-loading-ios.md        NSBundle / Documents 读 RPK
09-navigation-titlebar.md    导航栏 + 页面切换动画
10-integration-assembly.md   完整组装 + 模拟器跑通示例 RPK
```

---

## 九、新会话启动指令模板

### 继续写 core 剩余 steps

```text
读取以下文件，然后按密度标准为 quickapp-runtime-core 编写 Step 09：

1. #File BBQ/docs/interview/BT/proj/quickapp-kit/step-process.md
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/steps/04-jsengine.md
   （密度标杆，注意结构和注释密度）
3. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/steps/06-platform-bridge.md
   （Step 09 要用它的 PlatformBridge 调用约定）
4. #File BBQ/.kiro/steering/step-writing-rules.md

要求：
- 严格对齐密度标准第四节的 9 项结构
- 所有函数有 @param/@return，所有 class 说明职责/线程所有权/生命周期
- 完整可粘贴代码，不省略
- 逐层验证含编译/测试/ASan/专项/平台无关性回归
- 如实反映手写 layout_engine 的能力边界（见风险 4）
- 分段写入，每段不超过 100 行，避免连接中断
```

### 开始写 cpp 或 ios 项目

```text
读取以下文件，然后为 quickapp-runtime-cpp 编写 spec 三件套：

1. #File BBQ/docs/interview/BT/proj/quickapp-kit/step-process.md
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/requirements.md
3. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/design.md
4. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/tasks.md

要求：
- 结构对齐 core 的 spec 三件套
- 明确 cpp 项目只实现平台层，Core 作为依赖引入
- steps 划分参考交接文档第八节的建议
- 先只写 spec 三件套，确认后再写 steps
```

---

## 十、上下文管理（重要，已实测的根因）

core 已产出约 26000 行文档。写到 Step 11 时出现频繁的生成中断，
做过根因分析，结论如下。

### 失败机制

中断的表现是工具调用的 `text` 参数完全缺失 —— 输出在生成 tool call
中途被截断（`path` 已发出，`text` 未写完）。

原因不是单次内容太大，而是**对话历史挤占了输出额度**：

```text
每次请求 = 完整对话历史 + 本次输出
历史越大 → 留给输出的额度越小 → 截断概率越高
每完成一次交互，历史继续增长 → 单调恶化
```

### 关键结论：减小单次写入量无法解决

实测反例：一次失败之后紧接着成功写入了 230 行；而失败的几次里有只有
60 行的。**失败与块大小无相关性。**

小块只是压低单次需求，历史仍在涨。继续下去即使 30 行的块也会失败。
这解释了失败频率的变化：Step 08 零星出现 → Step 11 几乎每两次一次。

### 有效手段（按推荐顺序）

```text
1. 一个 step 一个会话（最彻底）
   写完一个 step → 更新本文档进度 → 开新会话
   新会话只需读：本文档 + 密度标杆（04-jsengine.md）+ 相关前置 step

2. /compact 压缩历史
   在 step 完成的间隙执行，不要在写文档中途执行

3. 子代理分发
   独立性强的 step 交给 general-task-execution，每个有独立上下文。
   prompt 里必须附上：本文档第四节的密度标准 + 指定密度标杆文件 +
   第五节的已定技术决策。产出后做术语和决策一致性检查
```

### 无效或收益有限的手段

```text
✗ 减小单次写入量 —— 见上，与失败无相关性
✗ 不回读已完成文档 —— 有帮助但不解决根因（历史仍在涨）
```

---

## 十一、下一步动作

```text
优先级 1a：core Step 11 的 11.6.4 后半 + 11.6.5（一个会话）
优先级 1b：core Step 11 的 11.7 + 技术决策 + QA + 下一步（另一个会话）
          两段的精确断点见第三节的"Step 11 的精确断点"
          分两个会话的原因见第十节：11.6.4 前半写完时会话已读入约 3300 行，
          再写就开始截断
优先级 2：回改 Step 04 和 Step 10，补充 JSEngineLimits 重载
          （见第三节的"Core 接口缺口"）
优先级 3：quickapp-runtime-cpp spec 三件套 + 10 个 steps
优先级 4：quickapp-reuntime-ios spec 三件套 + 10 个 steps
```

剩余工作量估算：约 25000 行。按第十节的建议，**每个 step 用独立会话**。

每完成一项，回来更新第三节的进度快照和第六节的风险状态。

### 会话 A：11.6.4 后半 + 11.6.5

```text
项目：QuickApp Kit —— 多平台快应用运行时框架，C++ Core 基座 + 三端渲染
     （Android View / iOS UIKit / C++ LVGL）。文档驱动实现。
当前：quickapp-runtime-core 的 spec 三件套 + steps 01-10 已完成，
     Step 11（三端集成）写到 3247 行，11.6.4 写了一半。
     另外两个项目（quickapp-runtime-js / quickapp-toolkit）由另一个 agent 负责，不要动。

本次任务：续写 11.6.4 的后半 + 11.6.5，写完就停，不要碰 11.7 及之后。

读这些（不要读别的，控制上下文）：
1. #File BBQ/docs/interview/BT/proj/quickapp-kit/step-process.md
   看第三节的"Step 11 的精确断点"（11.6.4 后半的 a-h 子项 + 11.6.5 要覆盖什么）、
   "PlatformBridge 6 个函数签名速查"、第四节密度标准、第五节已定技术决策。
   不需要再读 06-platform-bridge.md，签名速查已经够用。
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/steps/11-platform-integration.md
   只读 2197 行（## Step 11.6）到末尾。11.6.4 前半已经定了方案 A、
   RenderCommandQueue 的接口（push/pop/close/reopen）、
   quickapp_lvgl_config.h 的 5 个队列常量，后半必须接着这些写，不要重新设计。

硬性要求：
- 用 fs_append 续写，文件当前最后一行是 RenderCommandQueue 之后的
  `} // namespace` 加闭合的代码围栏，直接往下接
- 严格对齐第四节密度标准：完整可粘贴代码不用省略号、@add/@update 变更标注、
  所有函数 @param/@return、所有 class 说明职责/线程所有权/生命周期、
  逐层验证给命令和预期输出、技术决策说明"为什么"
- 三条通道严格区分不能混写：
  JS Bridge（JS↔C++，QuickJS C API 直调）
  PlatformBridge（C++→Platform，渲染命令，本次的 6 个 lvgl* 函数）
  PlatformEventSink（Platform→C++，事件，onLvglClick 走这条，不走命令队列）
- 术语规范：不自创术语，禁用"能力合同"/"第一性"/"宿主"/"赋能"
- 如实反映 V1 替代方案的边界：posix_event_loop 无 IO 能力（LVGL 端没有
  fetch/socket）、手写 layout_engine 只支持 column、手写 ZIP、QuickJS JSON
- 方案 B 要如实写成"需要新增 Core 接口"，RuntimeEventLoop 目前只有阻塞式
  run()，没有 runOnce()

写完更新 step-process.md 第三节的进度，然后提醒我开新会话做会话 B。
```

### 会话 B：11.7 + 技术决策 + QA + 下一步

```text
项目：QuickApp Kit —— 多平台快应用运行时框架，C++ Core 基座 + 三端渲染。
当前：quickapp-runtime-core 的 Step 11 只剩 11.7 + 技术决策 + QA + 下一步。

读这些：
1. #File BBQ/docs/interview/BT/proj/quickapp-kit/step-process.md
   第三节进度与断点、第四节密度标准、第五节 15 条已定技术决策 +
   5 个 V1 替代方案、第六节 4 个风险点、"PlatformBridge 签名速查"
2. #File BBQ/docs/interview/BT/proj/quickapp-kit/quickapp-runtime-core/spec/steps/11-platform-integration.md
   只读 1461 行（## Step 11.5）到末尾，拿到 iOS 和 LVGL 两端的实现细节。
   Android 侧的细节从第三节的进度快照取，不用回读 11.2。

要写：
- 11.7 三端对照与验证清单
    6 个 Bridge 函数在 Android / iOS / LVGL 的实现方式对照表
    （Android: JNI + Kotlin uiHandler.post；iOS: dispatch_async 到 main queue；
      LVGL: push 命令队列 + lv_timer pump）
    PlatformEventSink 回传方式的三端对照
    各端必做验证项
    三端差异汇总（线程模型 / 像素单位 / 字体 / 内存 / 日志后端 / 文件 IO）
    V1 能力边界在三端的表现差异（column-only 布局在哪端更明显）
- 技术决策 8-10 条，必须包含：
    为什么 Android 保留 .so 名不变、为什么线程切换放平台层而非 Core、
    iOS 的 px→pt 转换、LVGL 字体只能选预置档位、
    Step 11 发现的 Core 接口缺口（JSEngineLimits）
    以及第三节列出的 11.6.4 已定的 5 条（选方案 A / 静态 ring buffer /
    阻塞背压 / 队列容量要装下首屏 / showToast 用 lv_layer_top），不要推翻
- QA 8-10 条
- 下一步：指向 quickapp-runtime-cpp 项目

硬性要求同会话 A（fs_append 续写、密度标准、三通道区分、术语规范、
如实反映 V1 替代方案边界）。

写完更新 step-process.md 第三节，把 core 标记为全部完成，
然后提醒我开新会话做优先级 2（回改 Step 04 和 Step 10 补 JSEngineLimits 重载）。
```
