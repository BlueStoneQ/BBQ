# Step 10：YogaLayout 布局计算

## 目录

- [目标](#目标)
- [Step 10.1：集成 Yoga 到 CMake](#step-101集成-yoga-到-cmake)
- [Step 10.2：实现 VNode → YGNode 映射](#step-102实现-vnode--ygnode-映射)
- [Step 10.3：布局计算与结果回填](#step-103布局计算与结果回填)
- [Step 10.4：验证](#step-104验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**用 Yoga 计算 VNode 树的 Flexbox 布局，为每个节点输出 x/y/width/height。**

| 层 | 职责 | 文件 |
|---|---|---|
| Yoga 集成 | CMake 编译 Yoga 源码 | `third_party/yoga/` + CMakeLists 更新 |
| YogaLayout | VNode ↔ YGNode 映射 + 计算 | `core/include/yoga_layout.h` / `core/src/yoga_layout.cpp` |

**验收标准：**
- Yoga 编译通过
- Demo 页面 root 节点 width = 屏幕宽度
- text 和 button 节点有合理的 y 偏移（垂直居中）
- 样式 flexDirection: column, justifyContent: center 生效

**本步不包含：**
- 完整 CSS 属性支持（只做 flex 基础属性）
- 百分比单位
- 文本测量（Yoga 的 MeasureFunc）

---

## Step 10.1：集成 Yoga 到 CMake

@add `app/src/main/cpp/third_party/yoga/`（从 https://github.com/nicklockwood/yoga-kit 或 Facebook 官方 Yoga 下载源码）

@update `CMakeLists.txt` — 新增 Yoga 编译：

```cmake
# ============================================================
# Yoga（Flexbox 布局引擎）
# ============================================================
set(YOGA_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/yoga)

file(GLOB YOGA_SOURCES ${YOGA_DIR}/yoga/*.cpp)

add_library(yogacore STATIC ${YOGA_SOURCES})
target_include_directories(yogacore PUBLIC ${YOGA_DIR})
target_compile_options(yogacore PRIVATE -fno-exceptions -fno-rtti)
```

@update `CMakeLists.txt` — 主库源文件新增：

```cmake
    core/src/yoga_layout.cpp
```

@update `CMakeLists.txt` — target_link_libraries 新增：

```cmake
    yogacore
```

---

## Step 10.2：实现 VNode → YGNode 映射

@add `app/src/main/cpp/core/include/yoga_layout.h`（新建文件）

```cpp
#ifndef QUICKAPP_YOGA_LAYOUT_H
#define QUICKAPP_YOGA_LAYOUT_H

#include "vnode.h"

namespace quickapp {

/**
 * 对 VNode 树执行 Yoga Flexbox 布局计算。
 * 计算结果写入每个 VNode 的 x/y/width/height 字段。
 *
 * @param root VNode 树根节点
 * @param containerWidth 容器宽度（通常是屏幕宽度，像素）
 * @param containerHeight 容器高度（通常是屏幕高度，像素）
 */
void calculateLayout(VNode* root, float containerWidth, float containerHeight);

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/yoga_layout.cpp`（新建文件）

```cpp
#include "yoga_layout.h"
#include <yoga/Yoga.h>
#include <android/log.h>
#include <cstdlib>
#include <string>

#define LOG_TAG "quickapp-yoga"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// 辅助：将样式字符串中的 "40px" → 40.0f
static float parsePx(const std::string& value) {
    if (value.empty()) return YGUndefined;
    // 去掉 "px" 后缀
    std::string num = value;
    size_t pos = num.find("px");
    if (pos != std::string::npos) num = num.substr(0, pos);
    return std::strtof(num.c_str(), nullptr);
}

// 递归构建 YGNode 树
static YGNodeRef buildYogaTree(VNode* vnode) {
    YGNodeRef node = YGNodeNew();

    // 从 vnode.styles 中读取布局相关属性
    auto& s = vnode->styles;

    // flexDirection
    if (s.count("flexDirection")) {
        if (s["flexDirection"] == "row") YGNodeStyleSetFlexDirection(node, YGFlexDirectionRow);
        else if (s["flexDirection"] == "column") YGNodeStyleSetFlexDirection(node, YGFlexDirectionColumn);
    }

    // justifyContent
    if (s.count("justifyContent")) {
        if (s["justifyContent"] == "center") YGNodeStyleSetJustifyContent(node, YGJustifyCenter);
        else if (s["justifyContent"] == "flex-start") YGNodeStyleSetJustifyContent(node, YGJustifyFlexStart);
        else if (s["justifyContent"] == "flex-end") YGNodeStyleSetJustifyContent(node, YGJustifyFlexEnd);
        else if (s["justifyContent"] == "space-between") YGNodeStyleSetJustifyContent(node, YGJustifySpaceBetween);
    }

    // alignItems
    if (s.count("alignItems")) {
        if (s["alignItems"] == "center") YGNodeStyleSetAlignItems(node, YGAlignCenter);
        else if (s["alignItems"] == "flex-start") YGNodeStyleSetAlignItems(node, YGAlignFlexStart);
        else if (s["alignItems"] == "stretch") YGNodeStyleSetAlignItems(node, YGAlignStretch);
    }

    // width / height
    if (s.count("width")) YGNodeStyleSetWidth(node, parsePx(s["width"]));
    if (s.count("height")) YGNodeStyleSetHeight(node, parsePx(s["height"]));

    // margin
    if (s.count("marginTop")) YGNodeStyleSetMargin(node, YGEdgeTop, parsePx(s["marginTop"]));
    if (s.count("marginBottom")) YGNodeStyleSetMargin(node, YGEdgeBottom, parsePx(s["marginBottom"]));
    if (s.count("marginLeft")) YGNodeStyleSetMargin(node, YGEdgeLeft, parsePx(s["marginLeft"]));
    if (s.count("marginRight")) YGNodeStyleSetMargin(node, YGEdgeRight, parsePx(s["marginRight"]));

    // padding
    if (s.count("padding")) {
        float p = parsePx(s["padding"]);
        YGNodeStyleSetPadding(node, YGEdgeAll, p);
    }

    // 递归子节点
    for (size_t i = 0; i < vnode->children.size(); i++) {
        YGNodeRef childYG = buildYogaTree(vnode->children[i].get());
        YGNodeInsertChild(node, childYG, i);
    }

    return node;
}

// 递归读取布局结果，回填到 VNode
static void readLayoutResults(YGNodeRef ygNode, VNode* vnode) {
    vnode->x = YGNodeLayoutGetLeft(ygNode);
    vnode->y = YGNodeLayoutGetTop(ygNode);
    vnode->width = YGNodeLayoutGetWidth(ygNode);
    vnode->height = YGNodeLayoutGetHeight(ygNode);

    for (size_t i = 0; i < vnode->children.size(); i++) {
        YGNodeRef childYG = YGNodeGetChild(ygNode, i);
        readLayoutResults(childYG, vnode->children[i].get());
    }
}

// 递归释放 YGNode 树
static void freeYogaTree(YGNodeRef node) {
    uint32_t count = YGNodeGetChildCount(node);
    for (uint32_t i = 0; i < count; i++) {
        freeYogaTree(YGNodeGetChild(node, i));
    }
    YGNodeFree(node);
}

void calculateLayout(VNode* root, float containerWidth, float containerHeight) {
    if (!root) return;

    // 1. 构建 Yoga 节点树
    YGNodeRef ygRoot = buildYogaTree(root);

    // 2. 计算布局
    YGNodeCalculateLayout(ygRoot, containerWidth, containerHeight, YGDirectionLTR);

    // 3. 读取结果回填 VNode
    readLayoutResults(ygRoot, root);

    // 4. 释放 Yoga 树
    freeYogaTree(ygRoot);

    LOGI("Layout calculated: root=%.0fx%.0f", root->width, root->height);
}

} // namespace quickapp
```

---

## Step 10.3：布局计算与结果回填

在 `native_render` 中，VNode 构建 + 样式匹配之后调用 Yoga：

@update `core/src/js_bridge.cpp` 中的 `native_render` — 在 resolveStyles 之后插入：

```cpp
    // 4. Yoga 布局计算
    // containerWidth/Height 由平台层提供（屏幕尺寸）
    // Step 10 暂时硬编码，Step 12 从 PlatformBridge 获取
    quickapp::calculateLayout(root.get(), 1080.0f, 1920.0f);

    LOGI("Layout: root=(%0.f,%0.f,%0.f,%0.f)", root->x, root->y, root->width, root->height);
    for (auto& child : root->children) {
        LOGI("  child %s: (%0.f,%0.f,%0.f,%0.f)",
             child->type.c_str(), child->x, child->y, child->width, child->height);
    }
```

---

## Step 10.4：验证

**Logcat 预期：**

```text
I/quickapp-yoga: Layout calculated: root=1080x1920
I/quickapp-bridge: Layout: root=(0,0,1080,1920)
I/quickapp-bridge:   child text: (x,y,450,40)    // 居中后的位置
I/quickapp-bridge:   child input: (x,y,450,80)   // button 尺寸
```

---

## 技术决策

1. **Yoga 源码静态编译** — 和 QuickJS 同样策略，直接编译源码
2. **px 单位直传** — V1 不做 dp 转换，RPK 中的 px 直接对应 Android px
3. **不实现文本测量** — text 节点必须显式声明 width/height，不自动撑开

---

## QA

### 1. Yoga 的 API 是 C 还是 C++？
Yoga 核心是 C++ 但暴露了 C API（YGNodeNew 等）。我们用 C API，更简单。

### 2. YGUndefined 是什么？
表示"未设置"。Yoga 会根据 flex 规则自动计算未设置的维度。

---

## 下一步

Step 10 后每个 VNode 有了布局数据。Step 11 将这些数据通过 PlatformBridge 发送给 Android ViewRenderer。
