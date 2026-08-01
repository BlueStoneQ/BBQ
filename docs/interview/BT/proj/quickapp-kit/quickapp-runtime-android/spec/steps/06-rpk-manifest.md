# Step 6：RPKLoader 与 ManifestParser

## 目录

- [目标](#目标)
- [Step 6.1：集成 minizip 到 CMake](#step-61集成-minizip-到-cmake)
- [Step 6.2：实现 RPKLoader](#step-62实现-rpkloader)
- [Step 6.3：实现 ManifestParser](#step-63实现-manifestparser)
- [Step 6.4：Android AssetManager 适配](#step-64android-assetmanager-适配)
- [Step 6.5：JNI 测试入口与验证](#step-65jni-测试入口与验证)
- [技术决策](#技术决策)
- [QA](#qa)

---

## 目标

**从 RPK 包中读取 manifest 和 JS bundle，为 Runtime 提供加载入口。**

| 层 | 职责 | 文件 |
|---|---|---|
| RPKLoader | ZIP 解压、文件读取 | `core/include/rpk_loader.h` / `core/src/rpk_loader.cpp` |
| ManifestParser | JSON → Manifest 模型 | `core/include/manifest_parser.h` / `core/src/manifest_parser.cpp` |
| AssetReader | Android AssetManager 读文件 | `platform/android/asset_reader.h/cpp` |

**验收标准：**
- 读取 `com.example.case1.debug.1.0.0.rpk` 成功
- 获得入口页面 `pages/Demo`
- `readText("app.js")` 返回非空 JS 字符串
- `readText("pages/Demo/index.js")` 返回非空 JS 字符串
- Manifest 解析出 features、display、router 配置

**本步不包含：**
- JS 执行
- 签名校验（META-INF/CERT）
- 图片资源加载

---

## Step 6.1：集成 minizip 到 CMake

RPK 是 ZIP 格式。Android NDK 自带 zlib，但没有 minizip 的高层 API。我们用 minizip-ng 或直接用 zlib 的 `unzip.h`。

### 6.1.1：方案选择

使用 Android NDK 自带的 zlib + 手写简单 ZIP 读取，或引入 minizip（~5 个文件）。推荐 minizip，因为 ZIP 目录遍历和文件读取逻辑不值得手写。

@add `app/src/main/cpp/third_party/minizip/`（放入以下文件）

```text
third_party/minizip/
├── unzip.c
├── unzip.h
├── ioapi.c
├── ioapi.h
└── ioapi_mem.c   ← 内存 IO 适配（从 byte[] 读取而非文件路径）
```

### 6.1.2：更新 CMakeLists.txt

@update `app/src/main/cpp/CMakeLists.txt` — 在 QuickJS 之后新增 minizip 静态库：

```cmake
# ============================================================
# minizip（ZIP 读取）
# ============================================================
set(MINIZIP_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/minizip)

add_library(minizip STATIC
    ${MINIZIP_DIR}/unzip.c
    ${MINIZIP_DIR}/ioapi.c
    ${MINIZIP_DIR}/ioapi_mem.c
)

target_include_directories(minizip PUBLIC ${MINIZIP_DIR})
target_link_libraries(minizip z)  # 链接 NDK 自带的 zlib
```

@update `app/src/main/cpp/CMakeLists.txt` — 主库源文件列表新增：

```cmake
    core/src/rpk_loader.cpp
    core/src/manifest_parser.cpp
    platform/android/asset_reader.cpp
```

@update `app/src/main/cpp/CMakeLists.txt` — target_link_libraries 新增：

```cmake
    minizip
    android   # AAssetManager 在 libandroid.so 中
```

---

## Step 6.2：实现 RPKLoader

@add `app/src/main/cpp/core/include/rpk_loader.h`（新建文件）

```cpp
#ifndef QUICKAPP_RPK_LOADER_H
#define QUICKAPP_RPK_LOADER_H

#include <string>
#include <vector>
#include <cstdint>

namespace quickapp {

/**
 * RPK 加载器。
 *
 * RPK 是 ZIP 格式的快应用包。RPKLoader 负责：
 * 1. 从内存 buffer 打开 ZIP
 * 2. 按路径读取条目内容
 * 3. 关闭时释放资源
 *
 * 不负责签名校验、图片解码或 JS 执行。
 */
class RPKLoader {
public:
    RPKLoader();
    ~RPKLoader();

    /**
     * 从内存中打开 RPK。
     * @param data RPK 文件的完整字节内容
     * @param size 字节长度
     * @return true 表示 ZIP 打开成功
     */
    bool open(const uint8_t* data, size_t size);

    /**
     * 读取 ZIP 内某个条目的文本内容。
     * @param entryPath ZIP 内路径，如 "manifest.json"、"pages/Demo/index.js"
     * @return 文件内容字符串，找不到返回空字符串
     */
    std::string readText(const char* entryPath);

    /**
     * 读取二进制内容（图片等）。
     */
    std::vector<uint8_t> readBinary(const char* entryPath);

    /** 是否已成功打开 */
    bool isOpen() const;

    /** 关闭并释放资源 */
    void close();

private:
    void* zipHandle_ = nullptr;       // minizip unzFile 句柄
    const uint8_t* data_ = nullptr;   // 原始数据指针（不拥有所有权）
    size_t dataSize_ = 0;
};

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/rpk_loader.cpp`（新建文件）

```cpp
#include "rpk_loader.h"
#include "unzip.h"
#include "ioapi_mem.h"
#include <android/log.h>
#include <cstring>

#define LOG_TAG "quickapp-rpk"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

RPKLoader::RPKLoader() = default;
RPKLoader::~RPKLoader() { close(); }

bool RPKLoader::open(const uint8_t* data, size_t size) {
    if (!data || size == 0) {
        LOGE("RPK data is null or empty");
        return false;
    }

    data_ = data;
    dataSize_ = size;

    // 用内存 IO 打开 ZIP（不需要写临时文件）
    zlib_filefunc_def memFuncs;
    fill_memory_filefunc(&memFuncs, const_cast<uint8_t*>(data), size);

    zipHandle_ = unzOpen2("mem://rpk", &memFuncs);
    if (!zipHandle_) {
        LOGE("Failed to open RPK as ZIP");
        return false;
    }

    LOGI("RPK opened, size=%zu bytes", size);
    return true;
}

std::string RPKLoader::readText(const char* entryPath) {
    if (!zipHandle_) return "";

    // 定位到指定条目
    if (unzLocateFile(zipHandle_, entryPath, 0) != UNZ_OK) {
        LOGE("Entry not found: %s", entryPath);
        return "";
    }

    // 获取条目信息（解压后大小）
    unz_file_info fileInfo;
    if (unzGetCurrentFileInfo(zipHandle_, &fileInfo, nullptr, 0,
                              nullptr, 0, nullptr, 0) != UNZ_OK) {
        return "";
    }

    // 打开条目
    if (unzOpenCurrentFile(zipHandle_) != UNZ_OK) {
        return "";
    }

    // 读取内容
    std::string content(fileInfo.uncompressed_size, '\0');
    int bytesRead = unzReadCurrentFile(zipHandle_, &content[0], fileInfo.uncompressed_size);
    unzCloseCurrentFile(zipHandle_);

    if (bytesRead < 0) {
        LOGE("Failed to read entry: %s", entryPath);
        return "";
    }

    LOGI("Read entry: %s (%u bytes)", entryPath, fileInfo.uncompressed_size);
    return content;
}

std::vector<uint8_t> RPKLoader::readBinary(const char* entryPath) {
    if (!zipHandle_) return {};

    if (unzLocateFile(zipHandle_, entryPath, 0) != UNZ_OK) return {};

    unz_file_info fileInfo;
    if (unzGetCurrentFileInfo(zipHandle_, &fileInfo, nullptr, 0,
                              nullptr, 0, nullptr, 0) != UNZ_OK) return {};

    if (unzOpenCurrentFile(zipHandle_) != UNZ_OK) return {};

    std::vector<uint8_t> data(fileInfo.uncompressed_size);
    unzReadCurrentFile(zipHandle_, data.data(), data.size());
    unzCloseCurrentFile(zipHandle_);

    return data;
}

bool RPKLoader::isOpen() const { return zipHandle_ != nullptr; }

void RPKLoader::close() {
    if (zipHandle_) {
        unzClose(zipHandle_);
        zipHandle_ = nullptr;
    }
    data_ = nullptr;
    dataSize_ = 0;
}

} // namespace quickapp
```

---

## Step 6.3：实现 ManifestParser

@add `app/src/main/cpp/core/include/manifest_parser.h`（新建文件）

```cpp
#ifndef QUICKAPP_MANIFEST_PARSER_H
#define QUICKAPP_MANIFEST_PARSER_H

#include <string>
#include <vector>
#include <unordered_map>

namespace quickapp {

/** 页面显示配置 */
struct PageDisplay {
    std::string titleBarText;
};

/** Manifest 数据模型 */
struct Manifest {
    std::string package;          // "com.example.case1"
    std::string name;             // "case1"
    std::string versionName;      // "1.0.0"
    int versionCode = 0;

    // 路由
    std::string entry;            // "pages/Demo"
    std::unordered_map<std::string, std::string> pages; // path → component

    // 显示
    std::string titleBarBgColor;      // "#f2f2f2"
    std::string titleBarTextColor;    // "#414141"
    std::unordered_map<std::string, PageDisplay> pageDisplays;

    // 能力声明
    std::vector<std::string> features; // ["system.prompt", "system.router", ...]

    // 配置
    bool debug = false;
    std::string logLevel;
};

/**
 * 解析 manifest.json 字符串为 Manifest 结构体。
 * @param json manifest.json 的完整文本内容
 * @param out 输出结果
 * @return 解析是否成功
 */
bool parseManifest(const std::string& json, Manifest& out);

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/core/src/manifest_parser.cpp`（新建文件）

使用轻量 JSON 解析。推荐 cJSON（单文件 C 库，~2000 行）或手写 find/substr 提取字段。这里用 cJSON：

@add `app/src/main/cpp/third_party/cjson/cJSON.c`
@add `app/src/main/cpp/third_party/cjson/cJSON.h`

```cpp
#include "manifest_parser.h"

extern "C" {
#include "cJSON.h"
}

#include <android/log.h>

#define LOG_TAG "quickapp-manifest"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

// 辅助：安全读取 JSON 字符串字段
static std::string getString(cJSON* obj, const char* key) {
    cJSON* item = cJSON_GetObjectItem(obj, key);
    return (item && cJSON_IsString(item)) ? item->valuestring : "";
}

static int getInt(cJSON* obj, const char* key) {
    cJSON* item = cJSON_GetObjectItem(obj, key);
    return (item && cJSON_IsNumber(item)) ? item->valueint : 0;
}

static bool getBool(cJSON* obj, const char* key) {
    cJSON* item = cJSON_GetObjectItem(obj, key);
    return item && cJSON_IsTrue(item);
}

bool parseManifest(const std::string& json, Manifest& out) {
    cJSON* root = cJSON_Parse(json.c_str());
    if (!root) {
        LOGE("Failed to parse manifest.json");
        return false;
    }

    // 基本信息
    out.package = getString(root, "package");
    out.name = getString(root, "name");
    out.versionName = getString(root, "versionName");
    out.versionCode = getInt(root, "versionCode");

    // 路由
    cJSON* router = cJSON_GetObjectItem(root, "router");
    if (router) {
        out.entry = getString(router, "entry");

        cJSON* pages = cJSON_GetObjectItem(router, "pages");
        if (pages) {
            cJSON* page = pages->child;
            while (page) {
                out.pages[page->string] = getString(page, "component");
                page = page->next;
            }
        }
    }

    // 显示
    cJSON* display = cJSON_GetObjectItem(root, "display");
    if (display) {
        out.titleBarBgColor = getString(display, "titleBarBackgroundColor");
        out.titleBarTextColor = getString(display, "titleBarTextColor");

        cJSON* dpages = cJSON_GetObjectItem(display, "pages");
        if (dpages) {
            cJSON* dp = dpages->child;
            while (dp) {
                PageDisplay pd;
                pd.titleBarText = getString(dp, "titleBarText");
                out.pageDisplays[dp->string] = pd;
                dp = dp->next;
            }
        }
    }

    // Features
    cJSON* features = cJSON_GetObjectItem(root, "features");
    if (features && cJSON_IsArray(features)) {
        int size = cJSON_GetArraySize(features);
        for (int i = 0; i < size; i++) {
            cJSON* item = cJSON_GetArrayItem(features, i);
            std::string name = getString(item, "name");
            if (!name.empty()) out.features.push_back(name);
        }
    }

    // Config
    cJSON* config = cJSON_GetObjectItem(root, "config");
    if (config) {
        out.debug = getBool(config, "debug");
        out.logLevel = getString(config, "logLevel");
    }

    cJSON_Delete(root);

    LOGI("Manifest parsed: package=%s, entry=%s, features=%zu",
         out.package.c_str(), out.entry.c_str(), out.features.size());
    return true;
}

} // namespace quickapp
```

---

## Step 6.4：Android AssetManager 适配

RPK 文件放在 `app/src/main/assets/` 目录下。Android 通过 AAssetManager 读取。

@add `app/src/main/cpp/platform/android/asset_reader.h`（新建文件）

```cpp
#ifndef QUICKAPP_ASSET_READER_H
#define QUICKAPP_ASSET_READER_H

#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
#include <vector>
#include <cstdint>

namespace quickapp {

/**
 * 从 Android Assets 读取文件到内存。
 * @param mgr AAssetManager 指针（从 JNI 获取）
 * @param path assets 内的文件路径
 * @param outData 输出：文件完整内容
 * @return true 表示读取成功
 */
bool readAsset(AAssetManager* mgr, const char* path, std::vector<uint8_t>& outData);

} // namespace quickapp

#endif
```

@add `app/src/main/cpp/platform/android/asset_reader.cpp`（新建文件）

```cpp
#include "asset_reader.h"
#include <android/log.h>

#define LOG_TAG "quickapp-asset"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace quickapp {

bool readAsset(AAssetManager* mgr, const char* path, std::vector<uint8_t>& outData) {
    if (!mgr || !path) return false;

    AAsset* asset = AAssetManager_open(mgr, path, AASSET_MODE_BUFFER);
    if (!asset) {
        LOGE("Asset not found: %s", path);
        return false;
    }

    off_t size = AAsset_getLength(asset);
    outData.resize(size);
    int bytesRead = AAsset_read(asset, outData.data(), size);
    AAsset_close(asset);

    if (bytesRead != size) {
        LOGE("Asset read incomplete: %s (expected %ld, got %d)", path, (long)size, bytesRead);
        return false;
    }

    LOGI("Asset loaded: %s (%ld bytes)", path, (long)size);
    return true;
}

} // namespace quickapp
```

**使用方式（JNI 层获取 AAssetManager）：**

```cpp
// 在 nativeInitialize 或专用初始化函数中
AAssetManager* mgr = AAssetManager_fromJava(env, jAssetManager);

std::vector<uint8_t> rpkData;
readAsset(mgr, "com.example.case1.debug.1.0.0.rpk", rpkData);

RPKLoader loader;
loader.open(rpkData.data(), rpkData.size());
```

---

## Step 6.5：JNI 测试入口与验证

@update `jni_bridge.cpp` — 在 `extern "C"` 块中新增：

```cpp
#include "rpk_loader.h"
#include "manifest_parser.h"
#include "asset_reader.h"

JNIEXPORT void JNICALL
Java_com_quickappkit_runtime_QuickAppRuntime_nativeTestRPK(
        JNIEnv* env, jobject thiz, jobject assetManager) {
    // 1. 获取 AAssetManager
    AAssetManager* mgr = AAssetManager_fromJava(env, assetManager);

    // 2. 读取 RPK 文件到内存
    std::vector<uint8_t> rpkData;
    if (!quickapp::readAsset(mgr, "com.example.case1.debug.1.0.0.rpk", rpkData)) {
        LOGE("Failed to load RPK from assets");
        return;
    }

    // 3. 打开 ZIP
    quickapp::RPKLoader loader;
    if (!loader.open(rpkData.data(), rpkData.size())) {
        LOGE("Failed to open RPK");
        return;
    }

    // 4. 读取并解析 manifest
    std::string manifestJson = loader.readText("manifest.json");
    quickapp::Manifest manifest;
    if (!quickapp::parseManifest(manifestJson, manifest)) {
        LOGE("Failed to parse manifest");
        return;
    }

    LOGI("RPK Test: package=%s, entry=%s", manifest.package.c_str(), manifest.entry.c_str());

    // 5. 读取 app.js
    std::string appJs = loader.readText("app.js");
    LOGI("RPK Test: app.js length=%zu", appJs.size());

    // 6. 读取入口页面 bundle
    std::string pagePath = manifest.entry + "/index.js";
    std::string pageJs = loader.readText(pagePath.c_str());
    LOGI("RPK Test: %s length=%zu", pagePath.c_str(), pageJs.size());

    loader.close();
    LOGI("RPK Test completed");
}
```

@update `QuickAppRuntime.kt` — 新增：

```kotlin
    private external fun nativeTestRPK(assetManager: android.content.res.AssetManager)
    fun testRPK() { nativeTestRPK(context.assets) }
```

### Logcat 验证

```bash
adb logcat | grep "quickapp-"
```

预期：

```text
I/quickapp-asset: Asset loaded: com.example.case1.debug.1.0.0.rpk (42xxx bytes)
I/quickapp-rpk: RPK opened, size=42xxx bytes
I/quickapp-rpk: Read entry: manifest.json (1500 bytes)
I/quickapp-manifest: Manifest parsed: package=com.example.case1, entry=pages/Demo, features=4
I/quickapp-rpk: Read entry: app.js (36xxx bytes)
I/quickapp-rpk: Read entry: pages/Demo/index.js (29xxx bytes)
I/quickapp-core: RPK Test completed
```

---

## 技术决策

### 1. 内存 IO 读取 ZIP

RPK 很小（几十 KB），全部读入内存再解压。不需要写临时文件到磁盘，也避免了文件权限问题。

### 2. cJSON 做 JSON 解析

单文件 C 库，无外部依赖，编译简单。Manifest 结构固定，不需要 rapidjson 这种重量级库。

### 3. 跳过签名校验

V1 跳过 `META-INF/CERT`。后续加签名校验时，在 `open()` 之后、`readText()` 之前插入校验逻辑即可。

### 4. AssetManager 适配放在 platform/android/

这是 Android 专有的文件读取方式。iOS 用 NSBundle，LVGL 用文件系统或 Flash 读取。Core 的 RPKLoader 只接收 `uint8_t*`，不关心数据从哪来。

---

## QA

### 1. 为什么不用 Java 层的 ZipInputStream？

要跨平台。Core 用 C 层 ZIP 解压，iOS 和 LVGL 也能复用同一套 RPKLoader。

### 2. RPK 放在 assets 合适吗？

开发阶段放 assets 最方便（打包进 APK，不需要额外权限）。后续生产环境可以从网络下载到 App 私有目录，改 readAsset 为 read file 即可，RPKLoader 不用改。

### 3. cJSON 的内存管理？

`cJSON_Parse` 分配内存，`cJSON_Delete` 释放。确保每个 Parse 都有对应的 Delete。

---

## 下一步

Step 6 完成后得到：能从 APK assets 中读取 RPK 并解析 Manifest。下一步 Step 7 实现 framework.js，在 QuickJS 中执行并建立 VM 模型。
