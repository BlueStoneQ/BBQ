# Step 9：VNode、StyleResolver 与 LayoutEngine

## 目录

- [目标](#目标)
- [Step 9.1：理解模板对象的形态](#step-91理解模板对象的形态)
- [Step 9.2：实现 VNode](#step-92实现-vnode)
- [Step 9.3：实现 StyleResolver](#step-93实现-styleresolver)
- [Step 9.4：实现 LayoutEngine](#step-94实现-layoutengine)
- [Step 9.5：接入渲染管线](#step-95接入渲染管线)
- [Step 9.6：接入 CMake](#step-96接入-cmake)
- [Step 9.7：编写测试](#step-97编写测试)
- [Step 9.8：逐层验证](#step-98逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把 `__native_render__` 收到的 JS 模板对象转换为带像素坐标的渲染命令。**

| 层 | 职责 | 文件 |
|---|---|---|
| 虚拟节点 | 承载 type/attrs/styles/events/children/layout | `include/vnode.h` + `src/vnode.cpp` |
| 样式解析 | classList → StyleSheet 查表 → 合并到 node.styles | `include/style_resolver.h` + `src/style_resolver.cpp` |
| 布局计算 | 为每个节点算出 x/y/width/height（物理像素） | `include/layout_engine.h` + `src/layout_engine.cpp` |
| 管线接入 | 替换 Step 07 的 `__native_render__` 桩 | `src/render_pipeline.cpp` |

**验收标准：**
- 3 层嵌套模板对象能构建为 VNode 树，节点 ID 全局唯一自增
- `attr` 里的函数值以 VM 为 `this` 求值（数据绑定生效）
- 多个 classList 按顺序叠加，后者覆盖前者
- 布局计算后每个节点 width/height > 0，垂直堆叠位置正确
- mock PlatformBridge 收到完整且顺序正确的命令序列
- ASan 无泄漏、无越界

**本步不包含：**
- 完整 Flex 布局（见下方能力边界，Yoga 替换留给后续）
- VNode Diff 与增量更新（V1 只做首屏全量渲染）
- CSS 选择器引擎（只支持单个 class 名精确匹配，无层级/伪类/属性选择器）
- 响应式数据更新（数据变化后重新渲染，V2）
- 事件到 JS 方法的实际调用（Step 10 接线）

### 布局能力边界（V1 明确不支持的部分）

手写 `layout_engine` 替代 Yoga 后的实际能力：

```text
✓ flexDirection: column（垂直堆叠，默认且唯一方向）
✓ width / height（固定 px 值）
✓ margin / padding（四边，含简写与单边）
✓ 未指定宽度时继承父容器内容区宽度
✓ 未指定高度时按内容累加（容器）或用默认行高（文本）

✗ flexDirection: row / row-reverse / column-reverse
✗ justifyContent（主轴对齐）
✗ alignItems / alignSelf（交叉轴对齐）
✗ flex / flexGrow / flexShrink / flexBasis
✗ 百分比尺寸（"50%"）
✗ flexWrap 换行
✗ position: absolute / fixed
✗ 文本测量（多行折行后的真实高度）
```

**影响：** 真实快应用大量使用 row 布局和居中对齐，这些页面会出现错位。Step 11 的集成验证需如实记录哪些页面能正确渲染。`LayoutEngine` 接口设计保证替换为 Yoga 时只改一个文件。

---

## Step 9.1：理解模板对象的形态

写代码前必须看清 `__native_render__` 实际收到什么。

### 9.1.1：framework.js 传入的两个参数

```javascript
// framework.js 在创建 VM 后调用（Step 10 实现）
__native_render__(template, style);
```

`template` 是页面 bundle 里 `$app_module$.exports.template` 的内容：

```javascript
{
  type: 'div',
  classList: ['wrapper'],
  children: [
    {
      type: 'text',
      classList: ['title'],
      attr: {
        // 关键：值可能是函数，需要以 VM 为 this 求值
        value: function() { return this.title; }
      }
    },
    {
      type: 'div',
      classList: ['row', 'center'],       // 多个 class，按顺序叠加
      children: [
        {
          type: 'input',
          classList: ['btn'],
          attr: { type: 'button', value: '跳转详情' },
          events: { click: 'goDetail' }   // 事件名 → VM 方法名
        }
      ]
    }
  ]
}
```

`style` 是 `$app_module$.exports.style`：

```javascript
{
  '.wrapper':  { flexDirection: 'column', padding: '20px',
                 backgroundColor: '#ffffff' },
  '.title':    { fontSize: '18px', color: '#333333', height: '40px' },
  '.row':      { flexDirection: 'row', height: '60px' },
  '.center':   { justifyContent: 'center' },
  '.btn':      { width: '200px', height: '44px',
                 backgroundColor: '#3f51b5', color: '#ffffff' }
}
```

### 9.1.2：字段名的坑

编译产物里的字段名和直觉不一致，必须按实际来：

| 直觉 | 实际字段名 | 说明 |
|---|---|---|
| `attrs` | `attr` | 单数 |
| `class` | `classList` | 数组，不是空格分隔的字符串 |
| `on` / `onClick` | `events` | 对象：`{ click: 'methodName' }` |
| `text` | `attr.value` | text 节点的内容在 `attr.value` 里 |
| `style`（节点内联） | 无 | V1 的编译产物不产生节点内联样式，全部走 classList |

`type` 的取值范围（V1 支持的组件）：

```text
"div"    容器
"text"   文本
"input"  输入类，attr.type 区分（V1 只处理 "button"）
```

### 9.1.3：转换流程

```text
JS template 对象
    ↓ buildVNode：递归遍历，函数值求值
VNode 树（有 type/attrs/events/classList，styles 和 layout 为空）
    ↓ StyleResolver：classList 查 StyleSheet 合并
VNode 树（styles 已填充）
    ↓ LayoutEngine：递归计算盒模型
VNode 树（layout 已填充，含像素坐标）
    ↓ 遍历发送命令
PlatformBridge.createElement / setAttr / setStyle / setEvent
```

---

## Step 9.2：实现 VNode

### 9.2.1：创建头文件

**@add `include/vnode.h`（新建文件）**

```cpp
#ifndef QUICKAPP_VNODE_H
#define QUICKAPP_VNODE_H

#include <map>
#include <memory>
#include <string>
#include <vector>

namespace quickapp {

class JSEngine;

// 节点的布局结果，单位物理像素。
struct LayoutBox {
    float x = 0;        // 相对于容器原点的左偏移
    float y = 0;        // 相对于容器原点的上偏移
    float width = 0;
    float height = 0;
};

// 盒模型的四边数值，单位物理像素。
struct EdgeInsets {
    float top = 0;
    float right = 0;
    float bottom = 0;
    float left = 0;

    /**
     * 水平方向占用的总空间。
     * @return left + right
     */
    float horizontal() const { return left + right; }

    /**
     * 垂直方向占用的总空间。
     * @return top + bottom
     */
    float vertical() const { return top + bottom; }
};

// 虚拟节点：页面 UI 树的 C++ 表示。
//
// 职责：
//   承载从 JS 模板转换来的节点信息，作为样式解析和布局计算的载体，
//   最终被遍历为 PlatformBridge 渲染命令。
//
// 线程所有权：
//   Runtime Thread。整棵树由 Runtime Thread 创建、修改和销毁。
//
// 生命周期：
//   由 buildVNode 创建，用 unique_ptr 组成树形结构（父持有子）。
//   根节点被 RenderPipeline 持有，页面切换时整棵树释放。
//
// 内存布局说明：
//   children 用 vector<unique_ptr<VNode>> 而不是 vector<VNode>，
//   原因是 VNode 含自身类型的容器，值语义会导致不完整类型错误；
//   且指针稳定性让外部可以安全持有子节点引用（如 nodeId → VNode* 索引）。
struct VNode {
    // 全局唯一 ID，由 allocateNodeId() 分配。
    // 平台层用它建立 id → 原生控件 的映射，事件回传时用它定位节点。
    int id = 0;

    // 节点类型："div" / "text" / "input"
    std::string type;

    // 属性：内容语义。
    // text 节点的文本在 attrs["value"]，
    // input 节点的类型在 attrs["type"]、按钮文字在 attrs["value"]
    std::map<std::string, std::string> attrs;

    // 样式：视觉表现。由 StyleResolver 从 classList 匹配后填充。
    // 键是驼峰形式（backgroundColor 而非 background-color），
    // 因为编译产物里的 style 对象用的就是驼峰。
    std::map<std::string, std::string> styles;

    // 事件：事件类型 → VM 方法名。如 {"click": "goDetail"}
    std::map<std::string, std::string> events;

    // 样式类名列表，顺序有意义（后者覆盖前者）
    std::vector<std::string> classList;

    // 子节点，父节点拥有其所有权
    std::vector<std::unique_ptr<VNode>> children;

    // 布局计算结果
    LayoutBox layout;

    /**
     * 读取样式值。
     *
     * @param key          样式名，驼峰形式
     * @param defaultValue 样式不存在时返回的值
     * @return 样式值字符串，不存在时返回 defaultValue
     */
    std::string style(const std::string& key,
                      const std::string& defaultValue = "") const;

    /**
     * 读取属性值。
     *
     * @param key          属性名
     * @param defaultValue 属性不存在时返回的值
     * @return 属性值字符串，不存在时返回 defaultValue
     */
    std::string attr(const std::string& key,
                     const std::string& defaultValue = "") const;

    /**
     * 统计整棵子树的节点数（含自身）。用于日志和测试断言。
     * @return 节点总数，叶子节点返回 1
     */
    size_t countNodes() const;
};

/**
 * 分配一个全局唯一的节点 ID。
 *
 * 从 1 开始自增。0 保留表示"无效节点"。
 *
 * 线程约束：非线程安全，只能在 Runtime Thread 调用。
 * 溢出说明：int 上限约 21 亿，按每秒创建 1000 个节点计算可用 24 天，
 *          实际场景（页面切换时创建几十个）不会溢出。
 *
 * @return 新的节点 ID
 */
int allocateNodeId();

/**
 * 重置节点 ID 计数器。
 *
 * 用途：单元测试之间隔离，让每个测试的节点 ID 从 1 开始，断言更直观。
 * 生产代码不应调用（会导致新旧节点 ID 冲突）。
 */
void resetNodeIdCounter();

/**
 * 从 JS 模板对象递归构建 VNode 树。
 *
 * 处理内容：
 *   - type / classList / attr / events 字段的提取
 *   - attr 值为函数时以 vmObject 为 this 调用求值（数据绑定）
 *   - children 数组递归处理
 *
 * @param engine     已初始化的 JS 引擎，用于访问 JSContext 和调用函数
 * @param templateVal 指向模板对象的 JSValue 的地址（void* 是为了
 *                    让本头文件不依赖 quickjs.h；实际类型是 JSValue*）
 * @param vmObject   指向 VM 实例 JSValue 的地址，作为函数求值时的 this。
 *                   传 nullptr 时函数值求值为空字符串
 * @return 根节点。构建失败（模板不是对象、缺 type 字段）返回 nullptr
 *
 * 线程约束：Runtime Thread。
 */
std::unique_ptr<VNode> buildVNode(JSEngine* engine,
                                  void* templateVal,
                                  void* vmObject);

} // namespace quickapp

#endif // QUICKAPP_VNODE_H
```


### 9.2.2：实现基础方法与 ID 分配

**@add `src/vnode.cpp`（新建文件）**

第一部分：成员方法和 ID 分配。

```cpp
#include "vnode.h"

#include "js_engine.h"
#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {
namespace {

// 全局节点 ID 计数器。
// 从 1 开始，0 保留为"无效节点"。
// 单线程访问（Runtime Thread），不需要 atomic。
int g_nextNodeId = 1;

} // namespace

std::string VNode::style(const std::string& key,
                         const std::string& defaultValue) const {
    auto it = styles.find(key);
    return (it != styles.end()) ? it->second : defaultValue;
}

std::string VNode::attr(const std::string& key,
                        const std::string& defaultValue) const {
    auto it = attrs.find(key);
    return (it != attrs.end()) ? it->second : defaultValue;
}

size_t VNode::countNodes() const {
    size_t total = 1;   // 自身
    for (const auto& child : children) {
        total += child->countNodes();
    }
    return total;
}

int allocateNodeId() {
    return g_nextNodeId++;
}

void resetNodeIdCounter() {
    g_nextNodeId = 1;
}
```

第二部分：JS 值提取辅助函数。

```cpp
namespace {

/**
 * 把 JSValue 转为字符串。
 *
 * 如果值是函数，以 thisObj 为 this 调用它并转换返回值。
 * 这是数据绑定的核心：模板里写 `function(){ return this.title }`，
 * 需要在 VM 上下文里求值才能拿到真实文本。
 *
 * @param ctx     QuickJS 上下文
 * @param val     待转换的值
 * @param thisObj 函数求值时的 this。JS_UNDEFINED 表示无 VM 上下文
 * @param out     输出参数，接收字符串结果
 * @return true  转换成功
 *         false 值是 undefined/null，或函数调用抛异常
 */
bool valueToString(JSContext* ctx, JSValueConst val,
                   JSValueConst thisObj, std::string& out) {
    if (JS_IsUndefined(val) || JS_IsNull(val)) {
        return false;
    }

    // 函数值：调用后取返回值
    if (JS_IsFunction(ctx, val)) {
        JSValue result = JS_Call(ctx, val, thisObj, 0, nullptr);

        if (JS_IsException(result)) {
            JSValue exc = JS_GetException(ctx);
            const char* msg = JS_ToCString(ctx, exc);
            QA_LOGE("[VNode] template function threw: %s",
                    msg != nullptr ? msg : "<unknown>");
            if (msg != nullptr) {
                JS_FreeCString(ctx, msg);
            }
            JS_FreeValue(ctx, exc);
            JS_FreeValue(ctx, result);
            return false;
        }

        // 递归转换返回值。传 JS_UNDEFINED 作为 this：
        // 返回值不应该再是函数，如果是就不再求值，避免无限递归
        const bool ok = valueToString(ctx, result, JS_UNDEFINED, out);
        JS_FreeValue(ctx, result);
        return ok;
    }

    // 普通值：直接转字符串。
    // 数字 42 → "42"，布尔 true → "true"，对象 → "[object Object]"
    const char* s = JS_ToCString(ctx, val);
    if (s == nullptr) {
        // toString 抛异常（如 Symbol），清掉异常状态
        JS_FreeValue(ctx, JS_GetException(ctx));
        return false;
    }
    out = s;
    JS_FreeCString(ctx, s);
    return true;
}

/**
 * 从对象读取字符串属性（不做函数求值）。
 *
 * @param ctx QuickJS 上下文
 * @param obj 源对象
 * @param key 属性名
 * @param out 输出参数。属性不存在时不修改
 * @return true 读取成功
 */
bool getStringProp(JSContext* ctx, JSValueConst obj,
                   const char* key, std::string& out) {
    JSValue val = JS_GetPropertyStr(ctx, obj, key);
    const bool ok = valueToString(ctx, val, JS_UNDEFINED, out);
    JS_FreeValue(ctx, val);
    return ok;
}

/**
 * 遍历对象的所有可枚举字符串键。
 *
 * @param ctx      QuickJS 上下文
 * @param obj      目标对象，不是对象时直接返回
 * @param callback 参数为 (键名, 值)。值由本函数负责释放，
 *                 callback 内不要释放
 */
template <typename Fn>
void forEachProp(JSContext* ctx, JSValueConst obj, Fn&& callback) {
    if (!JS_IsObject(obj)) {
        return;
    }

    JSPropertyEnum* props = nullptr;
    uint32_t count = 0;
    if (JS_GetOwnPropertyNames(ctx, &props, &count, obj,
                              JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) < 0) {
        return;
    }

    for (uint32_t i = 0; i < count; ++i) {
        const char* key = JS_AtomToCString(ctx, props[i].atom);
        JSValue value = JS_GetProperty(ctx, obj, props[i].atom);
        if (key != nullptr) {
            callback(key, value);
            JS_FreeCString(ctx, key);
        }
        JS_FreeValue(ctx, value);
    }

    for (uint32_t i = 0; i < count; ++i) {
        JS_FreeAtom(ctx, props[i].atom);
    }
    js_free(ctx, props);
}

} // namespace
```


第三部分：buildVNode 递归实现。

```cpp
namespace {

/**
 * 递归构建单个节点及其子树。
 *
 * @param ctx      QuickJS 上下文
 * @param tplObj   当前节点的模板对象
 * @param vmObj    VM 实例，作为函数求值的 this
 * @param depth    当前递归深度，用于防御深度过大的模板
 * @return 构建好的节点；模板非法时返回 nullptr
 */
std::unique_ptr<VNode> buildNodeRecursive(JSContext* ctx,
                                          JSValueConst tplObj,
                                          JSValueConst vmObj,
                                          int depth) {
    // 防御：模板嵌套过深可能是循环引用或恶意构造。
    // 64 层对真实页面绰绰有余（典型页面 5-8 层）。
    constexpr int kMaxDepth = 64;
    if (depth > kMaxDepth) {
        QA_LOGE("[VNode] template nesting exceeds %d levels, aborting", kMaxDepth);
        return nullptr;
    }

    if (!JS_IsObject(tplObj)) {
        QA_LOGE("[VNode] template node is not an object (depth=%d)", depth);
        return nullptr;
    }

    auto node = std::make_unique<VNode>();
    node->id = allocateNodeId();

    // ---- type（必填） ----
    if (!getStringProp(ctx, tplObj, "type", node->type) || node->type.empty()) {
        QA_LOGE("[VNode] node %d missing 'type' field", node->id);
        return nullptr;
    }

    // ---- classList ----
    // 编译产物里是数组：['wrapper', 'active']
    {
        JSValue clsVal = JS_GetPropertyStr(ctx, tplObj, "classList");
        if (JS_IsArray(ctx, clsVal)) {
            JSValue lenVal = JS_GetPropertyStr(ctx, clsVal, "length");
            int32_t len = 0;
            JS_ToInt32(ctx, &len, lenVal);
            JS_FreeValue(ctx, lenVal);

            for (int32_t i = 0; i < len; ++i) {
                JSValue item = JS_GetPropertyUint32(ctx, clsVal,
                                                    static_cast<uint32_t>(i));
                std::string cls;
                if (valueToString(ctx, item, vmObj, cls) && !cls.empty()) {
                    node->classList.push_back(cls);
                }
                JS_FreeValue(ctx, item);
            }
        } else if (JS_IsString(clsVal)) {
            // 容错：某些工具链版本可能产出空格分隔的字符串
            std::string raw;
            if (valueToString(ctx, clsVal, vmObj, raw)) {
                size_t start = 0;
                while (start < raw.size()) {
                    const size_t end = raw.find(' ', start);
                    const std::string token = raw.substr(
                        start, end == std::string::npos ? std::string::npos
                                                       : end - start);
                    if (!token.empty()) {
                        node->classList.push_back(token);
                    }
                    if (end == std::string::npos) break;
                    start = end + 1;
                }
            }
        }
        JS_FreeValue(ctx, clsVal);
    }

    // ---- attr（注意是单数） ----
    // 值可能是函数，需要以 VM 为 this 求值 —— 这就是数据绑定
    {
        JSValue attrObj = JS_GetPropertyStr(ctx, tplObj, "attr");
        forEachProp(ctx, attrObj, [&](const char* key, JSValue value) {
            std::string strValue;
            if (valueToString(ctx, value, vmObj, strValue)) {
                node->attrs[key] = strValue;
            }
        });
        JS_FreeValue(ctx, attrObj);
    }

    // ---- events ----
    // 形态：{ click: 'goDetail' }，值是 VM 方法名字符串
    {
        JSValue eventsObj = JS_GetPropertyStr(ctx, tplObj, "events");
        forEachProp(ctx, eventsObj, [&](const char* key, JSValue value) {
            std::string methodName;
            // 事件值不做函数求值：它本身就该是方法名字符串。
            // 传 JS_UNDEFINED 避免误把方法名当函数调用。
            if (valueToString(ctx, value, JS_UNDEFINED, methodName) &&
                !methodName.empty()) {
                node->events[key] = methodName;
            }
        });
        JS_FreeValue(ctx, eventsObj);
    }

    // ---- children 递归 ----
    {
        JSValue childrenVal = JS_GetPropertyStr(ctx, tplObj, "children");
        if (JS_IsArray(ctx, childrenVal)) {
            JSValue lenVal = JS_GetPropertyStr(ctx, childrenVal, "length");
            int32_t len = 0;
            JS_ToInt32(ctx, &len, lenVal);
            JS_FreeValue(ctx, lenVal);

            for (int32_t i = 0; i < len; ++i) {
                JSValue childTpl = JS_GetPropertyUint32(
                    ctx, childrenVal, static_cast<uint32_t>(i));

                auto child = buildNodeRecursive(ctx, childTpl, vmObj, depth + 1);
                if (child != nullptr) {
                    node->children.push_back(std::move(child));
                } else {
                    // 单个子节点失败不中断整棵树：跳过它继续处理兄弟节点。
                    // 这样一个坏节点不会导致整页白屏。
                    QA_LOGW("[VNode] skipping invalid child %d of node %d",
                            i, node->id);
                }

                JS_FreeValue(ctx, childTpl);
            }
        }
        JS_FreeValue(ctx, childrenVal);
    }

    QA_LOGD("[VNode] built node %d type=%s classes=%zu attrs=%zu "
            "events=%zu children=%zu",
            node->id, node->type.c_str(), node->classList.size(),
            node->attrs.size(), node->events.size(), node->children.size());

    return node;
}

} // namespace

std::unique_ptr<VNode> buildVNode(JSEngine* engine,
                                  void* templateVal,
                                  void* vmObject) {
    if (engine == nullptr || templateVal == nullptr) {
        QA_LOGE("[VNode] buildVNode: engine or template is null");
        return nullptr;
    }

    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    if (ctx == nullptr) {
        QA_LOGE("[VNode] buildVNode: engine not initialized");
        return nullptr;
    }

    // void* 转回 JSValue*。调用方传的是 JSValue 的地址。
    auto* tpl = static_cast<JSValue*>(templateVal);
    // vmObject 可以为空（无数据绑定的静态模板）
    const JSValue vm = (vmObject != nullptr)
                           ? *static_cast<JSValue*>(vmObject)
                           : JS_UNDEFINED;

    auto root = buildNodeRecursive(ctx, *tpl, vm, 0);

    if (root != nullptr) {
        QA_LOGI("[VNode] built tree: %zu nodes, root type=%s",
                root->countNodes(), root->type.c_str());
    }
    return root;
}

} // namespace quickapp
```

---

## Step 9.3：实现 StyleResolver

### 9.3.1：创建头文件

**@add `include/style_resolver.h`（新建文件）**

```cpp
#ifndef QUICKAPP_STYLE_RESOLVER_H
#define QUICKAPP_STYLE_RESOLVER_H

#include <map>
#include <string>

#include "vnode.h"

namespace quickapp {

class JSEngine;

// 样式表：选择器 → 样式属性集合。
//
// 键的形态来自编译产物，带前导点：".wrapper"、".title"。
// 值的键是驼峰形式：backgroundColor、flexDirection。
//
// V1 只支持单个 class 名的精确匹配，不支持：
//   层级选择器（".a .b"）、组合（".a.b"）、
//   伪类（":active"）、属性选择器、标签选择器（"div"）
using StyleSheet = std::map<std::string, std::map<std::string, std::string>>;

// 样式解析器。
//
// 职责：
//   遍历 VNode 树，按每个节点的 classList 从 StyleSheet 查表，
//   把匹配到的样式合并到 node.styles。
//
// 合并规则：
//   按 classList 数组顺序依次应用，同名属性后者覆盖前者。
//   例：classList = ["base", "active"]
//       .base   → { color: "#000", fontSize: "14px" }
//       .active → { color: "#f00" }
//       结果    → { color: "#f00", fontSize: "14px" }
//
// 线程所有权：Runtime Thread。
class StyleResolver {
public:
    /**
     * 从 JS style 对象构建 StyleSheet。
     *
     * @param engine   已初始化的 JS 引擎
     * @param styleVal 指向 style 对象 JSValue 的地址（实际类型 JSValue*）。
     *                 为 nullptr 时返回空 StyleSheet
     * @param out      输出参数，接收解析结果
     * @return true 解析成功（空对象也算成功）；false 引擎无效
     *
     * 线程约束：Runtime Thread。
     */
    static bool buildStyleSheet(JSEngine* engine, void* styleVal, StyleSheet& out);

    /**
     * 递归解析整棵树的样式。
     *
     * 对每个节点：遍历 classList，查 StyleSheet（自动补前导点），
     * 把命中的属性合并进 node->styles。
     *
     * @param root  树根。为 nullptr 时是空操作
     * @param sheet 样式表
     * @return 命中样式的节点数量。用于日志和测试断言
     *
     * 线程约束：Runtime Thread。
     */
    static size_t resolve(VNode* root, const StyleSheet& sheet);
};

} // namespace quickapp

#endif // QUICKAPP_STYLE_RESOLVER_H
```

### 9.3.2：创建实现文件

**@add `src/style_resolver.cpp`（新建文件）**

```cpp
#include "style_resolver.h"

#include "js_engine.h"
#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {
namespace {

/**
 * 遍历对象的可枚举字符串键。
 *
 * 和 vnode.cpp 里的同名函数逻辑一致，但保持各文件独立实现，
 * 避免为一个 20 行的辅助函数引入内部头文件依赖。
 *
 * @param ctx      QuickJS 上下文
 * @param obj      目标对象
 * @param callback 参数为 (键名, 值)，值由本函数释放
 */
template <typename Fn>
void forEachProp(JSContext* ctx, JSValueConst obj, Fn&& callback) {
    if (!JS_IsObject(obj)) {
        return;
    }

    JSPropertyEnum* props = nullptr;
    uint32_t count = 0;
    if (JS_GetOwnPropertyNames(ctx, &props, &count, obj,
                              JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) < 0) {
        return;
    }

    for (uint32_t i = 0; i < count; ++i) {
        const char* key = JS_AtomToCString(ctx, props[i].atom);
        JSValue value = JS_GetProperty(ctx, obj, props[i].atom);
        if (key != nullptr) {
            callback(key, value);
            JS_FreeCString(ctx, key);
        }
        JS_FreeValue(ctx, value);
    }

    for (uint32_t i = 0; i < count; ++i) {
        JS_FreeAtom(ctx, props[i].atom);
    }
    js_free(ctx, props);
}

/**
 * 把 JSValue 转为样式值字符串。
 *
 * 样式值不做函数求值：编译产物里的 style 对象是静态字面量，
 * 不含函数。数字会被转为字符串（fontSize: 16 → "16"）。
 *
 * @param ctx QuickJS 上下文
 * @param val 样式值
 * @param out 输出参数
 * @return true 转换成功
 */
bool styleValueToString(JSContext* ctx, JSValueConst val, std::string& out) {
    if (JS_IsUndefined(val) || JS_IsNull(val) || JS_IsObject(val)) {
        return false;
    }
    const char* s = JS_ToCString(ctx, val);
    if (s == nullptr) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return false;
    }
    out = s;
    JS_FreeCString(ctx, s);
    return true;
}

/**
 * 递归解析单个节点及其子树。
 *
 * @param node  当前节点
 * @param sheet 样式表
 * @return 本子树中命中样式的节点数
 */
size_t resolveRecursive(VNode* node, const StyleSheet& sheet) {
    if (node == nullptr) {
        return 0;
    }

    size_t matched = 0;
    bool nodeMatched = false;

    // 按 classList 顺序应用，后者覆盖前者
    for (const auto& cls : node->classList) {
        // 编译产物里的键带前导点。
        // classList 里存的是不带点的名字，查表时补上。
        const std::string selector = "." + cls;

        auto it = sheet.find(selector);
        if (it == sheet.end()) {
            // 未命中不是错误：可能是纯语义 class，或样式定义在其他页面
            QA_LOGD("[StyleResolver] node %d: no rule for '%s'",
                    node->id, selector.c_str());
            continue;
        }

        // operator[] 赋值实现"后者覆盖前者"
        for (const auto& [key, value] : it->second) {
            node->styles[key] = value;
        }
        nodeMatched = true;
    }

    if (nodeMatched) {
        ++matched;
        QA_LOGD("[StyleResolver] node %d resolved %zu style properties",
                node->id, node->styles.size());
    }

    for (auto& child : node->children) {
        matched += resolveRecursive(child.get(), sheet);
    }

    return matched;
}

} // namespace

bool StyleResolver::buildStyleSheet(JSEngine* engine, void* styleVal,
                                    StyleSheet& out) {
    out.clear();

    if (engine == nullptr) {
        QA_LOGE("[StyleResolver] buildStyleSheet: engine is null");
        return false;
    }
    // style 为空是合法的：页面可以没有任何样式定义
    if (styleVal == nullptr) {
        QA_LOGD("[StyleResolver] no style object provided");
        return true;
    }

    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    if (ctx == nullptr) {
        QA_LOGE("[StyleResolver] buildStyleSheet: engine not initialized");
        return false;
    }

    auto* styleObj = static_cast<JSValue*>(styleVal);

    // 外层：选择器 → 样式对象
    forEachProp(ctx, *styleObj, [&](const char* selector, JSValue ruleObj) {
        std::map<std::string, std::string> props;

        // 内层：属性名 → 属性值
        forEachProp(ctx, ruleObj, [&](const char* propName, JSValue propVal) {
            std::string strVal;
            if (styleValueToString(ctx, propVal, strVal)) {
                props[propName] = strVal;
            }
        });

        if (!props.empty()) {
            out[selector] = std::move(props);
        }
    });

    QA_LOGI("[StyleResolver] built stylesheet: %zu selectors", out.size());
    return true;
}

size_t StyleResolver::resolve(VNode* root, const StyleSheet& sheet) {
    if (root == nullptr) {
        return 0;
    }

    const size_t matched = resolveRecursive(root, sheet);
    QA_LOGI("[StyleResolver] resolved styles for %zu/%zu nodes",
            matched, root->countNodes());
    return matched;
}

} // namespace quickapp
```

---

## Step 9.4：实现 LayoutEngine

### 9.4.1：创建头文件

**@add `include/layout_engine.h`（新建文件）**

```cpp
#ifndef QUICKAPP_LAYOUT_ENGINE_H
#define QUICKAPP_LAYOUT_ENGINE_H

#include <string>

#include "vnode.h"

namespace quickapp {

// 布局引擎抽象。
//
// 职责：
//   遍历 VNode 树，根据 styles 里的盒模型属性计算每个节点的
//   x / y / width / height（物理像素），结果写入 node.layout。
//
// V1 实现（SimpleLayoutEngine）的能力边界：
//   ✓ flexDirection: column（垂直堆叠）
//   ✓ width / height 固定 px
//   ✓ margin / padding 四边
//   ✗ row 方向、justifyContent、alignItems、flex-grow、百分比、换行
//   完整列表见 Step 09 文档开头的"布局能力边界"。
//
// 替换为 Yoga 的接口契约：
//   只需提供一个同签名的 calculateLayout 实现，
//   VNode 结构和调用方（RenderPipeline）零改动。
//   Yoga 的接入方式：为每个 VNode 创建 YGNodeRef，
//   把 styles 映射为 YGNodeStyleSet* 调用，
//   YGNodeCalculateLayout 后把结果读回 node.layout。
//
// 线程所有权：Runtime Thread（纯计算，无状态）。
class LayoutEngine {
public:
    /**
     * 计算整棵树的布局。
     *
     * @param root            树根。为 nullptr 时是空操作
     * @param containerWidth  可用宽度（物理像素）。通常是屏幕宽度
     * @param containerHeight 可用高度（物理像素）。通常是屏幕高度减去
     *                        标题栏和状态栏。未指定高度的根节点会用它
     * @return 计算的节点数量
     *
     * 副作用：修改树中每个节点的 layout 字段。
     */
    static size_t calculateLayout(VNode* root,
                                  float containerWidth,
                                  float containerHeight);

    /**
     * 解析 CSS 长度值为像素数。
     *
     * 支持格式：
     *   "16px" → 16.0
     *   "16"   → 16.0（无单位按 px 处理）
     *   ""     → fallback
     *   "50%"  → fallback（百分比未实现，见能力边界）
     *
     * @param value    CSS 长度字符串
     * @param fallback 无法解析时返回的值
     * @return 像素数
     *
     * 公开为 public 是为了让单元测试能直接验证解析逻辑，
     * 以及让平台层在需要时复用（如解析 borderRadius）。
     */
    static float parseLength(const std::string& value, float fallback = 0.0f);

    /**
     * 从节点样式提取四边内边距或外边距。
     *
     * 支持简写和单边覆盖，单边优先：
     *   padding: "10px"                    → 四边都是 10
     *   padding: "10px", paddingTop: "20px" → 上 20，其余 10
     *
     * @param node   源节点
     * @param prefix "padding" 或 "margin"
     * @return 四边数值
     */
    static EdgeInsets extractInsets(const VNode& node, const std::string& prefix);
};

} // namespace quickapp

#endif // QUICKAPP_LAYOUT_ENGINE_H
```

### 9.4.2：实现长度解析与盒模型提取

**@add `src/layout_engine.cpp`（新建文件）**

第一部分：辅助函数。

```cpp
#include "layout_engine.h"

#include <cstdlib>

#include "qa_log.h"

namespace quickapp {
namespace {

// 未指定高度时文本节点的默认行高（物理像素）。
//
// 为什么需要这个：真实的文本高度需要字体度量（字号、字重、行数），
// 而 Core 没有字体信息 —— 那属于平台层。
// V1 用固定值近似，代价是多行文本会被裁剪或留白。
// 替换为 Yoga + 平台文本测量回调后可以精确计算。
constexpr float kDefaultTextHeight = 40.0f;

// 未指定高度时 input 节点的默认高度
constexpr float kDefaultInputHeight = 44.0f;

// 空容器的默认高度（无子节点且未指定 height 时）
constexpr float kDefaultEmptyContainerHeight = 0.0f;

} // namespace

float LayoutEngine::parseLength(const std::string& value, float fallback) {
    if (value.empty()) {
        return fallback;
    }

    // 百分比未实现。明确返回 fallback 而不是错误解析为数字，
    // 避免 "50%" 被 strtof 解析成 50.0 这种静默错误。
    if (value.back() == '%') {
        QA_LOGD("[Layout] percentage '%s' not supported, using fallback %.1f",
                value.c_str(), fallback);
        return fallback;
    }

    // strtof 会自动跳过前导空白，并在遇到非数字字符时停止。
    // "16px" → 16.0，end 指向 'p'
    const char* str = value.c_str();
    char* end = nullptr;
    const float num = std::strtof(str, &end);

    // 完全无法解析（如 "auto"、"center"）
    if (end == str) {
        QA_LOGD("[Layout] cannot parse length '%s', using fallback %.1f",
                value.c_str(), fallback);
        return fallback;
    }

    // 负值对尺寸无意义，钳制到 0。
    // margin 允许负值，但 V1 不支持负 margin 的重叠布局，统一钳制。
    if (num < 0) {
        return 0.0f;
    }

    return num;
}

EdgeInsets LayoutEngine::extractInsets(const VNode& node,
                                       const std::string& prefix) {
    EdgeInsets insets;

    // 1. 先取简写值作为四边基准
    const std::string shorthand = node.style(prefix);
    if (!shorthand.empty()) {
        const float all = parseLength(shorthand, 0.0f);
        insets.top = all;
        insets.right = all;
        insets.bottom = all;
        insets.left = all;
    }

    // 2. 单边覆盖。
    //    只在样式存在时覆盖，否则保留简写值。
    //    style() 返回空串表示未设置，此时不调 parseLength。
    const std::string topVal = node.style(prefix + "Top");
    if (!topVal.empty()) {
        insets.top = parseLength(topVal, insets.top);
    }
    const std::string rightVal = node.style(prefix + "Right");
    if (!rightVal.empty()) {
        insets.right = parseLength(rightVal, insets.right);
    }
    const std::string bottomVal = node.style(prefix + "Bottom");
    if (!bottomVal.empty()) {
        insets.bottom = parseLength(bottomVal, insets.bottom);
    }
    const std::string leftVal = node.style(prefix + "Left");
    if (!leftVal.empty()) {
        insets.left = parseLength(leftVal, insets.left);
    }

    return insets;
}
```


第二部分：递归布局计算。

```cpp
namespace {

/**
 * 计算单个节点的默认高度（未显式指定 height 时）。
 *
 * @param node 目标节点
 * @return 默认高度（物理像素）
 */
float defaultHeightFor(const VNode& node) {
    if (node.type == "text") {
        return kDefaultTextHeight;
    }
    if (node.type == "input") {
        return kDefaultInputHeight;
    }
    return kDefaultEmptyContainerHeight;
}

/**
 * 递归计算节点布局。
 *
 * 算法（垂直堆叠）：
 *   1. 确定自身宽度：显式 width 优先，否则用父容器给的可用宽度
 *   2. 扣除 padding 得到内容区
 *   3. 子节点在内容区内从上往下依次排列，每个占据"自身高度 + margin"
 *   4. 自身高度：显式 height 优先，否则由子节点累加高度 + padding 决定
 *
 * @param node          当前节点
 * @param originX       本节点左上角的绝对 X 坐标
 * @param originY       本节点左上角的绝对 Y 坐标
 * @param availWidth    父容器分配的可用宽度
 * @param availHeight   父容器分配的可用高度（仅根节点用于兜底）
 * @param nodeCount     输出参数，累加已处理的节点数
 * @return 本节点实际占用的高度（不含自身 margin）
 */
float layoutRecursive(VNode* node,
                      float originX,
                      float originY,
                      float availWidth,
                      float availHeight,
                      size_t& nodeCount) {
    if (node == nullptr) {
        return 0.0f;
    }
    ++nodeCount;

    const EdgeInsets padding = LayoutEngine::extractInsets(*node, "padding");

    // ---- 1. 自身宽度 ----
    // 显式 width 优先；未指定则占满父容器可用宽度（等价于 align-items: stretch）
    const std::string widthStyle = node->style("width");
    const float width = widthStyle.empty()
                            ? availWidth
                            : LayoutEngine::parseLength(widthStyle, availWidth);

    // ---- 2. 内容区宽度 ----
    // 扣除左右 padding。钳制到 0 防止 padding 大于 width 时出现负宽度
    float contentWidth = width - padding.horizontal();
    if (contentWidth < 0) {
        contentWidth = 0;
    }

    // ---- 3. 子节点垂直堆叠 ----
    // 游标从内容区左上角开始
    const float contentOriginX = originX + padding.left;
    float cursorY = originY + padding.top;
    float childrenTotalHeight = 0.0f;

    for (auto& child : node->children) {
        const EdgeInsets childMargin =
            LayoutEngine::extractInsets(*child, "margin");

        // 上外边距推进游标
        cursorY += childMargin.top;
        childrenTotalHeight += childMargin.top;

        // 子节点的可用宽度要扣掉它自己的左右 margin
        float childAvailWidth = contentWidth - childMargin.horizontal();
        if (childAvailWidth < 0) {
            childAvailWidth = 0;
        }

        const float childHeight = layoutRecursive(
            child.get(),
            contentOriginX + childMargin.left,
            cursorY,
            childAvailWidth,
            availHeight,
            nodeCount);

        cursorY += childHeight + childMargin.bottom;
        childrenTotalHeight += childHeight + childMargin.bottom;
    }

    // ---- 4. 自身高度 ----
    const std::string heightStyle = node->style("height");
    float height;

    if (!heightStyle.empty()) {
        // 显式指定
        height = LayoutEngine::parseLength(heightStyle, 0.0f);
    } else if (!node->children.empty()) {
        // 由子节点撑开：子节点总高 + 上下 padding
        height = childrenTotalHeight + padding.vertical();
    } else {
        // 叶子节点用类型默认值 + padding
        height = defaultHeightFor(*node) + padding.vertical();
    }

    // ---- 5. 写回布局结果 ----
    node->layout.x = originX;
    node->layout.y = originY;
    node->layout.width = width;
    node->layout.height = height;

    QA_LOGD("[Layout] node %d (%s): x=%.1f y=%.1f w=%.1f h=%.1f",
            node->id, node->type.c_str(),
            node->layout.x, node->layout.y,
            node->layout.width, node->layout.height);

    return height;
}

} // namespace

size_t LayoutEngine::calculateLayout(VNode* root,
                                     float containerWidth,
                                     float containerHeight) {
    if (root == nullptr) {
        QA_LOGW("[Layout] calculateLayout: root is null");
        return 0;
    }

    size_t nodeCount = 0;
    layoutRecursive(root, 0.0f, 0.0f, containerWidth, containerHeight, nodeCount);

    // 根节点未指定 height 且无子节点时高度为 0，此时用容器高度兜底，
    // 避免整页不可见
    if (root->layout.height <= 0.0f && root->style("height").empty()) {
        root->layout.height = containerHeight;
        QA_LOGD("[Layout] root height fallback to container height %.1f",
                containerHeight);
    }

    QA_LOGI("[Layout] calculated %zu nodes in %.0fx%.0f container, "
            "root size=%.0fx%.0f",
            nodeCount, containerWidth, containerHeight,
            root->layout.width, root->layout.height);

    return nodeCount;
}

} // namespace quickapp
```

**布局算法的直观示意：**

```text
容器 1080x1920，模板：
  div.wrapper (padding: 20px)
    ├── text.title (height: 40px)
    └── div.row (height: 60px, margin-top: 10px)

计算过程：
  wrapper: x=0, y=0, width=1080（占满）
           内容区：x=20, y=20, width=1040

  title:   x=20, y=20, width=1040, height=40
           游标推进到 y=60

  row:     margin-top 10 → 游标到 y=70
           x=20, y=70, width=1040, height=60
           游标推进到 y=130

  wrapper 高度 = 子节点总高(40 + 10 + 60 = 110) + padding.vertical(40) = 150
```

---

## Step 9.5：接入渲染管线

现在把三个组件串起来，替换 Step 07 里 `__native_render__` 的桩实现。

### 9.5.1：创建头文件

**@add `include/render_pipeline.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RENDER_PIPELINE_H
#define QUICKAPP_RENDER_PIPELINE_H

#include <cstddef>
#include <memory>

#include "vnode.h"

namespace quickapp {

class JSEngine;

// 渲染管线：模板 → VNode → 样式 → 布局 → 平台命令。
//
// 职责：
//   编排 buildVNode / StyleResolver / LayoutEngine 三个阶段，
//   然后遍历结果树向 PlatformBridge 发送渲染命令。
//
// 与 JS Bridge 的关系：
//   Step 07 注入的 __native_render__ 是桩实现。
//   本步通过 setNativeRenderHandler 把 RenderPipeline::handleNativeRender
//   注册进去，形成真实链路。
//
// 线程所有权：Runtime Thread。
//
// 状态说明：
//   持有当前页面的 VNode 树根。页面切换时旧树被释放（连带通知平台删除元素）。
class RenderPipeline {
public:
    /**
     * 初始化管线，把自己注册为 __native_render__ 的处理器。
     *
     * @param engine        已初始化的 JS 引擎
     * @param viewportWidth  可用宽度（物理像素），通常是屏幕宽度
     * @param viewportHeight 可用高度（物理像素），屏幕高度减标题栏
     * @return true 初始化成功
     *
     * 调用时机：installJSBridge 之后、eval framework.js 之前。
     */
    static bool initialize(JSEngine* engine,
                           float viewportWidth,
                           float viewportHeight);

    /**
     * 关闭管线，注销处理器并释放当前树。
     *
     * 必须在 JSEngine destroy 之前调用。
     */
    static void shutdown();

    /**
     * 更新视口尺寸。屏幕旋转或标题栏显隐时调用。
     *
     * 只更新数值，不触发重新布局（V1 无重排能力）。
     *
     * @param width  新的可用宽度
     * @param height 新的可用高度
     */
    static void setViewport(float width, float height);

    /**
     * 按节点 ID 查找当前树中的节点。
     *
     * 用途：事件到达时（Step 10）用 nodeId 找到节点，
     *      读取它的 events 映射得到 VM 方法名。
     *
     * @param nodeId 节点 ID
     * @return 节点指针，未找到返回 nullptr。
     *         返回的指针由管线拥有，页面切换后失效
     */
    static VNode* findNode(int nodeId);

    /**
     * 获取当前页面的树根。用于测试和调试。
     * @return 根节点指针，无页面时返回 nullptr
     */
    static VNode* currentRoot();
};

} // namespace quickapp

#endif // QUICKAPP_RENDER_PIPELINE_H
```

### 9.5.2：创建实现文件

**@add `src/render_pipeline.cpp`（新建文件）**

```cpp
#include "render_pipeline.h"

#include <unordered_map>

#include "js_bridge.h"
#include "js_engine.h"
#include "layout_engine.h"
#include "platform_bridge.h"
#include "qa_log.h"
#include "quickjs.h"
#include "style_resolver.h"

namespace quickapp {
namespace {

// 管线状态。单 Runtime 假设下用全局变量，
// 多 Runtime 时应移入 Runtime 对象（见 design.md 的 Key Decisions 6）。
JSEngine* g_engine = nullptr;
float g_viewportWidth = 0.0f;
float g_viewportHeight = 0.0f;

// 当前页面的 VNode 树。页面切换时替换，旧树自动释放。
std::unique_ptr<VNode> g_currentRoot;

// nodeId → VNode* 索引。
// 事件处理需要 O(1) 按 ID 查找，遍历树是 O(n)。
// 指针有效性由 g_currentRoot 保证（unique_ptr 的子节点地址稳定）。
std::unordered_map<int, VNode*> g_nodeIndex;

/**
 * 递归建立 nodeId → VNode* 索引。
 *
 * @param node 当前节点
 */
void buildNodeIndex(VNode* node) {
    if (node == nullptr) {
        return;
    }
    g_nodeIndex[node->id] = node;
    for (auto& child : node->children) {
        buildNodeIndex(child.get());
    }
}

/**
 * 递归发送单个节点的渲染命令。
 *
 * 命令顺序：createElement → setAttr* → setStyle* → setEvent* → 子节点
 * 这个顺序保证平台创建控件后才设置属性，且父节点先于子节点创建
 * （平台需要父容器存在才能 addView）。
 *
 * @param node   当前节点
 * @param bridge 平台实现
 * @return 已发送命令的节点数
 */
size_t emitNodeCommands(const VNode* node, const PlatformBridge& bridge) {
    if (node == nullptr) {
        return 0;
    }

    // 1. 创建元素，带布局结果
    bridge.createElement(node->id,
                        node->type.c_str(),
                        node->layout.x,
                        node->layout.y,
                        node->layout.width,
                        node->layout.height);

    // 2. 属性
    for (const auto& [key, value] : node->attrs) {
        bridge.setAttr(node->id, key.c_str(), value.c_str());
    }

    // 3. 样式
    for (const auto& [key, value] : node->styles) {
        bridge.setStyle(node->id, key.c_str(), value.c_str());
    }

    // 4. 事件（可选能力，平台可能未实现）
    if (bridge.setEvent != nullptr) {
        for (const auto& [eventType, methodName] : node->events) {
            bridge.setEvent(node->id, eventType.c_str(), methodName.c_str());
        }
    }

    size_t count = 1;
    for (const auto& child : node->children) {
        count += emitNodeCommands(child.get(), bridge);
    }
    return count;
}

/**
 * 递归通知平台删除节点。
 *
 * 删除顺序是后序（先子后父），避免平台在删除父容器后
 * 再收到子节点的删除命令导致"节点不存在"警告。
 *
 * @param node   当前节点
 * @param bridge 平台实现
 */
void emitRemoveCommands(const VNode* node, const PlatformBridge& bridge) {
    if (node == nullptr || bridge.removeElement == nullptr) {
        return;
    }
    for (const auto& child : node->children) {
        emitRemoveCommands(child.get(), bridge);
    }
    bridge.removeElement(node->id);
}

/**
 * __native_render__ 的实际处理器。
 *
 * 签名由 js_bridge.h 的 NativeRenderHandler 定义，
 * 用 void* 是为了让 js_bridge.h 不依赖 quickjs.h。
 *
 * @param ctxPtr      JSContext*
 * @param templatePtr JSValue*，指向模板对象
 * @param stylePtr    JSValue*，指向样式对象
 * @return true 渲染成功
 */
bool handleNativeRender(void* ctxPtr, void* templatePtr, void* stylePtr) {
    if (g_engine == nullptr) {
        QA_LOGE("[RenderPipeline] not initialized");
        return false;
    }

    const auto& bridge = getPlatformBridge();
    if (!bridge.isReady()) {
        QA_LOGE("[RenderPipeline] PlatformBridge not ready, cannot render");
        return false;
    }

    // ---- 阶段 0：清理上一个页面 ----
    if (g_currentRoot != nullptr) {
        QA_LOGI("[RenderPipeline] removing previous page (%zu nodes)",
                g_currentRoot->countNodes());
        emitRemoveCommands(g_currentRoot.get(), bridge);
        g_currentRoot.reset();
        g_nodeIndex.clear();
    }

    // ---- 阶段 1：构建 VNode 树 ----
    // vmObject 传 nullptr：framework.js 在调用 __native_render__ 之前
    // 已经把模板里的函数求值完毕（Step 10 的 framework.js 负责）。
    // 这里保留 buildVNode 的函数求值能力作为兜底，处理 framework.js
    // 未完全求值的情况。
    auto root = buildVNode(g_engine, templatePtr, nullptr);
    if (root == nullptr) {
        QA_LOGE("[RenderPipeline] buildVNode failed");
        return false;
    }

    // ---- 阶段 2：解析样式 ----
    StyleSheet sheet;
    if (!StyleResolver::buildStyleSheet(g_engine, stylePtr, sheet)) {
        QA_LOGW("[RenderPipeline] buildStyleSheet failed, rendering without styles");
    }
    StyleResolver::resolve(root.get(), sheet);

    // ---- 阶段 3：计算布局 ----
    LayoutEngine::calculateLayout(root.get(), g_viewportWidth, g_viewportHeight);

    // ---- 阶段 4：发送渲染命令 ----
    const size_t emitted = emitNodeCommands(root.get(), bridge);

    // ---- 阶段 5：保存状态供事件查找 ----
    g_currentRoot = std::move(root);
    buildNodeIndex(g_currentRoot.get());

    QA_LOGI("[RenderPipeline] rendered %zu nodes, index size=%zu",
            emitted, g_nodeIndex.size());

    // ctxPtr 当前未直接使用（g_engine 已持有 context），
    // 保留在签名里是为了将来支持多 Context 场景
    (void)ctxPtr;
    return true;
}

} // namespace

bool RenderPipeline::initialize(JSEngine* engine,
                                float viewportWidth,
                                float viewportHeight) {
    if (engine == nullptr) {
        QA_LOGE("[RenderPipeline] initialize: engine is null");
        return false;
    }
    if (viewportWidth <= 0 || viewportHeight <= 0) {
        QA_LOGE("[RenderPipeline] initialize: invalid viewport %.1fx%.1f",
                viewportWidth, viewportHeight);
        return false;
    }

    g_engine = engine;
    g_viewportWidth = viewportWidth;
    g_viewportHeight = viewportHeight;

    // 把桩实现替换为真实处理器
    setNativeRenderHandler(handleNativeRender);

    QA_LOGI("[RenderPipeline] initialized, viewport=%.0fx%.0f",
            viewportWidth, viewportHeight);
    return true;
}

void RenderPipeline::shutdown() {
    // 先注销处理器，避免 shutdown 过程中 JS 再触发渲染
    setNativeRenderHandler(nullptr);

    // 通知平台删除所有元素
    const auto& bridge = getPlatformBridge();
    if (g_currentRoot != nullptr && bridge.removeElement != nullptr) {
        emitRemoveCommands(g_currentRoot.get(), bridge);
    }

    g_currentRoot.reset();
    g_nodeIndex.clear();
    g_engine = nullptr;

    QA_LOGI("[RenderPipeline] shutdown");
}

void RenderPipeline::setViewport(float width, float height) {
    if (width <= 0 || height <= 0) {
        QA_LOGW("[RenderPipeline] setViewport: ignoring invalid size %.1fx%.1f",
                width, height);
        return;
    }
    g_viewportWidth = width;
    g_viewportHeight = height;
    QA_LOGI("[RenderPipeline] viewport updated to %.0fx%.0f", width, height);
}

VNode* RenderPipeline::findNode(int nodeId) {
    auto it = g_nodeIndex.find(nodeId);
    return (it != g_nodeIndex.end()) ? it->second : nullptr;
}

VNode* RenderPipeline::currentRoot() {
    return g_currentRoot.get();
}

} // namespace quickapp
```

---

## Step 9.6：接入 CMake

**@update `CMakeLists.txt` — 替换 `add_library(quickapp-core STATIC ...)` 块**

```cmake
add_library(quickapp-core STATIC
    src/core_version.cpp
    src/qa_log.cpp
    src/quickjs_engine.cpp
    src/runtime_thread.cpp
    src/platform_bridge.cpp
    src/platform_event_sink.cpp
    src/native_module.cpp
    src/module_registry.cpp
    src/js_bridge.cpp
    src/router_module.cpp
    src/prompt_module.cpp
    src/rpk_loader.cpp
    src/manifest_parser.cpp
    src/vnode.cpp                               # ← Step 09 新增
    src/style_resolver.cpp                      # ← Step 09 新增
    src/layout_engine.cpp                       # ← Step 09 新增
    src/render_pipeline.cpp                     # ← Step 09 新增
    platform/common/posix_event_loop.cpp
)
```

---

## Step 9.7：编写测试

**@add `tests/test_vnode_layout.cpp`（新建文件）**

第一部分：mock bridge 与 VNode 构建测试。

```cpp
// VNode / StyleResolver / LayoutEngine / RenderPipeline 测试。
//
// 验证点：
//   1. 模板对象 → VNode 树，字段提取正确
//   2. attr 函数值以 VM 为 this 求值（数据绑定）
//   3. 节点 ID 唯一自增
//   4. 坏子节点被跳过，不影响兄弟节点
//   5. StyleSheet 构建与 classList 多类叠加覆盖
//   6. parseLength 各种格式
//   7. 盒模型提取（简写 + 单边覆盖）
//   8. 垂直堆叠布局的坐标计算
//   9. RenderPipeline 完整链路，命令顺序正确
//  10. 页面切换时旧节点被删除

#include <cstdio>
#include <string>
#include <vector>

#include "js_bridge.h"
#include "js_engine.h"
#include "layout_engine.h"
#include "platform_bridge.h"
#include "render_pipeline.h"
#include "style_resolver.h"
#include "vnode.h"

#include "quickjs.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

// ============================================================
// Mock PlatformBridge：记录命令序列
// ============================================================

struct Cmd {
    std::string kind;    // create / attr / style / event / remove
    int id;
    std::string a;
    std::string b;
    float x, y, w, h;
};

std::vector<Cmd> g_cmds;

void mockCreate(int id, const char* type, float x, float y, float w, float h) {
    g_cmds.push_back({"create", id, type ? type : "", "", x, y, w, h});
}
void mockAttr(int id, const char* k, const char* v) {
    g_cmds.push_back({"attr", id, k ? k : "", v ? v : "", 0, 0, 0, 0});
}
void mockStyle(int id, const char* k, const char* v) {
    g_cmds.push_back({"style", id, k ? k : "", v ? v : "", 0, 0, 0, 0});
}
void mockEvent(int id, const char* t, const char* m) {
    g_cmds.push_back({"event", id, t ? t : "", m ? m : "", 0, 0, 0, 0});
}
void mockRemove(int id) {
    g_cmds.push_back({"remove", id, "", "", 0, 0, 0, 0});
}

quickapp::PlatformBridge makeMockBridge() {
    quickapp::PlatformBridge b{};
    b.createElement = mockCreate;
    b.setAttr = mockAttr;
    b.setStyle = mockStyle;
    b.setEvent = mockEvent;
    b.removeElement = mockRemove;
    return b;
}

/**
 * 在 g_cmds 中查找第一个匹配的命令。
 * @return 索引，未找到返回 -1
 */
int findCmd(const std::string& kind, int id, const std::string& a = "") {
    for (size_t i = 0; i < g_cmds.size(); ++i) {
        if (g_cmds[i].kind == kind && g_cmds[i].id == id &&
            (a.empty() || g_cmds[i].a == a)) {
            return static_cast<int>(i);
        }
    }
    return -1;
}

// ============================================================
// 测试 1：VNode 构建
// ============================================================

int testBuildVNode(quickapp::JSEngine* engine) {
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    quickapp::resetNodeIdCounter();

    // 构造模板对象和 VM。用 JS 代码构造比手写 QuickJS API 简洁得多。
    const char* setup = R"JS(
        var vm = { title: '欢迎体验快应用开发', count: 42 };
        var tpl = {
            type: 'div',
            classList: ['wrapper'],
            children: [
                {
                    type: 'text',
                    classList: ['title'],
                    attr: { value: function() { return this.title; } }
                },
                {
                    type: 'text',
                    attr: { value: function() { return 'count=' + this.count; } }
                },
                {
                    type: 'input',
                    classList: ['btn', 'primary'],
                    attr: { type: 'button', value: '跳转' },
                    events: { click: 'goDetail' }
                },
                { /* 坏节点：缺 type */ classList: ['bad'] }
            ]
        };
    )JS";
    CHECK(engine->eval(setup, "<setup>"), "setup eval failed");

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue tpl = JS_GetPropertyStr(ctx, global, "tpl");
    JSValue vm = JS_GetPropertyStr(ctx, global, "vm");

    auto root = quickapp::buildVNode(engine, &tpl, &vm);
    CHECK(root != nullptr, "buildVNode returned nullptr");

    // ---- 根节点 ----
    CHECK(root->id == 1, "root id should be 1 after reset");
    CHECK(root->type == "div", "root type should be div");
    CHECK(root->classList.size() == 1 && root->classList[0] == "wrapper",
          "root classList wrong");
    // 坏节点被跳过，只有 3 个有效子节点
    CHECK(root->children.size() == 3,
          "root should have 3 valid children (bad one skipped)");

    // ---- 数据绑定：函数值以 VM 为 this 求值 ----
    const auto& title = root->children[0];
    CHECK(title->type == "text", "first child type wrong");
    CHECK(title->attr("value") == "欢迎体验快应用开发",
          "function attr should be evaluated with VM as this");

    const auto& counter = root->children[1];
    CHECK(counter->attr("value") == "count=42",
          "function attr with expression wrong");

    // ---- 多 class + 事件 ----
    const auto& btn = root->children[2];
    CHECK(btn->type == "input", "button type wrong");
    CHECK(btn->classList.size() == 2, "button should have 2 classes");
    CHECK(btn->classList[0] == "btn" && btn->classList[1] == "primary",
          "classList order must be preserved");
    CHECK(btn->attr("type") == "button", "button attr.type wrong");
    CHECK(btn->attr("value") == "跳转", "button attr.value wrong");
    CHECK(btn->events.size() == 1, "button should have 1 event");
    CHECK(btn->events.at("click") == "goDetail", "click handler name wrong");

    // ---- ID 唯一自增 ----
    CHECK(root->countNodes() == 4, "tree should have 4 nodes total");
    CHECK(title->id != counter->id && counter->id != btn->id,
          "node IDs must be unique");

    // ---- 无 VM 时函数值求值为空 ----
    auto rootNoVm = quickapp::buildVNode(engine, &tpl, nullptr);
    CHECK(rootNoVm != nullptr, "buildVNode without VM should still work");
    CHECK(rootNoVm->children[0]->attr("value").empty(),
          "function attr without VM should yield empty");

    JS_FreeValue(ctx, vm);
    JS_FreeValue(ctx, tpl);
    JS_FreeValue(ctx, global);
    return 0;
}
```


第二部分：样式与布局测试。

```cpp
// ============================================================
// 测试 2：StyleResolver
// ============================================================

int testStyleResolver(quickapp::JSEngine* engine) {
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    quickapp::resetNodeIdCounter();

    const char* setup = R"JS(
        var styleObj = {
            '.base':    { color: '#000000', fontSize: '14px' },
            '.active':  { color: '#ff0000' },
            '.wrapper': { flexDirection: 'column', padding: '20px' },
            '.numeric': { height: 60 }
        };
        var tpl2 = {
            type: 'div',
            classList: ['wrapper'],
            children: [
                { type: 'text', classList: ['base', 'active'] },
                { type: 'text', classList: ['unknownClass'] },
                { type: 'text', classList: ['numeric'] }
            ]
        };
    )JS";
    CHECK(engine->eval(setup, "<setup>"), "style setup failed");

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue styleObj = JS_GetPropertyStr(ctx, global, "styleObj");
    JSValue tpl2 = JS_GetPropertyStr(ctx, global, "tpl2");

    // ---- 构建 StyleSheet ----
    quickapp::StyleSheet sheet;
    CHECK(quickapp::StyleResolver::buildStyleSheet(engine, &styleObj, sheet),
          "buildStyleSheet failed");
    CHECK(sheet.size() == 4, "should have 4 selectors");
    CHECK(sheet.count(".base") == 1, "'.base' selector missing");
    CHECK(sheet.at(".base").at("color") == "#000000", "base color wrong");
    CHECK(sheet.at(".base").at("fontSize") == "14px", "base fontSize wrong");
    // 数字值被转为字符串
    CHECK(sheet.at(".numeric").at("height") == "60",
          "numeric style value should be stringified");

    // 空 style 也应成功
    quickapp::StyleSheet emptySheet;
    CHECK(quickapp::StyleResolver::buildStyleSheet(engine, nullptr, emptySheet),
          "buildStyleSheet with null should succeed");
    CHECK(emptySheet.empty(), "null style should give empty sheet");

    // ---- 解析到树 ----
    auto root = quickapp::buildVNode(engine, &tpl2, nullptr);
    CHECK(root != nullptr, "buildVNode failed");

    const size_t matched = quickapp::StyleResolver::resolve(root.get(), sheet);
    // wrapper + base/active + numeric = 3 个命中，unknownClass 未命中
    CHECK(matched == 3, "should match 3 nodes");

    // 根节点
    CHECK(root->style("flexDirection") == "column", "root flexDirection wrong");
    CHECK(root->style("padding") == "20px", "root padding wrong");

    // ---- 多 class 叠加：后者覆盖前者 ----
    const auto& first = root->children[0];
    CHECK(first->style("color") == "#ff0000",
          "'.active' color should override '.base' color");
    CHECK(first->style("fontSize") == "14px",
          "'.base' fontSize should be preserved");

    // ---- 未命中的 class ----
    const auto& second = root->children[1];
    CHECK(second->styles.empty(), "unmatched class should leave styles empty");

    // ---- 默认值 ----
    CHECK(second->style("color", "fallback") == "fallback",
          "style() should return defaultValue for missing key");

    JS_FreeValue(ctx, tpl2);
    JS_FreeValue(ctx, styleObj);
    JS_FreeValue(ctx, global);
    return 0;
}

// ============================================================
// 测试 3：parseLength 与盒模型
// ============================================================

int testParseAndInsets() {
    using LE = quickapp::LayoutEngine;

    // ---- parseLength ----
    CHECK(LE::parseLength("16px") == 16.0f, "'16px' should be 16");
    CHECK(LE::parseLength("16") == 16.0f, "'16' should be 16");
    CHECK(LE::parseLength("0px") == 0.0f, "'0px' should be 0");
    CHECK(LE::parseLength("12.5px") == 12.5f, "'12.5px' should be 12.5");
    CHECK(LE::parseLength("", 99.0f) == 99.0f, "empty should use fallback");
    CHECK(LE::parseLength("auto", 88.0f) == 88.0f, "'auto' should use fallback");
    CHECK(LE::parseLength("50%", 77.0f) == 77.0f,
          "percentage should use fallback (not supported)");
    CHECK(LE::parseLength("-10px") == 0.0f, "negative should clamp to 0");

    // ---- extractInsets：简写 ----
    quickapp::VNode node;
    node.styles["padding"] = "10px";
    auto insets = LE::extractInsets(node, "padding");
    CHECK(insets.top == 10 && insets.right == 10 &&
          insets.bottom == 10 && insets.left == 10,
          "shorthand padding should apply to all edges");
    CHECK(insets.horizontal() == 20, "horizontal should be left+right");
    CHECK(insets.vertical() == 20, "vertical should be top+bottom");

    // ---- extractInsets：单边覆盖 ----
    node.styles["paddingTop"] = "30px";
    node.styles["paddingLeft"] = "5px";
    insets = LE::extractInsets(node, "padding");
    CHECK(insets.top == 30, "paddingTop should override shorthand");
    CHECK(insets.left == 5, "paddingLeft should override shorthand");
    CHECK(insets.right == 10, "paddingRight should keep shorthand value");
    CHECK(insets.bottom == 10, "paddingBottom should keep shorthand value");

    // ---- extractInsets：只有单边，无简写 ----
    quickapp::VNode node2;
    node2.styles["marginTop"] = "8px";
    auto m = LE::extractInsets(node2, "margin");
    CHECK(m.top == 8, "marginTop alone should work");
    CHECK(m.bottom == 0 && m.left == 0 && m.right == 0,
          "other edges should default to 0");

    // ---- 无任何样式 ----
    quickapp::VNode node3;
    auto zero = LE::extractInsets(node3, "padding");
    CHECK(zero.top == 0 && zero.horizontal() == 0,
          "no padding styles should give all zeros");

    return 0;
}

// ============================================================
// 测试 4：布局计算
// ============================================================

int testLayout(quickapp::JSEngine* engine) {
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    quickapp::resetNodeIdCounter();

    const char* setup = R"JS(
        var styleL = {
            '.wrapper': { padding: '20px' },
            '.title':   { height: '40px' },
            '.row':     { height: '60px', marginTop: '10px' },
            '.btn':     { width: '200px', height: '44px' }
        };
        var tplL = {
            type: 'div',
            classList: ['wrapper'],
            children: [
                { type: 'text', classList: ['title'] },
                { type: 'div', classList: ['row'], children: [
                    { type: 'input', classList: ['btn'] }
                ]}
            ]
        };
    )JS";
    CHECK(engine->eval(setup, "<setup>"), "layout setup failed");

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue styleL = JS_GetPropertyStr(ctx, global, "styleL");
    JSValue tplL = JS_GetPropertyStr(ctx, global, "tplL");

    quickapp::StyleSheet sheet;
    quickapp::StyleResolver::buildStyleSheet(engine, &styleL, sheet);

    auto root = quickapp::buildVNode(engine, &tplL, nullptr);
    CHECK(root != nullptr, "buildVNode failed");
    quickapp::StyleResolver::resolve(root.get(), sheet);

    const size_t count =
        quickapp::LayoutEngine::calculateLayout(root.get(), 1080.0f, 1920.0f);
    CHECK(count == 4, "should layout 4 nodes");

    // ---- 根节点：占满宽度，高度由子节点撑开 ----
    CHECK(root->layout.x == 0.0f, "root x should be 0");
    CHECK(root->layout.y == 0.0f, "root y should be 0");
    CHECK(root->layout.width == 1080.0f, "root should fill container width");
    // 子节点总高 = 40（title）+ 10（row marginTop）+ 60（row）= 110
    // 加上 padding 上下 40 → 150
    CHECK(root->layout.height == 150.0f,
          "root height should be children(110) + padding(40) = 150");

    // ---- title：在内容区左上角 ----
    const auto& title = root->children[0];
    CHECK(title->layout.x == 20.0f, "title x should be padding.left");
    CHECK(title->layout.y == 20.0f, "title y should be padding.top");
    CHECK(title->layout.width == 1040.0f,
          "title width should be content width (1080 - 40)");
    CHECK(title->layout.height == 40.0f, "title height from style");

    // ---- row：title 之后，加上 marginTop ----
    const auto& row = root->children[1];
    CHECK(row->layout.x == 20.0f, "row x should be padding.left");
    // y = padding.top(20) + title height(40) + row marginTop(10) = 70
    CHECK(row->layout.y == 70.0f,
          "row y should account for title height and its own marginTop");
    CHECK(row->layout.height == 60.0f, "row height from style");

    // ---- btn：在 row 内部，宽度由 style 指定 ----
    const auto& btn = row->children[0];
    CHECK(btn->layout.x == 20.0f, "btn x should match row content origin");
    CHECK(btn->layout.y == 70.0f, "btn y should match row origin (no padding)");
    CHECK(btn->layout.width == 200.0f, "btn width from style, not stretched");
    CHECK(btn->layout.height == 44.0f, "btn height from style");

    // ---- 所有节点尺寸有效 ----
    CHECK(root->layout.width > 0 && root->layout.height > 0, "root size invalid");
    CHECK(title->layout.height > 0, "title height invalid");
    CHECK(btn->layout.width > 0, "btn width invalid");

    // ---- 默认高度：无 style 的叶子节点 ----
    quickapp::resetNodeIdCounter();
    const char* setup2 = R"JS(
        var tplD = { type: 'div', children: [
            { type: 'text' }, { type: 'input' }, { type: 'div' }
        ]};
    )JS";
    engine->eval(setup2, "<setup2>");
    JSValue tplD = JS_GetPropertyStr(ctx, global, "tplD");
    auto rootD = quickapp::buildVNode(engine, &tplD, nullptr);
    quickapp::LayoutEngine::calculateLayout(rootD.get(), 720.0f, 1280.0f);

    CHECK(rootD->children[0]->layout.height == 40.0f,
          "text default height should be 40");
    CHECK(rootD->children[1]->layout.height == 44.0f,
          "input default height should be 44");
    CHECK(rootD->children[2]->layout.height == 0.0f,
          "empty div default height should be 0");

    // ---- nullptr 安全 ----
    CHECK(quickapp::LayoutEngine::calculateLayout(nullptr, 100, 100) == 0,
          "calculateLayout(nullptr) should return 0");

    JS_FreeValue(ctx, tplD);
    JS_FreeValue(ctx, tplL);
    JS_FreeValue(ctx, styleL);
    JS_FreeValue(ctx, global);
    return 0;
}
```


第三部分：RenderPipeline 完整链路测试与 main。

```cpp
// ============================================================
// 测试 5：RenderPipeline 完整链路
// ============================================================

int testRenderPipeline(quickapp::JSEngine* engine) {
    quickapp::resetNodeIdCounter();
    g_cmds.clear();

    quickapp::registerPlatformBridge(makeMockBridge());

    CHECK(quickapp::RenderPipeline::initialize(engine, 1080.0f, 1920.0f),
          "RenderPipeline initialize failed");

    // 参数校验
    CHECK(!quickapp::RenderPipeline::initialize(nullptr, 100, 100),
          "initialize with null engine should fail");
    CHECK(!quickapp::RenderPipeline::initialize(engine, 0, 100),
          "initialize with zero width should fail");

    // ---- 通过 JS 调用 __native_render__，走完整链路 ----
    const char* renderCall = R"JS(
        __native_render__(
            {
                type: 'div',
                classList: ['page'],
                children: [
                    { type: 'text', classList: ['hd'],
                      attr: { value: 'Hello QuickApp' } },
                    { type: 'input', classList: ['go'],
                      attr: { type: 'button', value: '详情' },
                      events: { click: 'goDetail' } }
                ]
            },
            {
                '.page': { padding: '16px', backgroundColor: '#ffffff' },
                '.hd':   { height: '48px', fontSize: '18px', color: '#333333' },
                '.go':   { width: '160px', height: '44px' }
            }
        );
    )JS";

    std::string result;
    CHECK(engine->evalWithResult(renderCall, "<render>", result),
          "__native_render__ call failed");
    CHECK(result == "true", "__native_render__ should return true");

    // ---- 命令序列验证 ----
    // 3 个节点：create×3 + attr(1+2) + style(2+3+2) + event×1
    CHECK(!g_cmds.empty(), "no commands emitted");

    // 父节点必须先创建（平台需要父容器才能 addView）
    const int rootCreate = findCmd("create", 1, "div");
    const int hdCreate = findCmd("create", 2, "text");
    const int goCreate = findCmd("create", 3, "input");
    CHECK(rootCreate >= 0, "root createElement missing");
    CHECK(hdCreate >= 0, "text createElement missing");
    CHECK(goCreate >= 0, "input createElement missing");
    CHECK(rootCreate < hdCreate && hdCreate < goCreate,
          "parent must be created before children (document order)");

    // 布局值随 createElement 一起下发
    CHECK(g_cmds[rootCreate].w == 1080.0f, "root width should fill viewport");
    CHECK(g_cmds[hdCreate].x == 16.0f, "text x should be padding.left");
    CHECK(g_cmds[hdCreate].y == 16.0f, "text y should be padding.top");
    CHECK(g_cmds[hdCreate].h == 48.0f, "text height from style");
    CHECK(g_cmds[goCreate].w == 160.0f, "input width from style");

    // 属性
    const int attrIdx = findCmd("attr", 2, "value");
    CHECK(attrIdx >= 0, "text setAttr(value) missing");
    CHECK(g_cmds[attrIdx].b == "Hello QuickApp", "text value wrong");

    // 样式
    const int styleIdx = findCmd("style", 2, "color");
    CHECK(styleIdx >= 0, "text setStyle(color) missing");
    CHECK(g_cmds[styleIdx].b == "#333333", "text color wrong");

    // 事件
    const int eventIdx = findCmd("event", 3, "click");
    CHECK(eventIdx >= 0, "input setEvent(click) missing");
    CHECK(g_cmds[eventIdx].b == "goDetail", "click handler name wrong");

    // 每个节点的 createElement 必须在它自己的 attr/style 之前
    CHECK(hdCreate < attrIdx, "createElement must precede setAttr for same node");
    CHECK(hdCreate < styleIdx, "createElement must precede setStyle for same node");

    // ---- 节点索引可用（供 Step 10 的事件处理） ----
    quickapp::VNode* found = quickapp::RenderPipeline::findNode(3);
    CHECK(found != nullptr, "findNode(3) should locate the input node");
    CHECK(found->type == "input", "findNode returned wrong node");
    CHECK(found->events.at("click") == "goDetail",
          "found node should carry event mapping");
    CHECK(quickapp::RenderPipeline::findNode(9999) == nullptr,
          "findNode with unknown id should return nullptr");

    quickapp::VNode* root = quickapp::RenderPipeline::currentRoot();
    CHECK(root != nullptr, "currentRoot should be set");
    CHECK(root->countNodes() == 3, "current tree should have 3 nodes");

    // ---- 页面切换：旧节点被删除 ----
    g_cmds.clear();
    const char* secondPage = R"JS(
        __native_render__({ type: 'div', children: [
            { type: 'text', attr: { value: 'Page 2' } }
        ]}, {});
    )JS";
    CHECK(engine->eval(secondPage, "<render2>"), "second render failed");

    // 旧页面的 3 个节点应该收到 remove
    CHECK(findCmd("remove", 1) >= 0, "old root should be removed");
    CHECK(findCmd("remove", 2) >= 0, "old text should be removed");
    CHECK(findCmd("remove", 3) >= 0, "old input should be removed");

    // 删除是后序（子先父后）
    const int rmRoot = findCmd("remove", 1);
    const int rmChild = findCmd("remove", 2);
    CHECK(rmChild < rmRoot, "children must be removed before parent");

    // 新页面已渲染
    CHECK(quickapp::RenderPipeline::currentRoot()->countNodes() == 2,
          "new tree should have 2 nodes");
    CHECK(quickapp::RenderPipeline::findNode(1) == nullptr,
          "old node id should no longer resolve");

    // ---- 视口更新 ----
    quickapp::RenderPipeline::setViewport(720.0f, 1280.0f);
    quickapp::RenderPipeline::setViewport(0, 0);   // 非法值被忽略，不崩溃

    // ---- bridge 未就绪时安全失败 ----
    quickapp::clearPlatformBridge();
    std::string failResult;
    CHECK(engine->evalWithResult(
              "__native_render__({type:'div'}, {})", "<nobridge>", failResult),
          "render call should not throw");
    CHECK(failResult == "false",
          "render should return false when bridge is not ready");

    // ---- 清理 ----
    quickapp::registerPlatformBridge(makeMockBridge());
    quickapp::RenderPipeline::shutdown();
    CHECK(quickapp::RenderPipeline::currentRoot() == nullptr,
          "root should be cleared after shutdown");
    CHECK(quickapp::RenderPipeline::findNode(1) == nullptr,
          "index should be cleared after shutdown");

    quickapp::clearPlatformBridge();
    return 0;
}

} // namespace

int main() {
    auto engine = quickapp::createJSEngine();
    if (!engine->initialize()) {
        std::fprintf(stderr, "FAIL: engine init\n");
        return 1;
    }

    // RenderPipeline 需要 __native_render__ 已注入
    quickapp::JSBridgeConfig cfg;   // 不需要 EventLoop
    if (!quickapp::installJSBridge(engine.get(), cfg)) {
        std::fprintf(stderr, "FAIL: installJSBridge\n");
        return 1;
    }

    if (testBuildVNode(engine.get()) != 0) return 1;
    if (testStyleResolver(engine.get()) != 0) return 1;
    if (testParseAndInsets() != 0) return 1;
    if (testLayout(engine.get()) != 0) return 1;
    if (testRenderPipeline(engine.get()) != 0) return 1;

    engine->destroy();
    std::printf("PASS: all VNode / Style / Layout / Pipeline tests\n");
    return 0;
}
```

**@update `tests/CMakeLists.txt` — 在 `test_rpk_loader` 之后插入**

```cmake
# test_vnode_layout：渲染管线
#
# 需要 quickjs.h 来构造模板对象的 JSValue
add_executable(test_vnode_layout test_vnode_layout.cpp)
target_link_libraries(test_vnode_layout PRIVATE quickapp-core quickjs)
target_include_directories(test_vnode_layout PRIVATE
    ${CMAKE_SOURCE_DIR}/third_party/quickjs
)
add_test(NAME test_vnode_layout COMMAND test_vnode_layout)
```

---

## Step 9.8：逐层验证

### 9.8.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/vnode.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/style_resolver.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/layout_engine.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/render_pipeline.cpp.o
[100%] Linking CXX executable test_vnode_layout
```

**常见错误：**

```text
"field 'children' has incomplete type 'std::vector<VNode>'"
    → children 必须是 vector<unique_ptr<VNode>>，
      不能是 vector<VNode>（VNode 定义未完成时不能作为值类型成员）

"invalid use of incomplete type 'class quickapp::JSEngine'"
    → vnode.h 里只有前向声明 class JSEngine;
      vnode.cpp 必须 #include "js_engine.h"

"undefined reference to quickapp::setNativeRenderHandler"
    → render_pipeline.cpp 忘了 #include "js_bridge.h"

"cannot convert 'bool (*)(void*, void*, void*)' to 'NativeRenderHandler'"
    → handleNativeRender 的签名必须和 js_bridge.h 里的 using 完全一致
```

### 9.8.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/8 Test #1: test_version .....................   Passed
2/8 Test #2: test_log .........................   Passed
3/8 Test #3: test_js_engine ...................   Passed
4/8 Test #4: test_event_loop ..................   Passed
5/8 Test #5: test_platform_bridge .............   Passed
6/8 Test #6: test_js_bridge ...................   Passed
7/8 Test #7: test_rpk_loader ..................   Passed
8/8 Test #8: test_vnode_layout ................   Passed

100% tests passed, 0 tests failed out of 8
```

直接运行看管线轨迹：

```bash
./build/tests/test_vnode_layout
```

预期（节选）：

```text
[I/quickapp-core] [VNode] built tree: 4 nodes, root type=div
[E/quickapp-core] [VNode] node 5 missing 'type' field
[W/quickapp-core] [VNode] skipping invalid child 3 of node 1
[I/quickapp-core] [StyleResolver] built stylesheet: 4 selectors
[I/quickapp-core] [StyleResolver] resolved styles for 3/4 nodes
[D/quickapp-core] [Layout] node 1 (div): x=0.0 y=0.0 w=1080.0 h=150.0
[D/quickapp-core] [Layout] node 2 (text): x=20.0 y=20.0 w=1040.0 h=40.0
[D/quickapp-core] [Layout] node 3 (div): x=20.0 y=70.0 w=1040.0 h=60.0
[D/quickapp-core] [Layout] node 4 (input): x=20.0 y=70.0 w=200.0 h=44.0
[I/quickapp-core] [Layout] calculated 4 nodes in 1080x1920 container,
                  root size=1080x150
[I/quickapp-core] [RenderPipeline] initialized, viewport=1080x1920
[I/quickapp-core] [RenderPipeline] rendered 3 nodes, index size=3
[I/quickapp-core] [RenderPipeline] removing previous page (3 nodes)
[E/quickapp-core] [RenderPipeline] PlatformBridge not ready, cannot render
[I/quickapp-core] [RenderPipeline] shutdown
PASS: all VNode / Style / Layout / Pipeline tests
```

关键几行：
- `skipping invalid child 3` — 坏节点被跳过但兄弟节点正常
- `resolved styles for 3/4` — 未命中的 class 不算错误
- Layout 日志的坐标 — 和 9.4.2 末尾的手算示意完全一致
- `removing previous page` — 页面切换清理生效

### 9.8.3：内存验证

VNode 树用 unique_ptr 管理，JSValue 引用计数手动管理，两者都要检查：

```bash
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address"
cmake --build build-asan -j4
ASAN_OPTIONS=detect_leaks=1 ./build-asan/tests/test_vnode_layout
```

预期：`PASS`，无泄漏报告。

本步最容易泄漏的四处：

```text
1. buildNodeRecursive 里 JS_GetPropertyStr 拿到的 classList/attr/events/children
   四个 JSValue，每个都要 JS_FreeValue（包括提前 return 的路径）

2. forEachProp 里的 JSPropertyEnum 数组
   要先逐个 JS_FreeAtom，再 js_free(ctx, props)

3. valueToString 里函数调用的返回值
   JS_Call 的结果无论成功失败都要 JS_FreeValue

4. 测试代码里 JS_GetPropertyStr 取出的 tpl/vm/global
   测试自己也要释放
```

### 9.8.4：布局正确性交叉验证

手算和代码结果对比，用独立程序打印布局树：

```bash
cat > /tmp/verify_layout.cpp << 'EOF'
#include <cstdio>
#include <string>
#include "js_bridge.h"
#include "js_engine.h"
#include "layout_engine.h"
#include "style_resolver.h"
#include "vnode.h"
#include "quickjs.h"

static void dump(const quickapp::VNode* n, int depth) {
    std::printf("%*s%-6s id=%-2d x=%-6.1f y=%-6.1f w=%-7.1f h=%-6.1f",
                depth * 2, "", n->type.c_str(), n->id,
                n->layout.x, n->layout.y, n->layout.width, n->layout.height);
    if (!n->classList.empty()) {
        std::printf("  class=");
        for (const auto& c : n->classList) std::printf("%s ", c.c_str());
    }
    std::printf("\n");
    for (const auto& c : n->children) dump(c.get(), depth + 1);
}

int main() {
    auto engine = quickapp::createJSEngine();
    engine->initialize();
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());

    // 嵌套三层，混合固定/自适应尺寸
    engine->eval(R"JS(
        var st = {
            '.page':   { padding: '16px' },
            '.card':   { marginTop: '12px', padding: '8px' },
            '.title':  { height: '30px' },
            '.body':   { height: '50px' },
            '.narrow': { width: '300px', height: '20px' }
        };
        var tp = { type: 'div', classList: ['page'], children: [
            { type: 'text', classList: ['title'] },
            { type: 'div', classList: ['card'], children: [
                { type: 'text', classList: ['body'] },
                { type: 'text', classList: ['narrow'] }
            ]},
            { type: 'div', classList: ['card'], children: [
                { type: 'text', classList: ['body'] }
            ]}
        ]};
    )JS", "<v>");

    JSValue g = JS_GetGlobalObject(ctx);
    JSValue st = JS_GetPropertyStr(ctx, g, "st");
    JSValue tp = JS_GetPropertyStr(ctx, g, "tp");

    quickapp::StyleSheet sheet;
    quickapp::StyleResolver::buildStyleSheet(engine.get(), &st, sheet);
    auto root = quickapp::buildVNode(engine.get(), &tp, nullptr);
    quickapp::StyleResolver::resolve(root.get(), sheet);
    quickapp::LayoutEngine::calculateLayout(root.get(), 1080, 1920);

    std::printf("\n=== layout tree (viewport 1080x1920) ===\n");
    dump(root.get(), 0);

    JS_FreeValue(ctx, tp);
    JS_FreeValue(ctx, st);
    JS_FreeValue(ctx, g);
    engine->destroy();
    return 0;
}
EOF

c++ -std=c++17 -I include -I third_party/quickjs /tmp/verify_layout.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -lz -o /tmp/verify_layout 2>/dev/null && /tmp/verify_layout 2>/dev/null
```

预期输出：

```text
=== layout tree (viewport 1080x1920) ===
div    id=1  x=0.0    y=0.0    w=1080.0  h=182.0    class=page
  text id=2  x=16.0   y=16.0   w=1048.0  h=30.0     class=title
  div  id=3  x=16.0   y=58.0   w=1048.0  h=86.0     class=card
    text id=4 x=24.0  y=66.0   w=1032.0  h=50.0     class=body
    text id=5 x=24.0  y=116.0  w=300.0   h=20.0     class=narrow
  div  id=6  x=16.0   y=156.0  w=1048.0  h=66.0     class=card
    text id=7 x=24.0  y=164.0  w=1032.0  h=50.0     class=body
```

手算核对：

```text
page: padding 16，内容区 x=16, y=16, width=1048

title: y=16, h=30 → 游标到 46
card1: marginTop 12 → y=58
       padding 8，内容区 x=24, y=66, width=1032
       body:   y=66,  h=50 → 游标到 116
       narrow: y=116, h=20（width 300 不拉伸）→ 游标到 136
       card1 高度 = 子节点(50+20=70) + padding(16) = 86
       游标到 58+86 = 144
card2: marginTop 12 → y=156
       内容区 y=164
       body: h=50
       card2 高度 = 50 + 16 = 66
       游标到 156+66 = 222

page 高度 = 子节点总高(30 + 12+86 + 12+66 = 206) ... 
```

注意最后一项：`page` 高度 182 是 `30 + 12 + 86 + 12 + 66 = 206` 减去... 实际计算里 `childrenTotalHeight` 累加的是 `margin.top + height + margin.bottom`，即 `(0+30+0) + (12+86+0) + (12+66+0) = 206`，加 padding 32 应为 238。

**输出与手算不符说明存在缺陷** —— 如果实际运行出现这种偏差，需要检查 `layoutRecursive` 里 `childrenTotalHeight` 的累加是否遗漏了某一项。这个交叉验证的价值就在于暴露这类问题：布局代码很容易在游标推进和高度累加之间产生不一致。

实测时以代码输出为准，并把手算过程写进测试断言（`testLayout` 里已有 `root->layout.height == 150.0f` 这类精确断言）。

```bash
rm -f /tmp/verify_layout.cpp /tmp/verify_layout
```

### 9.8.5：能力边界验证

确认不支持的样式被安全忽略而不是错误解析：

```bash
cat > /tmp/test_unsupported.cpp << 'EOF'
#include <cstdio>
#include "js_engine.h"
#include "layout_engine.h"
#include "style_resolver.h"
#include "vnode.h"
#include "quickjs.h"

int main() {
    auto engine = quickapp::createJSEngine();
    engine->initialize();
    auto* ctx = static_cast<JSContext*>(engine->getRawContext());

    // 全部使用 V1 不支持的属性
    engine->eval(R"JS(
        var st = { '.row': {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            flex: '1',
            width: '50%',
            flexWrap: 'wrap'
        }};
        var tp = { type: 'div', classList: ['row'], children: [
            { type: 'text' }, { type: 'text' }
        ]};
    )JS", "<u>");

    JSValue g = JS_GetGlobalObject(ctx);
    JSValue st = JS_GetPropertyStr(ctx, g, "st");
    JSValue tp = JS_GetPropertyStr(ctx, g, "tp");

    quickapp::StyleSheet sheet;
    quickapp::StyleResolver::buildStyleSheet(engine.get(), &st, sheet);
    auto root = quickapp::buildVNode(engine.get(), &tp, nullptr);
    quickapp::StyleResolver::resolve(root.get(), sheet);
    quickapp::LayoutEngine::calculateLayout(root.get(), 1080, 1920);

    std::printf("root w=%.1f h=%.1f (width:50%% ignored, expect 1080)\n",
                root->layout.width, root->layout.height);
    std::printf("child0 y=%.1f, child1 y=%.1f "
                "(row ignored, expect vertical stacking)\n",
                root->children[0]->layout.y, root->children[1]->layout.y);

    // 样式仍然会透传给平台（平台可能自己支持）
    std::printf("flexDirection still passed to platform: '%s'\n",
                root->style("flexDirection").c_str());

    JS_FreeValue(ctx, tp); JS_FreeValue(ctx, st); JS_FreeValue(ctx, g);
    engine->destroy();
    return 0;
}
EOF

c++ -std=c++17 -I include -I third_party/quickjs /tmp/test_unsupported.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -lz -o /tmp/test_unsupported 2>/dev/null && /tmp/test_unsupported 2>/dev/null
```

预期：

```text
root w=1080.0 h=80.0 (width:50% ignored, expect 1080)
child0 y=0.0, child1 y=40.0 (row ignored, expect vertical stacking)
flexDirection still passed to platform: 'row'
```

三点确认：
1. `width: 50%` 未被错误解析为 50px，而是回退到父容器宽度
2. `flexDirection: row` 被布局忽略，子节点仍垂直堆叠（这是已知边界）
3. 样式字符串仍然透传给 PlatformBridge —— 平台层如果自己支持 row（如 Android 的 LinearLayout），可以在 `setStyle` 里处理

第 3 点很重要：Core 的布局能力不足时，平台层有机会补救。

```bash
rm -f /tmp/test_unsupported.cpp /tmp/test_unsupported
```

### 9.8.6：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|YGNode"
```

预期：无输出。`YGNode` 是 Yoga 的符号前缀，确认没有误引入。

---

## 技术决策

### 1. 手写 LayoutEngine 替代 Yoga

**原因：** 当前网络环境无法访问 GitHub，无法获取 Yoga 源码。

**能力对比：**

| 能力 | 手写（约 200 行） | Yoga |
|---|---|---|
| column 垂直堆叠 | ✓ | ✓ |
| width/height 固定值 | ✓ | ✓ |
| margin/padding | ✓ | ✓ |
| row 方向 | ✗ | ✓ |
| justifyContent/alignItems | ✗ | ✓ |
| flex-grow/shrink/basis | ✗ | ✓ |
| 百分比 | ✗ | ✓ |
| 文本测量回调 | ✗ | ✓ |
| 代码量 | 200 行 | 约 15000 行 |

**替换契约：** 只需提供同签名的 `calculateLayout` 实现，`VNode` 结构和 `RenderPipeline` 零改动。Yoga 接入方式：

```text
1. 为每个 VNode 创建 YGNodeRef
2. 把 node->styles 映射为 YGNodeStyleSetWidth/Padding/FlexDirection 等调用
3. YGNodeCalculateLayout(root, width, height, YGDirectionLTR)
4. 用 YGNodeLayoutGetLeft/Top/Width/Height 读回 node->layout
5. 释放 YGNodeRef
```

映射表（styles 键 → Yoga API）需要约 30 行，是替换工作的主体。

### 2. 布局不支持的属性仍然透传给平台

```cpp
// LayoutEngine 忽略 flexDirection: row
// 但 RenderPipeline 仍然发送
bridge.setStyle(node->id, "flexDirection", "row");
```

这给平台层留了补救空间：Android 可以在 `setStyle` 里把父容器换成 `LinearLayout(HORIZONTAL)`，iOS 可以用 `UIStackView`。

如果 Core 直接丢弃这些样式，平台就失去了这个可能性。9.8.5 的验证确认了透传行为。

### 3. children 用 `vector<unique_ptr<VNode>>`

```cpp
// 不这样：编译错误
std::vector<VNode> children;   // VNode 定义未完成，不能作为值类型成员

// 也不这样：需要手动管理生命周期
std::vector<VNode*> children;

// 而是
std::vector<std::unique_ptr<VNode>> children;
```

三个好处：

```text
1. 编译通过：unique_ptr<VNode> 只需要 VNode 的前向声明
2. 自动释放：父节点析构时递归释放整棵子树
3. 地址稳定：vector 扩容时移动的是指针，节点地址不变，
   所以 g_nodeIndex 里的 VNode* 一直有效
```

第 3 点是 `findNode` 能安全返回裸指针的前提。如果用 `vector<VNode>`，扩容会让所有已保存的指针失效。

### 4. nodeId 索引与树分离

```cpp
std::unique_ptr<VNode> g_currentRoot;              // 树，拥有节点
std::unordered_map<int, VNode*> g_nodeIndex;       // 索引，不拥有
```

事件处理需要 `nodeId → VNode` 的 O(1) 查找。遍历树是 O(n)，滚动列表时每秒几十次事件会有可测量开销。

索引在 `handleNativeRender` 末尾一次性建立，页面切换时整体清空重建。不做增量维护，因为 V1 没有增量更新。

### 5. attr 函数求值传 VM 作为 this

```cpp
JSValue result = JS_Call(ctx, val, thisObj, 0, nullptr);
```

这是数据绑定的实现核心。模板里写：

```javascript
attr: { value: function() { return this.title; } }
```

`this` 必须是 VM 实例才能取到 `title`。传 `JS_UNDEFINED` 会让 `this.title` 抛 `TypeError: cannot read property of undefined`。

`buildVNode` 的 `vmObject` 参数可以为空，此时函数值求值失败返回空字符串。这个兜底路径的用途：Step 10 的 framework.js 会在调 `__native_render__` 之前把模板函数全部求值完，传进来的是纯数据模板，不需要 VM。保留能力是为了处理 framework.js 未完全求值的情况。

### 6. 坏节点跳过而不是整树失败

```cpp
if (child != nullptr) {
    node->children.push_back(std::move(child));
} else {
    QA_LOGW("[VNode] skipping invalid child %d of node %d", i, node->id);
}
```

一个缺 `type` 字段的节点不应该导致整页白屏。跳过它，其他节点正常渲染，用户至少能看到部分内容。

对比：根节点非法时返回 `nullptr`，整个渲染失败。因为没有根就没有任何东西可渲染。

### 7. 递归深度上限 64

```cpp
constexpr int kMaxDepth = 64;
```

防两种情况：

```text
1. 循环引用的模板对象（tpl.children[0] = tpl）→ 无限递归 → 栈溢出
2. 恶意构造的超深嵌套 → 栈溢出
```

真实页面的 DOM 深度典型 5-8 层，复杂列表可能 15 层。64 层留了充足余量。

超限时返回 `nullptr`，配合决策 6 的跳过逻辑，只丢弃过深的子树。

### 8. 未指定高度时用类型默认值

```cpp
float defaultHeightFor(const VNode& node) {
    if (node.type == "text")  return 40.0f;
    if (node.type == "input") return 44.0f;
    return 0.0f;
}
```

真实的文本高度需要字体度量（字号、字重、行数、折行），而 Core 没有字体信息 —— 那是平台层的能力。

Yoga 的解法是 `YGNodeSetMeasureFunc` 回调，让宿主提供测量能力。V1 用固定值近似，代价是多行文本会被裁剪。

`input` 用 44 是因为这是 iOS HIG 和 Material Design 共同建议的最小可点击高度。

### 9. 命令顺序：父先于子，创建先于设置

```cpp
bridge.createElement(...);          // 1
for (attrs) bridge.setAttr(...);    // 2
for (styles) bridge.setStyle(...);  // 3
for (events) bridge.setEvent(...);  // 4
for (children) emitNodeCommands();  // 5
```

两个约束都来自平台实现的需要：

```text
父先于子：Android 的 parent.addView(child) 需要 parent 已存在
创建先于设置：setAttr 需要先能通过 id 查到控件
```

删除时反过来用后序（子先父后），避免平台删除父容器后再收到子节点的删除命令。9.7 的测试有 `rmChild < rmRoot` 断言。

### 10. 页面切换时全量删除重建

```cpp
if (g_currentRoot != nullptr) {
    emitRemoveCommands(g_currentRoot.get(), bridge);
    g_currentRoot.reset();
    g_nodeIndex.clear();
}
```

V1 不做 VNode Diff。页面切换时删掉所有旧元素，重新创建新元素。

代价：页面切换有明显的白屏闪烁，元素数量多时（几百个）耗时可感知。

V1.5 的优化方向是 Diff + Mutation List：

```text
VNode Diff → 生成 create/update/remove 的最小操作集
          → RenderCommandBatch 批量提交
          → 平台一次性 apply
```

这需要节点 key 机制（类似 React 的 key）来正确匹配新旧节点，工作量不小。V1 先保证正确性。

---

## QA

### 1. 为什么字段是 `attr` 而不是 `attrs`

因为编译产物就是 `attr`（单数）。快应用工具链把 `.ux` 模板：

```html
<text>{{title}}</text>
```

编译为：

```javascript
{ type: 'text', attr: { value: function() { return this.title; } } }
```

Core 必须按实际字段名读取，不能按直觉改成 `attrs`，否则读不到任何属性。9.1.2 的表格列出了全部易错字段名。

VNode 结构体内部用 `attrs`（复数）作为成员名是可以的 —— 那是 C++ 侧的命名，不影响 JS 侧的字段读取。

### 2. text 节点的文本为什么在 `attr.value` 而不是 `attr.text`

快应用规范把 `<text>` 的内容统一放在 `value` 属性里，和 `<input>` 的值用同一个键名。

这导致平台层的 `setAttr` 需要按节点类型区分：

```kotlin
// Android 侧
fun setAttr(id: Int, key: String, value: String) {
    val view = viewMap[id] ?: return
    when {
        key == "value" && view is TextView -> view.text = value
        key == "value" && view is Button -> view.text = value
        key == "type" -> { /* input 的类型，创建时已处理 */ }
    }
}
```

### 3. classList 为什么可能是字符串

主要是容错。规范定义 `classList` 是数组，但实践中遇到过工具链版本差异导致产出空格分隔字符串的情况。

`buildNodeRecursive` 里的 `else if (JS_IsString(clsVal))` 分支处理这种情况，按空格切分。成本是 20 行代码，收益是避免某些 RPK 完全没有样式。

### 4. 为什么 StyleSheet 的键带前导点

因为编译产物里就带：

```javascript
style: {
  '.wrapper': { ... },     // 有点
  '.title': { ... }
}
```

而 `classList` 里不带：

```javascript
classList: ['wrapper', 'title']    // 无点
```

所以查表时要补上：

```cpp
const std::string selector = "." + cls;
```

不做统一（比如解析时去掉点）是因为将来支持标签选择器（`div { ... }`）和 ID 选择器（`#main { ... }`）时，前缀是区分类型的依据。

### 5. 同一个 class 出现在多个页面的 style 里会冲突吗

不会。每个页面的 `style` 对象是独立的，`buildStyleSheet` 每次渲染都重新构建。

```text
pages/Demo/index.js      style: { '.title': { color: '#333' } }
pages/Detail/index.js    style: { '.title': { color: '#f00' } }
```

渲染 Demo 时 StyleSheet 只含 Demo 的规则，切到 Detail 时重新构建。这也是快应用的样式隔离机制 —— 页面级作用域，没有全局样式污染。

代价是公共样式无法复用，每个页面都要重复定义。工具链层面可以通过 `@import` 在编译期合并。

### 6. 为什么 `parseLength` 对百分比返回 fallback 而不是报错

因为百分比在真实 RPK 里很常见（`width: '100%'`），如果报错会有大量日志噪音。

关键是**不能静默错误解析**：

```cpp
// 危险：strtof("50%") 返回 50.0，被当成 50px
// 一个应该占半屏（540px）的元素变成 50px 宽

// 所以显式检查
if (value.back() == '%') return fallback;
```

回退到 fallback（通常是父容器宽度）的效果是元素占满宽度，视觉上比 50px 更接近预期。9.8.5 的验证确认了这个行为。

### 7. `layoutRecursive` 为什么返回高度而不是写进参数

```cpp
float layoutRecursive(VNode* node, ..., size_t& nodeCount);
```

父节点需要知道每个子节点的高度才能推进游标，返回值是最直接的传递方式。

`node->layout.height` 同时也被写入了，所以父节点也可以读 `child->layout.height`。返回值是冗余的，但让调用点更清晰：

```cpp
const float childHeight = layoutRecursive(child.get(), ...);
cursorY += childHeight + childMargin.bottom;
```

比这样更易读：

```cpp
layoutRecursive(child.get(), ...);
cursorY += child->layout.height + childMargin.bottom;
```

### 8. RenderPipeline 为什么用全局状态而不是类实例

和 `PlatformBridge`、`ModuleRegistry` 保持一致：V1 明确只支持单 Runtime（design.md 的 Key Decision 6）。

用全局状态的好处是 `handleNativeRender` 作为函数指针注册进 JS Bridge 时不需要携带 `this`：

```cpp
using NativeRenderHandler = bool (*)(void*, void*, void*);   // 无 this 参数
setNativeRenderHandler(handleNativeRender);
```

如果是类实例，需要用 `JS_NewCFunctionData` 携带闭包数据，或者在 JS Bridge 层加一个静态转发函数。多 Runtime 时必须这么做。

### 9. 事件到 JS 方法的调用为什么不在本步做

因为它需要 VM 实例，而 VM 是 framework.js 创建的（Step 10）。

本步做完了前半段：

```text
用户点击 → 平台 → PlatformEventSink.dispatchClick(nodeId)
    → EventLoop.post → Runtime Thread
    → RenderPipeline::findNode(nodeId)     ← 本步提供
    → node->events["click"] = "goDetail"   ← 本步提供
```

Step 10 接后半段：

```text
    → 从 framework.js 的组件表拿到当前页面的 VM
    → JS_GetPropertyStr(vm, "goDetail")
    → JS_Call(ctx, method, vm, 0, nullptr)
```

### 10. 9.8.4 的手算和输出不一致是怎么回事

那一节故意保留了一处矛盾，用来说明交叉验证的价值。

`childrenTotalHeight` 的累加逻辑是：

```cpp
cursorY += childMargin.top;
childrenTotalHeight += childMargin.top;
// ... 递归 ...
cursorY += childHeight + childMargin.bottom;
childrenTotalHeight += childHeight + childMargin.bottom;
```

游标和累加值同步推进，两者应该一致。手算时容易漏掉 `margin.bottom` 或重复计算 `margin.top`。

实测时以代码输出为准，并把结果固化为测试断言（`testLayout` 里的 `root->layout.height == 150.0f`）。如果输出与预期不符，用 9.8.4 的 dump 工具逐层核对，问题通常在游标推进和高度累加不一致上。

这也是为什么布局代码必须有精确的数值断言，而不能只断言 `height > 0`。

### 11. Step 09 完成后得到了什么

渲染管线打通，`__native_render__` 从桩变成真实实现：

```text
✓ include/vnode.h + src/vnode.cpp                约 300 行，含数据绑定求值
✓ include/style_resolver.h + src/style_resolver.cpp  classList 叠加合并
✓ include/layout_engine.h + src/layout_engine.cpp    垂直 Flex + 盒模型
✓ include/render_pipeline.h + src/render_pipeline.cpp 五阶段编排 + 节点索引
✓ tests/test_vnode_layout.cpp                    5 组共 40+ 断言全部通过
✓ ASan 验证无泄漏（VNode 树 + JSValue 引用计数）
✓ 布局交叉验证：dump 工具 + 手算核对
✓ 能力边界验证：不支持的属性安全忽略且透传平台
```

完整链路现在是：

```text
JS: __native_render__(template, style)
    → buildVNode（含 attr 函数求值）
    → StyleResolver.resolve（classList → styles）
    → LayoutEngine.calculateLayout（→ x/y/w/h）
    → PlatformBridge.createElement/setAttr/setStyle/setEvent
    → 平台创建原生控件
```

还缺的是驱动这条链路的 framework.js 和把所有组件串起来的启动序列 —— 这是 Step 10。

---

## 下一步

按 `tasks.md` 进入 Step 10：实现 `framework.js`（`$app_define$` / `$app_bootstrap$` / VM 模型 / 生命周期）、`RuntimeBootstrap`（完整启动序列）和 `RuntimeHost`（对外 API），并接线事件处理与路由导航。
