# Step 9：VNode 构建与样式解析

## 目录

- [目标](#目标)
- [Step 9.1：定义 VNode 数据结构](#step-91定义-vnode-数据结构)
- [Step 9.2：实现 JS template → C++ VNode 转换](#step-92实现-js-template--c-vnode-转换)
- [Step 9.3：实现 StyleResolver](#step-93实现-styleresolver)
- [Step 9.4：验证](#step-94验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**在 C++ 中将 JS 传来的 template 对象构建为 VNode 树，并完成样式匹配合并。**

| 层 | 职责 | 文件 |
|---|---|---|
| VNode | C++ 虚拟节点数据结构 | `core/include/vnode.h` / `core/src/vnode.cpp` |
| StyleResolver | classList → 样式合并 | `core/include/style_resolver.h` / `core/src/style_resolver.cpp` |
| native_render 升级 | 完整解析 template → VNode 树 | `core/src/js_bridge.cpp` 更新 |

**验收标准：**
- native_render 收到 template 后构建完整 VNode 树
- root: div, children: [text, input]
- text.attrs["value"] = "欢迎体验快应用开发"
- input.attrs["type"] = "button", input.events["click"] = "onDetailBtnClick"
- 样式正确匹配：text 得到 fontSize=40px, input 得到 backgroundColor=#09ba07

---

## Step 9.1：定义 VNode 数据结构

@add `app/src/main/cpp/core/include/vnode.h`（新建文件）

```cpp
#ifndef QUICKAPP_VNODE_H
#define QUICKAPP_VNODE_H

#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <atomic>

namespace quickapp {

/**
 * VNode —— 虚拟节点。
 *
 * 一个 VNode 对应一个 UI 元素。整棵 VNode 树描述了页面结构。
 * 由 JS template 转换而来，经过 StyleResolver 和 Yoga 后，
 * 生成 PlatformBridge 渲染指令。
 */
struct VNode {
    int id;                                              // 唯一节点 ID
    std::string type;                                    // "div" / "text" / "input"
    std::unordered_map<std::string, std::string> attrs;  // 属性：text、placeholder、type 等
    std::unordered_map<std::string, std::string> styles; // 合并后的样式
    std::unordered_map<std::string, std::string> events; // 事件：click → methodName
    std::vector<std::string> classList;                   // 样式类名列表
    std::vector<std::unique_ptr<VNode>> children;        // 子节点

    // 布局结果（Step 10 Yoga 填充）
    float x = 0, y = 0, width = 0, height = 0;
};

/** 全局节点 ID 生成器 */
int generateNodeId();

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/vnode.cpp`（新建文件）

```cpp
#include "vnode.h"
#include <atomic>

namespace quickapp {

static std::atomic<int> g_nextNodeId{1};

int generateNodeId() {
    return g_nextNodeId.fetch_add(1);
}

} // namespace quickapp
```

---

## Step 9.2：实现 JS template → C++ VNode 转换

在 `native_render` 中将 JSValue 递归转换为 C++ VNode 树。

@update `app/src/main/cpp/core/src/js_bridge.cpp` — 替换 `native_render` 函数为完整实现：

```cpp
#include "vnode.h"
#include "style_resolver.h"

// 递归构建 VNode 树
static std::unique_ptr<quickapp::VNode> buildVNode(JSContext* ctx, JSValue jsNode) {
    auto vnode = std::make_unique<quickapp::VNode>();
    vnode->id = quickapp::generateNodeId();

    // type
    JSValue typeVal = JS_GetPropertyStr(ctx, jsNode, "type");
    const char* type = JS_ToCString(ctx, typeVal);
    vnode->type = type ? type : "";
    if (type) JS_FreeCString(ctx, type);
    JS_FreeValue(ctx, typeVal);

    // attr
    JSValue attrVal = JS_GetPropertyStr(ctx, jsNode, "attr");
    if (JS_IsObject(attrVal)) {
        // 遍历 attr 对象的所有属性
        JSPropertyEnum* props = nullptr;
        uint32_t propCount = 0;
        JS_GetOwnPropertyNames(ctx, &props, &propCount, attrVal, JS_GPN_STRING_MASK);
        for (uint32_t i = 0; i < propCount; i++) {
            const char* key = JS_AtomToCString(ctx, props[i].atom);
            JSValue val = JS_GetProperty(ctx, attrVal, props[i].atom);
            const char* valStr = JS_ToCString(ctx, val);
            if (key && valStr) {
                vnode->attrs[key] = valStr;
            }
            if (key) JS_FreeCString(ctx, key);
            if (valStr) JS_FreeCString(ctx, valStr);
            JS_FreeValue(ctx, val);
        }
        js_free(ctx, props);
    }
    JS_FreeValue(ctx, attrVal);

    // classList
    JSValue classListVal = JS_GetPropertyStr(ctx, jsNode, "classList");
    if (JS_IsArray(ctx, classListVal)) {
        int len = 0;
        JSValue lenVal = JS_GetPropertyStr(ctx, classListVal, "length");
        JS_ToInt32(ctx, &len, lenVal);
        JS_FreeValue(ctx, lenVal);
        for (int i = 0; i < len; i++) {
            JSValue item = JS_GetPropertyUint32(ctx, classListVal, i);
            const char* cls = JS_ToCString(ctx, item);
            if (cls) { vnode->classList.emplace_back(cls); JS_FreeCString(ctx, cls); }
            JS_FreeValue(ctx, item);
        }
    }
    JS_FreeValue(ctx, classListVal);

    // events
    JSValue eventsVal = JS_GetPropertyStr(ctx, jsNode, "events");
    if (JS_IsObject(eventsVal)) {
        JSPropertyEnum* props = nullptr;
        uint32_t propCount = 0;
        JS_GetOwnPropertyNames(ctx, &props, &propCount, eventsVal, JS_GPN_STRING_MASK);
        for (uint32_t i = 0; i < propCount; i++) {
            const char* key = JS_AtomToCString(ctx, props[i].atom);
            JSValue val = JS_GetProperty(ctx, eventsVal, props[i].atom);
            const char* valStr = JS_ToCString(ctx, val);
            if (key && valStr) vnode->events[key] = valStr;
            if (key) JS_FreeCString(ctx, key);
            if (valStr) JS_FreeCString(ctx, valStr);
            JS_FreeValue(ctx, val);
        }
        js_free(ctx, props);
    }
    JS_FreeValue(ctx, eventsVal);

    // children（递归）
    JSValue childrenVal = JS_GetPropertyStr(ctx, jsNode, "children");
    if (JS_IsArray(ctx, childrenVal)) {
        int len = 0;
        JSValue lenVal = JS_GetPropertyStr(ctx, childrenVal, "length");
        JS_ToInt32(ctx, &len, lenVal);
        JS_FreeValue(ctx, lenVal);
        for (int i = 0; i < len; i++) {
            JSValue child = JS_GetPropertyUint32(ctx, childrenVal, i);
            vnode->children.push_back(buildVNode(ctx, child));
            JS_FreeValue(ctx, child);
        }
    }
    JS_FreeValue(ctx, childrenVal);

    return vnode;
}
```

---

## Step 9.3：实现 StyleResolver

@add `app/src/main/cpp/core/include/style_resolver.h`（新建文件）

```cpp
#ifndef QUICKAPP_STYLE_RESOLVER_H
#define QUICKAPP_STYLE_RESOLVER_H

#include "vnode.h"
#include <string>
#include <unordered_map>

namespace quickapp {

// 样式表类型：选择器 → 属性 map
// 例如 ".wrapper .title" → { "fontSize": "40px", "color": "#000000" }
using StyleSheet = std::unordered_map<std::string, std::unordered_map<std::string, std::string>>;

/**
 * 将样式表应用到 VNode 树。
 * 遍历每个节点的 classList，匹配 StyleSheet 中的选择器，合并到 node.styles。
 */
void resolveStyles(VNode* root, const StyleSheet& styleSheet);

/**
 * 从 JS style 对象解析为 C++ StyleSheet。
 */
StyleSheet parseStyleSheet(JSContext* ctx, JSValue jsStyleObj);

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/style_resolver.cpp`（新建文件）

```cpp
#include "style_resolver.h"
#include <android/log.h>

extern "C" { #include "quickjs.h" }

#define LOG_TAG "quickapp-style"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

void resolveStyles(VNode* root, const StyleSheet& styleSheet) {
    if (!root) return;

    // 对每个 class 名，查找匹配的样式规则
    for (const auto& cls : root->classList) {
        // 简化匹配：直接查 ".className"
        std::string selector = "." + cls;
        auto it = styleSheet.find(selector);
        if (it != styleSheet.end()) {
            for (const auto& [key, value] : it->second) {
                if (key[0] != '_') { // 跳过 _meta 等内部字段
                    root->styles[key] = value;
                }
            }
        }

        // 查找带祖先选择器的规则（简化：遍历所有 selector 检查是否以 .cls 结尾）
        for (const auto& [sel, props] : styleSheet) {
            if (sel.size() > selector.size() &&
                sel.substr(sel.size() - selector.size()) == selector) {
                for (const auto& [key, value] : props) {
                    if (key[0] != '_') root->styles[key] = value;
                }
            }
        }
    }

    // 递归 children
    for (auto& child : root->children) {
        resolveStyles(child.get(), styleSheet);
    }
}

StyleSheet parseStyleSheet(JSContext* ctx, JSValue jsStyleObj) {
    StyleSheet sheet;
    if (!JS_IsObject(jsStyleObj)) return sheet;

    // 遍历选择器
    JSPropertyEnum* selectors = nullptr;
    uint32_t selCount = 0;
    JS_GetOwnPropertyNames(ctx, &selectors, &selCount, jsStyleObj, JS_GPN_STRING_MASK);

    for (uint32_t i = 0; i < selCount; i++) {
        const char* selector = JS_AtomToCString(ctx, selectors[i].atom);
        JSValue propsObj = JS_GetProperty(ctx, jsStyleObj, selectors[i].atom);

        if (selector && JS_IsObject(propsObj)) {
            std::unordered_map<std::string, std::string> props;

            JSPropertyEnum* keys = nullptr;
            uint32_t keyCount = 0;
            JS_GetOwnPropertyNames(ctx, &keys, &keyCount, propsObj, JS_GPN_STRING_MASK);
            for (uint32_t j = 0; j < keyCount; j++) {
                const char* key = JS_AtomToCString(ctx, keys[j].atom);
                JSValue val = JS_GetProperty(ctx, propsObj, keys[j].atom);
                const char* valStr = JS_ToCString(ctx, val);
                if (key && valStr) props[key] = valStr;
                if (key) JS_FreeCString(ctx, key);
                if (valStr) JS_FreeCString(ctx, valStr);
                JS_FreeValue(ctx, val);
            }
            js_free(ctx, keys);

            sheet[selector] = std::move(props);
        }

        if (selector) JS_FreeCString(ctx, selector);
        JS_FreeValue(ctx, propsObj);
    }
    js_free(ctx, selectors);

    LOGI("StyleSheet parsed: %zu rules", sheet.size());
    return sheet;
}

} // namespace quickapp
```

---

## Step 9.4：验证

在 native_render 中完整使用：

```cpp
static JSValue native_render(JSContext* ctx, JSValueConst this_val,
                              int argc, JSValueConst* argv) {
    if (argc < 2) return JS_UNDEFINED;

    // 1. 构建 VNode 树
    auto root = buildVNode(ctx, argv[0]);

    // 2. 解析样式表
    auto styleSheet = quickapp::parseStyleSheet(ctx, argv[1]);

    // 3. 应用样式到 VNode
    quickapp::resolveStyles(root.get(), styleSheet);

    // 4. 打印验证
    LOGI("VNode tree: root=%s, children=%zu", root->type.c_str(), root->children.size());
    for (auto& child : root->children) {
        LOGI("  child: type=%s, attrs=%zu, styles=%zu, events=%zu",
             child->type.c_str(), child->attrs.size(),
             child->styles.size(), child->events.size());
    }

    // Step 10 之后接 Yoga 布局，然后发送 PlatformBridge 指令
    return JS_UNDEFINED;
}
```

**Logcat 预期：**

```text
I/quickapp-bridge: __native_render__ called
I/quickapp-style: StyleSheet parsed: 3 rules
I/quickapp-bridge: VNode tree: root=div, children=2
I/quickapp-bridge:   child: type=text, attrs=1, styles=3, events=0
I/quickapp-bridge:   child: type=input, attrs=2, styles=5, events=1
```

---

## 技术决策

### 1. VNode 用 unique_ptr 管理子节点

树结构用 `vector<unique_ptr<VNode>>` 表达父子关系，自动内存管理，不需要手动 delete。

### 2. StyleResolver 简化匹配

V1 用简单的 className 匹配。不实现 CSS 选择器优先级、伪类、继承。够用就行。

### 3. 全局节点 ID 自增

保证每个 VNode 有唯一 ID，后续 PlatformBridge 和事件回调通过 ID 找节点。

---

## QA

### 1. JS_GetOwnPropertyNames 为什么要手动 free？

QuickJS 分配了 `JSPropertyEnum*` 数组的内存。必须用 `js_free(ctx, props)` 释放。不是 `JS_FreeValue`——它不是 JSValue。

### 2. 选择器匹配为什么用字符串 endsWith？

快应用的样式选择器是 `.wrapper .title` 这种简单后代选择器。V1 简化为"如果 selector 以 `.className` 结尾就匹配"。不精确，但对 Demo 页面够用。

---

## 下一步

Step 9 完成后得到：C++ 中有完整的 VNode 树 + 样式数据。下一步 Step 10 接入 Yoga 计算 Flexbox 布局。
