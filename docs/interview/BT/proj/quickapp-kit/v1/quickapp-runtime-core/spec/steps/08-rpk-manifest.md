# Step 8：RPKLoader 与 ManifestParser

## 目录

- [目标](#目标)
- [Step 8.1：理解 RPK 包结构](#step-81理解-rpk-包结构)
- [Step 8.2：理解 ZIP 格式](#step-82理解-zip-格式)
- [Step 8.3：实现 RPKLoader](#step-83实现-rpkloader)
- [Step 8.4：实现 ManifestParser](#step-84实现-manifestparser)
- [Step 8.5：接入 CMake](#step-85接入-cmake)
- [Step 8.6：编写测试](#step-86编写测试)
- [Step 8.7：逐层验证](#step-87逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**让 Core 能从内存字节数组加载 RPK 并解析出应用配置。**

| 层 | 职责 | 文件 |
|---|---|---|
| ZIP 读取 | 解析 Central Directory，按路径解压单个文件 | `include/rpk_loader.h` + `src/rpk_loader.cpp` |
| Manifest 解析 | JSON → 结构化配置模型 | `include/manifest_parser.h` + `src/manifest_parser.cpp` |

**验收标准：**
- 从 `const uint8_t*` + `size_t` 打开 RPK，不调用任何文件系统 API
- `readText("manifest.json")` 返回正确内容
- `parseManifest()` 提取出 package / name / entry 完整路径 / pages 列表 / display 配置
- 无效 ZIP（magic 错误、CRC 不匹配）返回 false 且有描述性错误
- ASan 验证无越界读取

**本步不包含：**
- 签名验证（V2）
- 增量更新 / 差分包（V2）
- assets 资源的按需加载（当前一次性索引，按需解压）
- 文件读取（平台层负责，Core 只接收字节）

---

## Step 8.1：理解 RPK 包结构

### 8.1.1：RPK 就是 ZIP

```bash
# 验证
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-examples/quickapp-code-test1/dist
file com.example.case1.debug.1.0.0.rpk
```

预期：

```text
com.example.case1.debug.1.0.0.rpk: Zip archive data, at least v2.0 to extract
```

查看内部结构：

```bash
unzip -l com.example.case1.debug.1.0.0.rpk
```

预期：

```text
  Length      Date    Time    Name
---------  ---------- -----   ----
      892  2024-01-01 00:00   manifest.json
     1543  2024-01-01 00:00   app.js
     4821  2024-01-01 00:00   pages/Demo/index.js
     3102  2024-01-01 00:00   pages/DemoDetail/index.js
     2048  2024-01-01 00:00   assets/logo.png
---------                     -------
    12406                     5 files
```

### 8.1.2：manifest.json 的实际内容

```bash
unzip -p com.example.case1.debug.1.0.0.rpk manifest.json | python3 -m json.tool
```

真实结构（快应用规范）：

```json
{
  "package": "com.example.case1",
  "name": "快应用示例",
  "versionName": "1.0.0",
  "versionCode": 1,
  "icon": "/assets/logo.png",
  "minPlatformVersion": 1070,
  "features": [
    { "name": "system.router" },
    { "name": "system.prompt" }
  ],
  "permissions": [
    { "origin": "*" }
  ],
  "config": {
    "logLevel": "debug"
  },
  "router": {
    "entry": "pages/Demo",
    "pages": {
      "pages/Demo": {
        "component": "index",
        "path": "/pages/Demo"
      },
      "pages/DemoDetail": {
        "component": "index",
        "path": "/pages/DemoDetail"
      }
    }
  },
  "display": {
    "titleBarBackgroundColor": "#f2f2f2",
    "titleBarTextColor": "#414141",
    "menu": true,
    "pages": {
      "pages/Demo": {
        "titleBarText": "快应用示例模版",
        "menu": false
      },
      "pages/DemoDetail": {
        "titleBarText": "详情页"
      }
    }
  }
}
```

### 8.1.3：entry 到文件路径的映射规则

这是解析中最容易搞错的地方：

```text
router.entry = "pages/Demo"                          ← 页面标识，不是文件路径
router.pages["pages/Demo"].component = "index"       ← 组件文件名，不带扩展名

实际文件路径 = entry + "/" + component + ".js"
             = "pages/Demo" + "/" + "index" + ".js"
             = "pages/Demo/index.js"
```

`component` 字段缺省时默认为 `"index"`。

另一个容易混淆的是 `path` 字段：

```text
router.pages["pages/Demo"].path = "/pages/Demo"      ← JS 侧 router.push 用的 URI
```

`router.push({uri: "/pages/DemoDetail"})` 里的 URI 是 `path`，需要反查回页面标识才能找到文件。所以 `ManifestParser` 要同时维护两个方向的映射。

---

## Step 8.2：理解 ZIP 格式

不引入 minizip，手写解析。所以必须先看清格式。

### 8.2.1：ZIP 文件的三部分

```text
┌─────────────────────────────────────────┐
│ Local File Header + 压缩数据（文件 1）    │  ← 顺序存放
│ Local File Header + 压缩数据（文件 2）    │
│ ...                                     │
├─────────────────────────────────────────┤
│ Central Directory Entry（文件 1）        │  ← 文件索引表
│ Central Directory Entry（文件 2）        │
│ ...                                     │
├─────────────────────────────────────────┤
│ End of Central Directory（EOCD）         │  ← 在文件末尾
└─────────────────────────────────────────┘
```

解析顺序是**从后往前**：

```text
1. 从文件末尾向前搜索 EOCD 的签名 0x06054b50
2. 从 EOCD 读出 Central Directory 的偏移和条目数
3. 遍历 Central Directory，建立 文件名 → 偏移 的索引
4. 需要某个文件时，跳到它的 Local File Header，解压数据
```

为什么不从头顺序读？因为 Local File Header 里的压缩长度字段在流式写入时可能是 0（真实值在 Data Descriptor 里）。Central Directory 的信息总是准确的。

### 8.2.2：三个结构的字段布局

```text
EOCD（End of Central Directory）— 至少 22 字节
偏移  长度  字段
0     4     签名 0x06054b50 ("PK\5\6")
4     2     当前磁盘号
6     2     Central Directory 起始磁盘号
8     2     本磁盘上的条目数
10    2     总条目数
12    4     Central Directory 总大小
16    4     Central Directory 起始偏移      ← 关键
20    2     注释长度
22    ...   注释内容（可变，所以要搜索签名）
```

```text
Central Directory Entry — 至少 46 字节
偏移  长度  字段
0     4     签名 0x02014b50 ("PK\1\2")
4     2     创建版本
6     2     解压所需版本
8     2     通用标志位
10    2     压缩方法          ← 0=Store, 8=Deflate
12    2     修改时间
14    2     修改日期
16    4     CRC-32            ← 用于校验
20    4     压缩后大小
24    4     压缩前大小
28    2     文件名长度
30    2     扩展字段长度
32    2     注释长度
34    2     起始磁盘号
36    2     内部属性
38    4     外部属性
42    4     Local File Header 偏移   ← 关键
46    ...   文件名（变长）
      ...   扩展字段（变长）
      ...   注释（变长）
```

```text
Local File Header — 至少 30 字节
偏移  长度  字段
0     4     签名 0x04034b50 ("PK\3\4")
4     2     解压所需版本
6     2     通用标志位
8     2     压缩方法
10    2     修改时间
12    2     修改日期
14    4     CRC-32
18    4     压缩后大小
22    4     压缩前大小
26    2     文件名长度
28    2     扩展字段长度
30    ...   文件名（变长）
      ...   扩展字段（变长）
      ...   压缩数据          ← 数据起点 = 30 + 文件名长度 + 扩展字段长度
```

### 8.2.3：两种压缩方法

```text
方法 0（Store）：未压缩，数据原样存放
    → 直接 memcpy

方法 8（Deflate）：zlib 的 raw deflate 流
    → 用 zlib 的 inflate 解压，windowBits 传 -15 表示 raw（无 zlib/gzip 头）
```

RPK 里的 `.js` 文件通常是 Deflate，小文件可能是 Store。两种都要支持。

---

## Step 8.3：实现 RPKLoader

### 8.3.1：创建头文件

**@add `include/rpk_loader.h`（新建文件）**

```cpp
#ifndef QUICKAPP_RPK_LOADER_H
#define QUICKAPP_RPK_LOADER_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace quickapp {

// RPK 包读取器。
//
// 职责：
//   解析 ZIP 格式的快应用包，按路径提取文件内容。
//
// 平台无关性：
//   只接受内存中的字节数组，不调用任何文件系统 API。
//   数据来源由平台层负责：
//     Android  AssetManager.open().readBytes()
//     iOS      NSData dataWithContentsOfFile
//     LVGL     从 SPI Flash / SD 卡读取到内存
//
// 数据所有权：
//   open() 传入的指针由调用方拥有，Loader 不拷贝也不释放。
//   调用方必须保证数据在 Loader 使用期间有效。
//   这样设计避免了大文件（RPK 可能几 MB）的额外内存拷贝。
//
// 线程所有权：
//   实例归属单一线程（Runtime Thread）。不做内部同步。
//
// 生命周期：
//   构造 → open() → [readText / readBinary / fileExists ...] → 析构
//   close() 可选，析构时自动清理索引。
class RPKLoader {
public:
    RPKLoader() = default;
    ~RPKLoader() = default;

    // 禁止拷贝：持有指向外部数据的指针，拷贝语义不清晰
    RPKLoader(const RPKLoader&) = delete;
    RPKLoader& operator=(const RPKLoader&) = delete;

    /**
     * 打开 RPK 包，建立文件索引。
     *
     * 行为：
     *   1. 从数据末尾搜索 EOCD 签名
     *   2. 定位 Central Directory
     *   3. 遍历所有条目，建立 文件名 → 元信息 的索引
     *   实际的文件内容解压推迟到 readText/readBinary 时进行（懒解压）。
     *
     * @param data RPK 字节数据的起始地址。不能为 nullptr。
     *             调用方保有所有权，必须保证在 Loader 使用期间有效
     * @param size 数据长度，单位字节。小于 22（EOCD 最小长度）时直接失败
     * @return true  解析成功，可以开始读文件
     *         false 数据为空、太小、EOCD 未找到或 Central Directory 损坏，
     *               通过 getLastError() 取错误描述
     *
     * 幂等性：重复调用会丢弃旧索引重新解析。
     */
    bool open(const uint8_t* data, size_t size);

    /**
     * 关闭并清空索引。析构时自动调用。
     */
    void close();

    /**
     * 判断包内是否存在指定文件。
     *
     * @param path ZIP 内的路径，如 "manifest.json"、"pages/Demo/index.js"。
     *             使用正斜杠分隔，不带前导斜杠。为 nullptr 时返回 false
     * @return true 文件存在
     */
    bool fileExists(const char* path) const;

    /**
     * 读取文件内容为文本。
     *
     * @param path ZIP 内的路径
     * @param out  输出参数，接收 UTF-8 文本内容。
     *             读取失败时不修改此参数
     * @return true  读取并解压成功
     *         false 文件不存在、压缩方法不支持或数据损坏，
     *               通过 getLastError() 取原因
     *
     * 说明：不做编码转换，假定 ZIP 内的文本是 UTF-8
     *      （快应用工具链的输出保证这一点）。
     */
    bool readText(const char* path, std::string& out) const;

    /**
     * 读取文件内容为二进制。用于图片等资源。
     *
     * @param path ZIP 内的路径
     * @param out  输出参数，接收原始字节。读取失败时不修改
     * @return true 成功；false 同 readText
     */
    bool readBinary(const char* path, std::vector<uint8_t>& out) const;

    /**
     * 列出包内所有文件路径。用于调试和资源枚举。
     * @return 路径列表，顺序不保证
     */
    std::vector<std::string> listFiles() const;

    /**
     * 包内文件数量。
     * @return 文件个数，未 open 时返回 0
     */
    size_t fileCount() const { return entries_.size(); }

    /**
     * 获取最近一次失败的原因。
     * @return 错误描述。无错误时返回空字符串
     */
    const std::string& getLastError() const { return lastError_; }

private:
    // ZIP 内单个文件的元信息。
    struct Entry {
        uint32_t localHeaderOffset;  // Local File Header 在数据中的偏移
        uint32_t compressedSize;     // 压缩后大小（字节）
        uint32_t uncompressedSize;   // 压缩前大小（字节）
        uint32_t crc32;              // 期望的 CRC-32 校验值
        uint16_t compressionMethod;  // 0=Store, 8=Deflate
    };

    /**
     * 从数据末尾向前搜索 EOCD 签名。
     *
     * 为什么要搜索而不是直接定位：
     *   EOCD 后面可能跟着可变长度的注释（最多 65535 字节），
     *   所以 EOCD 的位置不固定。
     *
     * @param outOffset 输出参数，接收 EOCD 的起始偏移
     * @return true 找到；false 未找到（不是有效 ZIP）
     */
    bool findEOCD(size_t& outOffset) const;

    /**
     * 解析 Central Directory，填充 entries_。
     *
     * @param cdOffset Central Directory 起始偏移（来自 EOCD）
     * @param cdEntryCount 期望的条目数（来自 EOCD）
     * @return true 全部解析成功
     */
    bool parseCentralDirectory(uint32_t cdOffset, uint16_t cdEntryCount);

    /**
     * 解压单个条目的数据。
     *
     * @param entry 条目元信息
     * @param out   输出缓冲，函数内部 resize 到 uncompressedSize
     * @return true 解压成功且 CRC 校验通过
     */
    bool extractEntry(const Entry& entry, std::vector<uint8_t>& out) const;

    /**
     * 从小端字节序读取 16 位无符号整数。
     *
     * ZIP 格式规定所有多字节整数都是小端序。
     * 不能直接 reinterpret_cast<uint16_t*>：
     *   1. 大端 CPU 上会读错（虽然当前目标平台都是小端）
     *   2. 未对齐访问在某些 ARM 配置下会触发 SIGBUS
     *
     * @param offset 读取起始偏移。调用方需保证 offset+2 <= size_
     * @return 读出的值
     */
    uint16_t readU16(size_t offset) const;

    /**
     * 从小端字节序读取 32 位无符号整数。
     * @param offset 读取起始偏移。调用方需保证 offset+4 <= size_
     * @return 读出的值
     */
    uint32_t readU32(size_t offset) const;

    // 指向外部数据，不拥有
    const uint8_t* data_ = nullptr;
    size_t size_ = 0;

    // 文件路径 → 元信息
    std::unordered_map<std::string, Entry> entries_;

    // mutable：const 方法（readText）失败时也要能设置错误信息
    mutable std::string lastError_;
};

} // namespace quickapp

#endif // QUICKAPP_RPK_LOADER_H
```


### 8.3.2：实现字节读取与 EOCD 搜索

**@add `src/rpk_loader.cpp`（新建文件）**

第一部分：常量、字节读取、EOCD 定位。

```cpp
#include "rpk_loader.h"

#include <cstring>

#include <zlib.h>

#include "qa_log.h"

namespace quickapp {
namespace {

// ZIP 格式的三个签名（小端序存放，这里按数值书写）
constexpr uint32_t kSigEOCD  = 0x06054b50;   // "PK\5\6"
constexpr uint32_t kSigCDE   = 0x02014b50;   // "PK\1\2"
constexpr uint32_t kSigLFH   = 0x04034b50;   // "PK\3\4"

// 各结构的最小长度（不含变长部分）
constexpr size_t kEOCDMinSize = 22;
constexpr size_t kCDEMinSize  = 46;
constexpr size_t kLFHMinSize  = 30;

// EOCD 后的注释最长 65535 字节，所以从末尾最多回退这么多
constexpr size_t kMaxCommentSize = 65535;

// 压缩方法
constexpr uint16_t kMethodStore   = 0;
constexpr uint16_t kMethodDeflate = 8;

// 单个文件解压后的大小上限。
// 防御 zip bomb：恶意构造的 RPK 声明一个 4GB 的 uncompressedSize，
// 我们直接 resize 会瞬间耗尽内存。
// 32MB 对快应用足够（最大的 .js bundle 通常 < 1MB）。
constexpr uint32_t kMaxUncompressedSize = 32 * 1024 * 1024;

} // namespace

uint16_t RPKLoader::readU16(size_t offset) const {
    // 逐字节组装，避免未对齐访问和字节序问题
    return static_cast<uint16_t>(data_[offset]) |
           (static_cast<uint16_t>(data_[offset + 1]) << 8);
}

uint32_t RPKLoader::readU32(size_t offset) const {
    return static_cast<uint32_t>(data_[offset]) |
           (static_cast<uint32_t>(data_[offset + 1]) << 8) |
           (static_cast<uint32_t>(data_[offset + 2]) << 16) |
           (static_cast<uint32_t>(data_[offset + 3]) << 24);
}

bool RPKLoader::findEOCD(size_t& outOffset) const {
    if (size_ < kEOCDMinSize) {
        return false;
    }

    // 搜索范围：从末尾往前，最多 EOCD 最小长度 + 最大注释长度。
    // 超出这个范围就不是有效 ZIP（或者注释超长，不符合规范）。
    const size_t searchLimit = (size_ < kEOCDMinSize + kMaxCommentSize)
                                   ? size_
                                   : kEOCDMinSize + kMaxCommentSize;

    // 从最后一个可能的 EOCD 起始位置开始向前扫
    for (size_t back = kEOCDMinSize; back <= searchLimit; ++back) {
        const size_t offset = size_ - back;
        if (readU32(offset) == kSigEOCD) {
            outOffset = offset;
            return true;
        }
    }
    return false;
}
```

第二部分：打开与 Central Directory 解析。

```cpp
bool RPKLoader::open(const uint8_t* data, size_t size) {
    close();   // 幂等：清掉旧状态

    if (data == nullptr) {
        lastError_ = "open: data is null";
        QA_LOGE("[RPKLoader] %s", lastError_.c_str());
        return false;
    }
    if (size < kEOCDMinSize) {
        lastError_ = "open: data too small to be a ZIP (size=" +
                     std::to_string(size) + ")";
        QA_LOGE("[RPKLoader] %s", lastError_.c_str());
        return false;
    }

    data_ = data;
    size_ = size;

    // 1. 定位 EOCD
    size_t eocdOffset = 0;
    if (!findEOCD(eocdOffset)) {
        lastError_ = "open: EOCD signature not found, not a valid ZIP archive";
        QA_LOGE("[RPKLoader] %s", lastError_.c_str());
        close();
        return false;
    }

    // 2. 从 EOCD 读出 Central Directory 的位置和条目数
    const uint16_t entryCount = readU16(eocdOffset + 10);
    const uint32_t cdSize     = readU32(eocdOffset + 12);
    const uint32_t cdOffset   = readU32(eocdOffset + 16);

    // 边界检查：Central Directory 必须完整落在数据范围内
    if (static_cast<size_t>(cdOffset) + cdSize > size_) {
        lastError_ = "open: central directory out of bounds (offset=" +
                     std::to_string(cdOffset) + ", size=" +
                     std::to_string(cdSize) + ", total=" +
                     std::to_string(size_) + ")";
        QA_LOGE("[RPKLoader] %s", lastError_.c_str());
        close();
        return false;
    }

    // 3. 解析条目
    if (!parseCentralDirectory(cdOffset, entryCount)) {
        close();
        return false;
    }

    QA_LOGI("[RPKLoader] opened: %zu bytes, %zu files", size_, entries_.size());
    return true;
}

bool RPKLoader::parseCentralDirectory(uint32_t cdOffset, uint16_t cdEntryCount) {
    size_t offset = cdOffset;

    for (uint16_t i = 0; i < cdEntryCount; ++i) {
        // 边界检查：至少要能读完固定部分
        if (offset + kCDEMinSize > size_) {
            lastError_ = "central directory entry " + std::to_string(i) +
                         " truncated";
            QA_LOGE("[RPKLoader] %s", lastError_.c_str());
            return false;
        }

        if (readU32(offset) != kSigCDE) {
            lastError_ = "central directory entry " + std::to_string(i) +
                         " has invalid signature";
            QA_LOGE("[RPKLoader] %s", lastError_.c_str());
            return false;
        }

        Entry entry{};
        entry.compressionMethod = readU16(offset + 10);
        entry.crc32             = readU32(offset + 16);
        entry.compressedSize    = readU32(offset + 20);
        entry.uncompressedSize  = readU32(offset + 24);

        const uint16_t nameLen    = readU16(offset + 28);
        const uint16_t extraLen   = readU16(offset + 30);
        const uint16_t commentLen = readU16(offset + 32);

        entry.localHeaderOffset = readU32(offset + 42);

        // 文件名的边界检查
        const size_t nameOffset = offset + kCDEMinSize;
        if (nameOffset + nameLen > size_) {
            lastError_ = "central directory entry " + std::to_string(i) +
                         " filename out of bounds";
            QA_LOGE("[RPKLoader] %s", lastError_.c_str());
            return false;
        }

        std::string name(reinterpret_cast<const char*>(data_ + nameOffset), nameLen);

        // 跳过目录条目（ZIP 里目录以 '/' 结尾且大小为 0）。
        // 我们按完整路径索引文件，不需要目录结构。
        if (!name.empty() && name.back() != '/') {
            // 防御 zip bomb
            if (entry.uncompressedSize > kMaxUncompressedSize) {
                QA_LOGW("[RPKLoader] skipping '%s': uncompressed size %u exceeds "
                        "limit %u", name.c_str(), entry.uncompressedSize,
                        kMaxUncompressedSize);
            } else {
                entries_[name] = entry;
                QA_LOGD("[RPKLoader] indexed '%s' (%u -> %u bytes, method=%u)",
                        name.c_str(), entry.compressedSize,
                        entry.uncompressedSize, entry.compressionMethod);
            }
        }

        // 移到下一个条目
        offset = nameOffset + nameLen + extraLen + commentLen;
    }

    return true;
}

void RPKLoader::close() {
    entries_.clear();
    data_ = nullptr;
    size_ = 0;
    // 不清 lastError_：调用方可能在 close 后读取失败原因
}
```


第三部分：解压实现。

```cpp
bool RPKLoader::extractEntry(const Entry& entry, std::vector<uint8_t>& out) const {
    // 1. 定位 Local File Header
    const size_t lfhOffset = entry.localHeaderOffset;
    if (lfhOffset + kLFHMinSize > size_) {
        lastError_ = "extractEntry: local file header out of bounds";
        return false;
    }
    if (readU32(lfhOffset) != kSigLFH) {
        lastError_ = "extractEntry: invalid local file header signature";
        return false;
    }

    // 2. 计算数据起点。
    //    LFH 的文件名和扩展字段长度可能和 Central Directory 里的不同
    //    （扩展字段常见差异），所以必须从 LFH 自己读。
    const uint16_t nameLen  = readU16(lfhOffset + 26);
    const uint16_t extraLen = readU16(lfhOffset + 28);
    const size_t dataOffset = lfhOffset + kLFHMinSize + nameLen + extraLen;

    if (dataOffset + entry.compressedSize > size_) {
        lastError_ = "extractEntry: compressed data out of bounds";
        return false;
    }

    const uint8_t* src = data_ + dataOffset;

    // 3. 按压缩方法处理
    if (entry.compressionMethod == kMethodStore) {
        // 未压缩，直接拷贝
        out.assign(src, src + entry.compressedSize);

    } else if (entry.compressionMethod == kMethodDeflate) {
        out.resize(entry.uncompressedSize);

        // 空文件特殊处理：uncompressedSize 为 0 时 inflate 会返回错误
        if (entry.uncompressedSize == 0) {
            return true;
        }

        z_stream stream{};
        stream.next_in   = const_cast<Bytef*>(src);
        stream.avail_in  = entry.compressedSize;
        stream.next_out  = out.data();
        stream.avail_out = entry.uncompressedSize;

        // windowBits 传 -15 表示 raw deflate：
        //   ZIP 里存的是裸 deflate 流，没有 zlib 头（0x78 0x9C）也没有 gzip 头。
        //   传 15 会因为找不到 zlib 头而报 Z_DATA_ERROR。
        int ret = inflateInit2(&stream, -MAX_WBITS);
        if (ret != Z_OK) {
            lastError_ = "extractEntry: inflateInit2 failed, code=" +
                         std::to_string(ret);
            return false;
        }

        ret = inflate(&stream, Z_FINISH);
        inflateEnd(&stream);

        // Z_STREAM_END 表示正常解压完成。
        // Z_OK 表示还有数据没解完，说明 uncompressedSize 声明的比实际小。
        if (ret != Z_STREAM_END) {
            lastError_ = "extractEntry: inflate failed, code=" +
                         std::to_string(ret) +
                         " (expected " + std::to_string(entry.uncompressedSize) +
                         " bytes, got " + std::to_string(stream.total_out) + ")";
            return false;
        }

        if (stream.total_out != entry.uncompressedSize) {
            lastError_ = "extractEntry: size mismatch after inflate";
            return false;
        }

    } else {
        lastError_ = "extractEntry: unsupported compression method " +
                     std::to_string(entry.compressionMethod);
        return false;
    }

    // 4. CRC 校验。
    //    验证解压结果的完整性，能发现数据损坏和错误的偏移计算。
    //    crc32 是 zlib 提供的函数。
    if (entry.crc32 != 0 && !out.empty()) {
        const uLong actual = crc32(0L, out.data(), static_cast<uInt>(out.size()));
        if (actual != entry.crc32) {
            lastError_ = "extractEntry: CRC mismatch (expected 0x" +
                         std::to_string(entry.crc32) + ", got 0x" +
                         std::to_string(actual) + ")";
            return false;
        }
    }

    return true;
}

bool RPKLoader::fileExists(const char* path) const {
    if (path == nullptr) {
        return false;
    }
    return entries_.find(std::string(path)) != entries_.end();
}

bool RPKLoader::readBinary(const char* path, std::vector<uint8_t>& out) const {
    if (path == nullptr) {
        lastError_ = "readBinary: path is null";
        return false;
    }
    if (data_ == nullptr) {
        lastError_ = "readBinary: loader not opened";
        return false;
    }

    auto it = entries_.find(std::string(path));
    if (it == entries_.end()) {
        lastError_ = std::string("readBinary: file not found in RPK: ") + path;
        QA_LOGW("[RPKLoader] %s", lastError_.c_str());
        return false;
    }

    if (!extractEntry(it->second, out)) {
        QA_LOGE("[RPKLoader] readBinary('%s'): %s", path, lastError_.c_str());
        return false;
    }

    QA_LOGD("[RPKLoader] read '%s': %zu bytes", path, out.size());
    return true;
}

bool RPKLoader::readText(const char* path, std::string& out) const {
    std::vector<uint8_t> bytes;
    if (!readBinary(path, bytes)) {
        return false;
    }
    // 从字节数组构造字符串。
    // 用两个迭代器的构造函数而不是 c_str()：ZIP 内的数据不保证以 '\0' 结尾。
    out.assign(bytes.begin(), bytes.end());
    return true;
}

std::vector<std::string> RPKLoader::listFiles() const {
    std::vector<std::string> files;
    files.reserve(entries_.size());
    for (const auto& [name, _] : entries_) {
        files.push_back(name);
    }
    return files;
}

} // namespace quickapp
```

---

## Step 8.4：实现 ManifestParser

### 8.4.1：创建头文件

**@add `include/manifest_parser.h`（新建文件）**

```cpp
#ifndef QUICKAPP_MANIFEST_PARSER_H
#define QUICKAPP_MANIFEST_PARSER_H

#include <map>
#include <string>
#include <vector>

namespace quickapp {

class JSEngine;

// 单个页面的显示配置。
struct PageDisplayConfig {
    std::string titleBarText;               // 标题栏文字
    bool menu = true;                       // 是否显示菜单按钮
    bool hasTitleBar = true;                // 是否显示标题栏
    std::string titleBarBackgroundColor;    // 页面级覆盖，空表示用全局值
    std::string titleBarTextColor;          // 页面级覆盖，空表示用全局值
};

// 应用级显示配置。
struct DisplayConfig {
    std::string titleBarBackgroundColor = "#f2f2f2";
    std::string titleBarTextColor = "#414141";
    bool menu = true;

    // 页面标识（如 "pages/Demo"）→ 该页的显示配置
    std::map<std::string, PageDisplayConfig> pages;
};

// 单个页面的路由信息。
struct PageRoute {
    std::string name;        // 页面标识，如 "pages/Demo"
    std::string component;   // 组件文件名（不含扩展名），默认 "index"
    std::string path;        // JS 侧 URI，如 "/pages/Demo"

    /**
     * 计算页面 bundle 在 RPK 内的实际路径。
     *
     * 规则：name + "/" + component + ".js"
     * 例："pages/Demo" + "/" + "index" + ".js" = "pages/Demo/index.js"
     *
     * @return RPK 内的文件路径，可直接传给 RPKLoader::readText
     */
    std::string bundlePath() const {
        return name + "/" + (component.empty() ? "index" : component) + ".js";
    }
};

// manifest.json 的结构化模型。
struct Manifest {
    std::string package;         // 包名，如 "com.example.case1"
    std::string name;            // 应用名，用作 TitleBar 默认标题
    std::string versionName;     // 版本字符串，如 "1.0.0"
    int versionCode = 0;         // 版本号
    std::string icon;            // 图标路径，如 "/assets/logo.png"
    int minPlatformVersion = 0;  // 最低平台版本要求

    std::string entry;           // 入口页标识，如 "pages/Demo"

    // 页面标识 → 路由信息
    std::map<std::string, PageRoute> pages;

    DisplayConfig display;

    // 声明使用的系统能力，如 "system.router"。
    // V1 只记录不校验；V2 用它做权限门禁。
    std::vector<std::string> features;

    /**
     * 按页面标识查找路由信息。
     *
     * @param pageName 页面标识，如 "pages/Demo"
     * @return 路由指针，未找到返回 nullptr
     */
    const PageRoute* findPage(const std::string& pageName) const;

    /**
     * 按 JS 侧 URI 反查页面路由。
     *
     * 用途：router.push({uri: "/pages/DemoDetail"}) 需要把 URI
     *      映射回页面标识才能找到 bundle 文件。
     *
     * @param uri JS 侧路径，如 "/pages/DemoDetail"。
     *            支持带 query 的形式（"/pages/X?id=1"），会截断 query 部分
     * @return 路由指针，未找到返回 nullptr
     */
    const PageRoute* findPageByUri(const std::string& uri) const;

    /**
     * 获取入口页的路由信息。
     * @return 路由指针，entry 无效时返回 nullptr
     */
    const PageRoute* entryPage() const { return findPage(entry); }

    /**
     * 获取某页的有效显示配置（合并全局默认值和页面级覆盖）。
     *
     * @param pageName 页面标识
     * @return 合并后的配置。页面无专属配置时返回全局默认值 +
     *         titleBarText 回退为应用名
     */
    PageDisplayConfig effectiveDisplay(const std::string& pageName) const;
};

// manifest.json 解析器。
//
// 实现方式：
//   复用 QuickJS 的 JS_ParseJSON，不引入 cJSON 等额外依赖。
//   理由：Core 已经依赖 QuickJS，它的 JSON 解析器经过充分测试，
//        零新增依赖和体积。
//
// 线程所有权：
//   parse() 内部使用 JSEngine 的 JSContext，
//   必须在 Runtime Thread 调用。
class ManifestParser {
public:
    /**
     * 解析 manifest.json。
     *
     * @param engine 已初始化的 JS 引擎，用它的 JSON 解析能力。不能为 nullptr
     * @param json   manifest.json 的完整内容，UTF-8。不能为 nullptr
     * @param out    输出参数，接收解析结果。失败时内容不确定
     * @return true  解析成功且必填字段齐全
     *         false JSON 语法错误或缺少必填字段（package / router.entry），
     *               通过 getLastError() 取原因
     */
    bool parse(JSEngine* engine, const char* json, Manifest& out);

    /**
     * 获取最近一次失败的原因。
     * @return 错误描述，包含缺失的字段名。无错误时返回空字符串
     */
    const std::string& getLastError() const { return lastError_; }

private:
    std::string lastError_;
};

} // namespace quickapp

#endif // QUICKAPP_MANIFEST_PARSER_H
```


### 8.4.2：实现 Manifest 的查找方法

**@add `src/manifest_parser.cpp`（新建文件）**

第一部分：Manifest 的成员方法和 JSON 读取辅助函数。

```cpp
#include "manifest_parser.h"

#include <cstring>

#include "js_engine.h"
#include "qa_log.h"
#include "quickjs.h"

namespace quickapp {

// ============================================================
// Manifest 的查找方法
// ============================================================

const PageRoute* Manifest::findPage(const std::string& pageName) const {
    auto it = pages.find(pageName);
    return (it != pages.end()) ? &it->second : nullptr;
}

const PageRoute* Manifest::findPageByUri(const std::string& uri) const {
    // 去掉 query 部分："/pages/X?id=1" → "/pages/X"
    std::string cleanUri = uri;
    const size_t queryPos = cleanUri.find('?');
    if (queryPos != std::string::npos) {
        cleanUri = cleanUri.substr(0, queryPos);
    }

    // 线性查找。页面数量通常 < 50，不值得建反向索引。
    for (const auto& [name, route] : pages) {
        if (route.path == cleanUri) {
            return &route;
        }
    }

    // 回退：URI 去掉前导斜杠后当作页面标识匹配。
    // 处理 manifest 里 path 字段缺失的情况（工具链某些版本不生成 path）。
    if (!cleanUri.empty() && cleanUri.front() == '/') {
        const std::string asName = cleanUri.substr(1);
        return findPage(asName);
    }

    return nullptr;
}

PageDisplayConfig Manifest::effectiveDisplay(const std::string& pageName) const {
    PageDisplayConfig result;

    // 1. 先填全局默认值
    result.titleBarBackgroundColor = display.titleBarBackgroundColor;
    result.titleBarTextColor = display.titleBarTextColor;
    result.menu = display.menu;
    // 标题默认用应用名（需求 8 的验收标准 5）
    result.titleBarText = name;

    // 2. 页面级配置覆盖
    auto it = display.pages.find(pageName);
    if (it != display.pages.end()) {
        const PageDisplayConfig& pageCfg = it->second;

        if (!pageCfg.titleBarText.empty()) {
            result.titleBarText = pageCfg.titleBarText;
        }
        // 颜色字段：非空才覆盖，空表示"沿用全局"
        if (!pageCfg.titleBarBackgroundColor.empty()) {
            result.titleBarBackgroundColor = pageCfg.titleBarBackgroundColor;
        }
        if (!pageCfg.titleBarTextColor.empty()) {
            result.titleBarTextColor = pageCfg.titleBarTextColor;
        }
        // bool 字段直接覆盖（无法区分"未设置"和"设为false"，
        // 所以解析时只在 JSON 里确实存在该字段时才写入）
        result.menu = pageCfg.menu;
        result.hasTitleBar = pageCfg.hasTitleBar;
    }

    return result;
}

// ============================================================
// JSON 读取辅助函数
// ============================================================

namespace {

/**
 * 从 JS 对象读取字符串属性。
 *
 * @param ctx  QuickJS 上下文
 * @param obj  源对象
 * @param key  属性名
 * @param out  输出参数。属性不存在或不是字符串时不修改（保留默认值）
 * @return true 读取成功并写入了 out
 */
bool getString(JSContext* ctx, JSValueConst obj, const char* key, std::string& out) {
    JSValue val = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsUndefined(val) || JS_IsNull(val)) {
        JS_FreeValue(ctx, val);
        return false;
    }
    const char* s = JS_ToCString(ctx, val);
    if (s == nullptr) {
        JS_FreeValue(ctx, val);
        return false;
    }
    out = s;
    JS_FreeCString(ctx, s);
    JS_FreeValue(ctx, val);
    return true;
}

/**
 * 从 JS 对象读取整数属性。
 *
 * @param ctx QuickJS 上下文
 * @param obj 源对象
 * @param key 属性名
 * @param out 输出参数。属性不存在时不修改
 * @return true 读取成功
 */
bool getInt(JSContext* ctx, JSValueConst obj, const char* key, int& out) {
    JSValue val = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsUndefined(val) || JS_IsNull(val)) {
        JS_FreeValue(ctx, val);
        return false;
    }
    int32_t tmp = 0;
    const bool ok = (JS_ToInt32(ctx, &tmp, val) == 0);
    if (ok) {
        out = tmp;
    }
    JS_FreeValue(ctx, val);
    return ok;
}

/**
 * 从 JS 对象读取布尔属性。
 *
 * @param ctx QuickJS 上下文
 * @param obj 源对象
 * @param key 属性名
 * @param out 输出参数。属性不存在时不修改
 * @return true 属性存在且已写入 out
 */
bool getBool(JSContext* ctx, JSValueConst obj, const char* key, bool& out) {
    JSValue val = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsUndefined(val) || JS_IsNull(val)) {
        JS_FreeValue(ctx, val);
        return false;
    }
    // JS_ToBool 遵循 JS 的真值转换：0/""/null 为 false
    out = (JS_ToBool(ctx, val) == 1);
    JS_FreeValue(ctx, val);
    return true;
}

/**
 * 遍历 JS 对象的所有可枚举属性。
 *
 * 用于处理 router.pages 和 display.pages 这类"键是动态的"对象。
 *
 * @param ctx      QuickJS 上下文
 * @param obj      要遍历的对象
 * @param callback 对每个属性调用，参数是属性名和属性值。
 *                 callback 内不需要释放 value（由本函数负责）
 */
template <typename Fn>
void forEachProperty(JSContext* ctx, JSValueConst obj, Fn&& callback) {
    if (!JS_IsObject(obj)) {
        return;
    }

    JSPropertyEnum* props = nullptr;
    uint32_t count = 0;

    // JS_GPN_STRING_MASK：只要字符串键，忽略 Symbol
    // JS_GPN_ENUM_ONLY：只要可枚举属性
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

    // 释放属性名枚举结果。
    // 必须逐个释放 atom，再释放数组本身。
    for (uint32_t i = 0; i < count; ++i) {
        JS_FreeAtom(ctx, props[i].atom);
    }
    js_free(ctx, props);
}

} // namespace
```


第二部分：主解析函数的前半段（JSON 解析 + 顶层字段 + features）。

```cpp
bool ManifestParser::parse(JSEngine* engine, const char* json, Manifest& out) {
    lastError_.clear();

    if (engine == nullptr) {
        lastError_ = "parse: engine is null";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }
    if (json == nullptr) {
        lastError_ = "parse: json is null";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }

    auto* ctx = static_cast<JSContext*>(engine->getRawContext());
    if (ctx == nullptr) {
        lastError_ = "parse: engine not initialized";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }

    // ---- 1. 解析 JSON ----
    // 复用 QuickJS 的 JSON 解析器。
    // 第三个参数是文件名，会出现在语法错误信息里。
    JSValue root = JS_ParseJSON(ctx, json, std::strlen(json), "manifest.json");

    if (JS_IsException(root)) {
        JSValue exc = JS_GetException(ctx);
        const char* msg = JS_ToCString(ctx, exc);
        lastError_ = std::string("parse: invalid JSON - ") +
                     (msg != nullptr ? msg : "<unknown>");
        if (msg != nullptr) {
            JS_FreeCString(ctx, msg);
        }
        JS_FreeValue(ctx, exc);
        JS_FreeValue(ctx, root);
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }

    if (!JS_IsObject(root)) {
        lastError_ = "parse: manifest root is not an object";
        JS_FreeValue(ctx, root);
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }

    // ---- 2. 顶层字段 ----
    getString(ctx, root, "package", out.package);
    getString(ctx, root, "name", out.name);
    getString(ctx, root, "versionName", out.versionName);
    getInt(ctx, root, "versionCode", out.versionCode);
    getString(ctx, root, "icon", out.icon);
    getInt(ctx, root, "minPlatformVersion", out.minPlatformVersion);

    // ---- 3. features 数组 ----
    // 形态：[ { "name": "system.router" }, { "name": "system.prompt" } ]
    {
        JSValue features = JS_GetPropertyStr(ctx, root, "features");
        if (JS_IsArray(ctx, features)) {
            JSValue lenVal = JS_GetPropertyStr(ctx, features, "length");
            int32_t len = 0;
            JS_ToInt32(ctx, &len, lenVal);
            JS_FreeValue(ctx, lenVal);

            for (int32_t i = 0; i < len; ++i) {
                JSValue item =
                    JS_GetPropertyUint32(ctx, features, static_cast<uint32_t>(i));
                std::string featureName;
                if (getString(ctx, item, "name", featureName)) {
                    out.features.push_back(featureName);
                }
                JS_FreeValue(ctx, item);
            }
        }
        JS_FreeValue(ctx, features);
    }
```

第三部分：router 与 display 解析，以及必填校验。

```cpp
    // ---- 4. router ----
    {
        JSValue router = JS_GetPropertyStr(ctx, root, "router");
        if (!JS_IsObject(router)) {
            lastError_ = "parse: missing required field 'router'";
            JS_FreeValue(ctx, router);
            JS_FreeValue(ctx, root);
            QA_LOGE("[ManifestParser] %s", lastError_.c_str());
            return false;
        }

        getString(ctx, router, "entry", out.entry);

        // router.pages 的键是页面标识，值是 { component, path }
        JSValue pagesObj = JS_GetPropertyStr(ctx, router, "pages");
        forEachProperty(ctx, pagesObj, [&](const char* key, JSValue value) {
            PageRoute route;
            route.name = key;
            route.component = "index";   // 规范默认值

            if (JS_IsObject(value)) {
                getString(ctx, value, "component", route.component);
                getString(ctx, value, "path", route.path);
            }

            // path 缺失时按约定推导："pages/Demo" -> "/pages/Demo"
            // 某些工具链版本不生成 path 字段
            if (route.path.empty()) {
                route.path = "/" + route.name;
            }

            out.pages[route.name] = route;
        });
        JS_FreeValue(ctx, pagesObj);
        JS_FreeValue(ctx, router);
    }

    // ---- 5. display ----
    {
        JSValue display = JS_GetPropertyStr(ctx, root, "display");
        if (JS_IsObject(display)) {
            getString(ctx, display, "titleBarBackgroundColor",
                      out.display.titleBarBackgroundColor);
            getString(ctx, display, "titleBarTextColor",
                      out.display.titleBarTextColor);
            getBool(ctx, display, "menu", out.display.menu);

            // display.pages 的键是页面标识，值是该页的显示覆盖配置
            JSValue dispPages = JS_GetPropertyStr(ctx, display, "pages");
            forEachProperty(ctx, dispPages, [&](const char* key, JSValue value) {
                if (!JS_IsObject(value)) {
                    return;
                }
                PageDisplayConfig cfg;
                // 继承全局默认值，未显式设置的字段保持为空/默认，
                // 由 effectiveDisplay 决定最终取值
                cfg.menu = out.display.menu;

                getString(ctx, value, "titleBarText", cfg.titleBarText);
                getString(ctx, value, "titleBarBackgroundColor",
                          cfg.titleBarBackgroundColor);
                getString(ctx, value, "titleBarTextColor", cfg.titleBarTextColor);
                getBool(ctx, value, "menu", cfg.menu);
                getBool(ctx, value, "titleBar", cfg.hasTitleBar);

                out.display.pages[key] = cfg;
            });
            JS_FreeValue(ctx, dispPages);
        }
        JS_FreeValue(ctx, display);
    }

    JS_FreeValue(ctx, root);

    // ---- 6. 必填字段校验 ----
    if (out.package.empty()) {
        lastError_ = "parse: missing required field 'package'";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }
    if (out.entry.empty()) {
        lastError_ = "parse: missing required field 'router.entry'";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }
    if (out.pages.empty()) {
        lastError_ = "parse: 'router.pages' is empty";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }
    // entry 必须在 pages 里有对应条目，否则找不到入口 bundle
    if (out.findPage(out.entry) == nullptr) {
        lastError_ = "parse: entry page '" + out.entry +
                     "' not found in router.pages";
        QA_LOGE("[ManifestParser] %s", lastError_.c_str());
        return false;
    }

    QA_LOGI("[ManifestParser] parsed: package=%s name=%s version=%s "
            "entry=%s pages=%zu features=%zu",
            out.package.c_str(), out.name.c_str(), out.versionName.c_str(),
            out.entry.c_str(), out.pages.size(), out.features.size());
    QA_LOGI("[ManifestParser] entry bundle path: %s",
            out.entryPage()->bundlePath().c_str());

    return true;
}

} // namespace quickapp
```

---

## Step 8.5：接入 CMake

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
    src/rpk_loader.cpp                          # ← Step 08 新增
    src/manifest_parser.cpp                     # ← Step 08 新增
    platform/common/posix_event_loop.cpp
)
```

zlib 的链接在 Step 02 已经配置好（`ZLIB::ZLIB` 在 `target_link_libraries` 的 PRIVATE 列表里），`rpk_loader.cpp` 直接 `#include <zlib.h>` 即可。

---

## Step 8.6：编写测试

测试需要一个真实的 ZIP 文件。用 CMake 在构建时生成，避免往仓库塞二进制。

**@add `tests/make_test_rpk.cmake`（新建文件）**

```cmake
# 构建期生成测试用 RPK。
#
# 不把 .rpk 二进制文件提交进仓库，理由：
#   1. 二进制文件无法 code review
#   2. 修改测试数据需要重新打包，流程繁琐
#   3. 用 CMake 生成保证内容和测试代码同步

set(RPK_STAGE "${CMAKE_CURRENT_BINARY_DIR}/test_rpk_stage")
file(REMOVE_RECURSE "${RPK_STAGE}")
file(MAKE_DIRECTORY "${RPK_STAGE}/pages/Demo")
file(MAKE_DIRECTORY "${RPK_STAGE}/pages/DemoDetail")

# manifest.json：覆盖所有需要解析的字段
file(WRITE "${RPK_STAGE}/manifest.json" [=[
{
  "package": "com.example.testcase",
  "name": "测试应用",
  "versionName": "1.2.3",
  "versionCode": 7,
  "icon": "/assets/logo.png",
  "minPlatformVersion": 1070,
  "features": [
    { "name": "system.router" },
    { "name": "system.prompt" }
  ],
  "router": {
    "entry": "pages/Demo",
    "pages": {
      "pages/Demo": { "component": "index", "path": "/pages/Demo" },
      "pages/DemoDetail": { "component": "index", "path": "/pages/DemoDetail" },
      "pages/NoPath": { "component": "main" }
    }
  },
  "display": {
    "titleBarBackgroundColor": "#f2f2f2",
    "titleBarTextColor": "#414141",
    "menu": true,
    "pages": {
      "pages/Demo": { "titleBarText": "快应用示例模版", "menu": false },
      "pages/DemoDetail": { "titleBarText": "详情页", "titleBarTextColor": "#ff0000" }
    }
  }
}
]=])

# app.js
file(WRITE "${RPK_STAGE}/app.js"
     "$app_define$('@app-application/app', [], function() {});\n")

# 入口页 bundle。写长一些确保被 Deflate 压缩（短文件可能存为 Store）
file(WRITE "${RPK_STAGE}/pages/Demo/index.js"
     "// entry page bundle for RPKLoader test\n"
     "$app_define$('@app-component/Demo', [], function() {\n"
     "  return { template: { type: 'div' }, private: { title: 'hello' } };\n"
     "});\n"
     "// padding to make deflate worthwhile: "
     "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
     "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n")

file(WRITE "${RPK_STAGE}/pages/DemoDetail/index.js"
     "$app_define$('@app-component/DemoDetail', [], function() {});\n")

# 空文件：验证 uncompressedSize == 0 的边界情况
file(WRITE "${RPK_STAGE}/empty.txt" "")

# UTF-8 内容：验证中文不乱码
file(WRITE "${RPK_STAGE}/utf8.txt" "中文内容测试 UTF-8 编码\n")

# 打包为 ZIP。CMake 的 tar 命令支持 zip 格式，跨平台可用
execute_process(
    COMMAND ${CMAKE_COMMAND} -E tar "cf" "${OUTPUT_RPK}" --format=zip
            manifest.json app.js pages empty.txt utf8.txt
    WORKING_DIRECTORY "${RPK_STAGE}"
    RESULT_VARIABLE zip_result
)

if(NOT zip_result EQUAL 0)
    message(FATAL_ERROR "Failed to create test RPK: ${zip_result}")
endif()

message(STATUS "Generated test RPK: ${OUTPUT_RPK}")
```

**@update `tests/CMakeLists.txt` — 在 `test_js_bridge` 之后插入**

```cmake
# ============================================================
# test_rpk_loader：ZIP 解析与 Manifest 解析
# ============================================================

# 构建期生成测试 RPK
set(TEST_RPK "${CMAKE_CURRENT_BINARY_DIR}/test.rpk")
add_custom_command(
    OUTPUT "${TEST_RPK}"
    COMMAND ${CMAKE_COMMAND}
            -DOUTPUT_RPK=${TEST_RPK}
            -P ${CMAKE_CURRENT_SOURCE_DIR}/make_test_rpk.cmake
    COMMENT "Generating test RPK archive"
    VERBATIM
)
add_custom_target(generate_test_rpk DEPENDS "${TEST_RPK}")

add_executable(test_rpk_loader test_rpk_loader.cpp)
add_dependencies(test_rpk_loader generate_test_rpk)
target_link_libraries(test_rpk_loader PRIVATE quickapp-core)

# 把 RPK 路径作为编译期常量传给测试代码
target_compile_definitions(test_rpk_loader PRIVATE
    TEST_RPK_PATH="${TEST_RPK}"
)
add_test(NAME test_rpk_loader COMMAND test_rpk_loader)
```

---
**@add `tests/test_rpk_loader.cpp`（新建文件）**

第一部分：辅助函数和 RPKLoader 测试。

```cpp
// RPKLoader 与 ManifestParser 测试。
//
// 验证点：
//   1. 打开有效 ZIP，索引正确
//   2. readText 返回正确内容（含 Deflate 和 Store 两种）
//   3. 空文件、UTF-8 内容正确处理
//   4. 不存在的文件返回 false
//   5. 无效数据（空/太小/magic 错误）安全失败
//   6. Manifest 全字段解析
//   7. entry → bundlePath 映射正确
//   8. URI 反查页面
//   9. display 配置合并（全局 + 页面级覆盖）
//  10. 必填字段缺失时报错

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "js_engine.h"
#include "manifest_parser.h"
#include "rpk_loader.h"

#define CHECK(cond, msg)                                    \
    do {                                                    \
        if (!(cond)) {                                      \
            std::fprintf(stderr, "FAIL: %s\n", msg);        \
            return 1;                                       \
        }                                                   \
    } while (0)

namespace {

/**
 * 把文件读入内存。
 *
 * 注意：这个函数在测试里出现，是因为测试需要模拟平台层的角色。
 * Core 本身不做文件 IO —— 这正是 RPKLoader 只接收字节数组的原因。
 *
 * @param path 文件路径
 * @param out  输出参数，接收文件全部内容
 * @return true 读取成功
 */
bool readFileToMemory(const char* path, std::vector<uint8_t>& out) {
    std::FILE* fp = std::fopen(path, "rb");
    if (fp == nullptr) {
        std::fprintf(stderr, "cannot open %s\n", path);
        return false;
    }
    std::fseek(fp, 0, SEEK_END);
    const long size = std::ftell(fp);
    std::fseek(fp, 0, SEEK_SET);

    if (size <= 0) {
        std::fclose(fp);
        return false;
    }

    out.resize(static_cast<size_t>(size));
    const size_t read = std::fread(out.data(), 1, out.size(), fp);
    std::fclose(fp);
    return read == out.size();
}

int testRPKLoader(const std::vector<uint8_t>& rpkData) {
    quickapp::RPKLoader loader;

    // ---- 场景 1：无效输入 ----
    CHECK(!loader.open(nullptr, 100), "open(nullptr) should fail");
    CHECK(!loader.getLastError().empty(), "error should be set");

    CHECK(!loader.open(rpkData.data(), 10), "open with tiny size should fail");

    const uint8_t garbage[64] = {0};
    CHECK(!loader.open(garbage, sizeof(garbage)),
          "open with garbage should fail (no EOCD)");
    CHECK(loader.getLastError().find("EOCD") != std::string::npos,
          "error should mention EOCD");

    // ---- 场景 2：打开有效 RPK ----
    CHECK(loader.open(rpkData.data(), rpkData.size()), "open valid RPK failed");
    CHECK(loader.fileCount() >= 6, "should index at least 6 files");

    // ---- 场景 3：文件存在性 ----
    CHECK(loader.fileExists("manifest.json"), "manifest.json should exist");
    CHECK(loader.fileExists("app.js"), "app.js should exist");
    CHECK(loader.fileExists("pages/Demo/index.js"), "entry bundle should exist");
    CHECK(!loader.fileExists("nonexistent.js"), "nonexistent file should not exist");
    CHECK(!loader.fileExists(nullptr), "fileExists(nullptr) should be safe");

    // 目录条目不应该被索引
    CHECK(!loader.fileExists("pages/"), "directory entries should not be indexed");

    // ---- 场景 4：读取文本 ----
    std::string manifestJson;
    CHECK(loader.readText("manifest.json", manifestJson), "readText manifest failed");
    CHECK(!manifestJson.empty(), "manifest content should not be empty");
    CHECK(manifestJson.find("com.example.testcase") != std::string::npos,
          "manifest should contain package name");
    CHECK(manifestJson.find("\"entry\"") != std::string::npos,
          "manifest should contain entry field");

    std::string entryBundle;
    CHECK(loader.readText("pages/Demo/index.js", entryBundle),
          "readText entry bundle failed");
    CHECK(entryBundle.find("$app_define$") != std::string::npos,
          "bundle should contain $app_define$");
    CHECK(entryBundle.find("@app-component/Demo") != std::string::npos,
          "bundle should contain component name");

    // ---- 场景 5：空文件 ----
    std::string emptyContent = "not-cleared";
    CHECK(loader.readText("empty.txt", emptyContent), "readText empty file failed");
    CHECK(emptyContent.empty(), "empty file should produce empty string");

    // ---- 场景 6：UTF-8 内容 ----
    std::string utf8Content;
    CHECK(loader.readText("utf8.txt", utf8Content), "readText utf8 failed");
    CHECK(utf8Content.find("中文内容测试") != std::string::npos,
          "UTF-8 content should be preserved");

    // ---- 场景 7：读取不存在的文件 ----
    std::string missing;
    CHECK(!loader.readText("does/not/exist.js", missing),
          "reading missing file should fail");
    CHECK(loader.getLastError().find("not found") != std::string::npos,
          "error should say not found");
    CHECK(!loader.readText(nullptr, missing), "readText(nullptr) should be safe");

    // ---- 场景 8：二进制读取 ----
    std::vector<uint8_t> binary;
    CHECK(loader.readBinary("manifest.json", binary), "readBinary failed");
    CHECK(binary.size() == manifestJson.size(),
          "binary and text size should match");

    // ---- 场景 9：列出文件 ----
    const auto files = loader.listFiles();
    CHECK(files.size() == loader.fileCount(), "listFiles size mismatch");

    // ---- 场景 10：重复 open（幂等） ----
    CHECK(loader.open(rpkData.data(), rpkData.size()), "re-open should succeed");
    CHECK(loader.fileExists("manifest.json"), "index should be rebuilt");

    // ---- 场景 11：close 后不可读 ----
    loader.close();
    CHECK(loader.fileCount() == 0, "fileCount should be 0 after close");
    CHECK(!loader.fileExists("manifest.json"), "no files after close");
    std::string afterClose;
    CHECK(!loader.readText("manifest.json", afterClose),
          "readText after close should fail");

    return 0;
}
```

第二部分：ManifestParser 测试和 main。

```cpp
int testManifestParser(const std::string& manifestJson) {
    auto engine = quickapp::createJSEngine();
    CHECK(engine->initialize(), "engine init failed");

    quickapp::ManifestParser parser;
    quickapp::Manifest manifest;

    // ---- 场景 1：参数校验 ----
    CHECK(!parser.parse(nullptr, manifestJson.c_str(), manifest),
          "parse with null engine should fail");
    CHECK(!parser.parse(engine.get(), nullptr, manifest),
          "parse with null json should fail");

    // ---- 场景 2：无效 JSON ----
    quickapp::Manifest bad;
    CHECK(!parser.parse(engine.get(), "{ not valid json", bad),
          "invalid JSON should fail");
    CHECK(parser.getLastError().find("invalid JSON") != std::string::npos,
          "error should mention invalid JSON");

    CHECK(!parser.parse(engine.get(), "[1,2,3]", bad),
          "array root should fail");
    CHECK(!parser.parse(engine.get(), "\"a string\"", bad),
          "string root should fail");

    // ---- 场景 3：缺必填字段 ----
    CHECK(!parser.parse(engine.get(), R"({"name":"x"})", bad),
          "manifest without router should fail");
    CHECK(parser.getLastError().find("router") != std::string::npos,
          "error should mention router");

    CHECK(!parser.parse(engine.get(),
              R"({"router":{"entry":"pages/A","pages":{"pages/A":{}}}})", bad),
          "manifest without package should fail");
    CHECK(parser.getLastError().find("package") != std::string::npos,
          "error should mention package");

    CHECK(!parser.parse(engine.get(),
              R"({"package":"c.x","router":{"pages":{"pages/A":{}}}})", bad),
          "manifest without entry should fail");
    CHECK(parser.getLastError().find("entry") != std::string::npos,
          "error should mention entry");

    // entry 不在 pages 里
    CHECK(!parser.parse(engine.get(),
              R"({"package":"c.x","router":{"entry":"pages/Missing",
                  "pages":{"pages/A":{}}}})", bad),
          "entry not in pages should fail");
    CHECK(parser.getLastError().find("not found in router.pages") != std::string::npos,
          "error should explain entry mismatch");

    // ---- 场景 4：完整解析 ----
    CHECK(parser.parse(engine.get(), manifestJson.c_str(), manifest),
          "parsing valid manifest failed");
    CHECK(parser.getLastError().empty(), "no error expected");

    // 顶层字段
    CHECK(manifest.package == "com.example.testcase", "package wrong");
    CHECK(manifest.name == "测试应用", "name wrong (UTF-8 issue?)");
    CHECK(manifest.versionName == "1.2.3", "versionName wrong");
    CHECK(manifest.versionCode == 7, "versionCode wrong");
    CHECK(manifest.icon == "/assets/logo.png", "icon wrong");
    CHECK(manifest.minPlatformVersion == 1070, "minPlatformVersion wrong");

    // features
    CHECK(manifest.features.size() == 2, "should have 2 features");
    CHECK(manifest.features[0] == "system.router", "first feature wrong");
    CHECK(manifest.features[1] == "system.prompt", "second feature wrong");

    // ---- 场景 5：router 与 bundlePath ----
    CHECK(manifest.entry == "pages/Demo", "entry wrong");
    CHECK(manifest.pages.size() == 3, "should have 3 pages");

    const auto* entryPage = manifest.entryPage();
    CHECK(entryPage != nullptr, "entryPage should be found");
    CHECK(entryPage->name == "pages/Demo", "entry page name wrong");
    CHECK(entryPage->component == "index", "entry component wrong");
    CHECK(entryPage->path == "/pages/Demo", "entry path wrong");
    CHECK(entryPage->bundlePath() == "pages/Demo/index.js",
          "entry bundlePath wrong");

    // component 非 index 的页面
    const auto* noPath = manifest.findPage("pages/NoPath");
    CHECK(noPath != nullptr, "pages/NoPath should be found");
    CHECK(noPath->component == "main", "component should be 'main'");
    CHECK(noPath->bundlePath() == "pages/NoPath/main.js",
          "bundlePath should use custom component name");
    // path 字段缺失时应自动推导
    CHECK(noPath->path == "/pages/NoPath", "path should be derived from name");

    CHECK(manifest.findPage("pages/Nonexistent") == nullptr,
          "unknown page should return nullptr");

    // ---- 场景 6：URI 反查 ----
    const auto* byUri = manifest.findPageByUri("/pages/DemoDetail");
    CHECK(byUri != nullptr, "findPageByUri failed");
    CHECK(byUri->name == "pages/DemoDetail", "URI lookup returned wrong page");
    CHECK(byUri->bundlePath() == "pages/DemoDetail/index.js", "bundlePath wrong");

    // 带 query 的 URI
    const auto* withQuery = manifest.findPageByUri("/pages/Demo?id=42&from=list");
    CHECK(withQuery != nullptr, "URI with query should still match");
    CHECK(withQuery->name == "pages/Demo", "query should be stripped");

    CHECK(manifest.findPageByUri("/pages/Unknown") == nullptr,
          "unknown URI should return nullptr");

    // ---- 场景 7：display 全局配置 ----
    CHECK(manifest.display.titleBarBackgroundColor == "#f2f2f2",
          "global titleBarBackgroundColor wrong");
    CHECK(manifest.display.titleBarTextColor == "#414141",
          "global titleBarTextColor wrong");
    CHECK(manifest.display.menu == true, "global menu should be true");
    CHECK(manifest.display.pages.size() == 2, "should have 2 page display configs");

    // ---- 场景 8：display 合并 ----
    // Demo 页：有 titleBarText 和 menu 覆盖，颜色沿用全局
    const auto demoDisplay = manifest.effectiveDisplay("pages/Demo");
    CHECK(demoDisplay.titleBarText == "快应用示例模版",
          "page titleBarText should override");
    CHECK(demoDisplay.menu == false, "page menu should override to false");
    CHECK(demoDisplay.titleBarBackgroundColor == "#f2f2f2",
          "should inherit global background color");
    CHECK(demoDisplay.titleBarTextColor == "#414141",
          "should inherit global text color");

    // DemoDetail 页：覆盖 titleBarText 和 titleBarTextColor
    const auto detailDisplay = manifest.effectiveDisplay("pages/DemoDetail");
    CHECK(detailDisplay.titleBarText == "详情页", "detail titleBarText wrong");
    CHECK(detailDisplay.titleBarTextColor == "#ff0000",
          "detail should override text color");
    CHECK(detailDisplay.titleBarBackgroundColor == "#f2f2f2",
          "detail should inherit background color");

    // 无专属配置的页面：标题回退为应用名
    const auto fallback = manifest.effectiveDisplay("pages/NoPath");
    CHECK(fallback.titleBarText == "测试应用",
          "page without config should fall back to app name");
    CHECK(fallback.titleBarBackgroundColor == "#f2f2f2",
          "should use global colors");

    engine->destroy();
    return 0;
}

int testEndToEnd(const std::vector<uint8_t>& rpkData) {
    // 模拟真实启动流程的前两步：加载 RPK → 解析 Manifest → 定位入口 bundle
    quickapp::RPKLoader loader;
    CHECK(loader.open(rpkData.data(), rpkData.size()), "open failed");

    std::string manifestJson;
    CHECK(loader.readText("manifest.json", manifestJson), "read manifest failed");

    auto engine = quickapp::createJSEngine();
    CHECK(engine->initialize(), "engine init failed");

    quickapp::ManifestParser parser;
    quickapp::Manifest manifest;
    CHECK(parser.parse(engine.get(), manifestJson.c_str(), manifest),
          "parse manifest failed");

    // 用 manifest 推导出的路径去 RPK 里取入口 bundle
    const auto* entry = manifest.entryPage();
    CHECK(entry != nullptr, "no entry page");

    const std::string bundlePath = entry->bundlePath();
    CHECK(loader.fileExists(bundlePath.c_str()),
          "entry bundle path derived from manifest should exist in RPK");

    std::string bundleCode;
    CHECK(loader.readText(bundlePath.c_str(), bundleCode), "read entry bundle failed");
    CHECK(bundleCode.find("@app-component/Demo") != std::string::npos,
          "entry bundle content wrong");

    // 入口 bundle 应该是合法 JS（这里只验证语法，$app_define$ 未注入所以会运行时报错）
    // 用 JS_Eval 的语法检查能力：先包一层 function 避免执行
    const std::string syntaxCheck = "(function(){ " + bundleCode + " })";
    // 不执行，只解析。eval 一个函数表达式不会调用它。
    const bool syntaxOk = engine->eval(syntaxCheck.c_str(), bundlePath.c_str());
    CHECK(syntaxOk, "entry bundle should be syntactically valid JS");

    std::printf("  end-to-end: %s -> %s (%zu bytes)\n",
                manifest.entry.c_str(), bundlePath.c_str(), bundleCode.size());

    engine->destroy();
    return 0;
}

} // namespace

int main() {
    std::vector<uint8_t> rpkData;
    if (!readFileToMemory(TEST_RPK_PATH, rpkData)) {
        std::fprintf(stderr, "FAIL: cannot read test RPK at %s\n", TEST_RPK_PATH);
        return 1;
    }
    std::printf("  loaded test RPK: %zu bytes\n", rpkData.size());

    if (testRPKLoader(rpkData) != 0) return 1;

    // 单独取一次 manifest 内容给 parser 测试用
    quickapp::RPKLoader loader;
    if (!loader.open(rpkData.data(), rpkData.size())) {
        std::fprintf(stderr, "FAIL: reopen for manifest failed\n");
        return 1;
    }
    std::string manifestJson;
    if (!loader.readText("manifest.json", manifestJson)) {
        std::fprintf(stderr, "FAIL: cannot read manifest.json\n");
        return 1;
    }

    if (testManifestParser(manifestJson) != 0) return 1;
    if (testEndToEnd(rpkData) != 0) return 1;

    std::printf("PASS: all RPKLoader / ManifestParser tests\n");
    return 0;
}
```

---

## Step 8.7：逐层验证

### 8.7.1：编译验证

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-runtime-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build -j4
```

预期：

```text
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/rpk_loader.cpp.o
[ xx%] Building CXX object CMakeFiles/quickapp-core.dir/src/manifest_parser.cpp.o
[ xx%] Generating test RPK archive
-- Generated test RPK: .../build/tests/test.rpk
[100%] Linking CXX executable test_rpk_loader
```

**常见错误：**

```text
"zlib.h: No such file or directory"
    → Step 02 的 find_package(ZLIB) 没生效
    → macOS: brew install zlib，然后 cmake -DZLIB_ROOT=$(brew --prefix zlib)

"undefined reference to inflateInit2_"
    → target_link_libraries 缺 ZLIB::ZLIB

"undefined reference to crc32"
    → 同上。crc32 也在 zlib 里

"TEST_RPK_PATH was not declared"
    → tests/CMakeLists.txt 缺 target_compile_definitions

"Failed to create test RPK"
    → CMake 版本过低，tar --format=zip 需要 CMake 3.18+
```

### 8.7.2：测试运行验证

```bash
cd build && ctest --output-on-failure
```

预期：

```text
1/7 Test #1: test_version .....................   Passed
2/7 Test #2: test_log .........................   Passed
3/7 Test #3: test_js_engine ...................   Passed
4/7 Test #4: test_event_loop ..................   Passed
5/7 Test #5: test_platform_bridge .............   Passed
6/7 Test #6: test_js_bridge ...................   Passed
7/7 Test #7: test_rpk_loader ..................   Passed

100% tests passed, 0 tests failed out of 7
```

直接运行看解析结果：

```bash
./build/tests/test_rpk_loader
```

预期（节选）：

```text
  loaded test RPK: 1832 bytes
[I/quickapp-core] [RPKLoader] opened: 1832 bytes, 6 files
[E/quickapp-core] [RPKLoader] open: data is null
[E/quickapp-core] [RPKLoader] open: EOCD signature not found, not a valid ZIP archive
[W/quickapp-core] [RPKLoader] readBinary: file not found in RPK: does/not/exist.js
[E/quickapp-core] [ManifestParser] parse: invalid JSON - SyntaxError: unexpected token
[E/quickapp-core] [ManifestParser] parse: missing required field 'router'
[E/quickapp-core] [ManifestParser] parse: missing required field 'package'
[E/quickapp-core] [ManifestParser] parse: entry page 'pages/Missing' not found in router.pages
[I/quickapp-core] [ManifestParser] parsed: package=com.example.testcase
                  name=测试应用 version=1.2.3 entry=pages/Demo pages=3 features=2
[I/quickapp-core] [ManifestParser] entry bundle path: pages/Demo/index.js
  end-to-end: pages/Demo -> pages/Demo/index.js (231 bytes)
PASS: all RPKLoader / ManifestParser tests
```

关键几行：
- `opened: 1832 bytes, 6 files` — ZIP 索引成功，目录条目已被过滤
- `name=测试应用` — UTF-8 中文正确解析
- `entry bundle path: pages/Demo/index.js` — entry + component 映射正确
- `end-to-end` — manifest 推导的路径能在 RPK 里找到文件

### 8.7.3：越界读取验证（关键）

手写 ZIP 解析最大的风险是越界读。用 ASan 检查：

```bash
cmake -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_C_FLAGS="-fsanitize=address -fno-omit-frame-pointer" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address"
cmake --build build-asan -j4
ASAN_OPTIONS=detect_leaks=1 ./build-asan/tests/test_rpk_loader
```

预期：`PASS`，无 ASan 报告。

如果出现：

```text
ERROR: AddressSanitizer: heap-buffer-overflow
READ of size 1 at 0x... thread T0
    #0 quickapp::RPKLoader::readU32(unsigned long) const
    #1 quickapp::RPKLoader::parseCentralDirectory(...)
```

说明某处边界检查漏了。代码里有四处必须检查：

```text
1. findEOCD 的搜索范围不能超过 size_
2. parseCentralDirectory 每个条目前检查 offset + kCDEMinSize <= size_
3. 文件名读取前检查 nameOffset + nameLen <= size_
4. extractEntry 检查 dataOffset + compressedSize <= size_
```

### 8.7.4：模糊测试（fuzz）

ZIP 解析器要能扛住任意畸形输入。用随机截断和位翻转验证：

```bash
cat > /tmp/fuzz_rpk.cpp << 'EOF'
// 对有效 RPK 做随机破坏，验证解析器不崩溃
#include <cstdio>
#include <cstdlib>
#include <random>
#include <vector>
#include "rpk_loader.h"

static std::vector<uint8_t> readFile(const char* p) {
    std::FILE* f = std::fopen(p, "rb");
    if (!f) return {};
    std::fseek(f, 0, SEEK_END);
    long n = std::ftell(f);
    std::fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> b(n);
    std::fread(b.data(), 1, n, f);
    std::fclose(f);
    return b;
}

int main(int argc, char** argv) {
    if (argc < 2) return 1;
    const auto original = readFile(argv[1]);
    if (original.empty()) return 1;

    std::mt19937 rng(12345);   // 固定种子，可复现
    int opened = 0, rejected = 0;

    // 1000 轮随机破坏
    for (int round = 0; round < 1000; ++round) {
        auto data = original;

        // 随机截断
        if (round % 3 == 0) {
            std::uniform_int_distribution<size_t> cut(1, data.size());
            data.resize(cut(rng));
        }
        // 随机位翻转
        if (!data.empty()) {
            std::uniform_int_distribution<size_t> pos(0, data.size() - 1);
            const int flips = 1 + (round % 8);
            for (int i = 0; i < flips; ++i) {
                data[pos(rng)] ^= static_cast<uint8_t>(1 << (round % 8));
            }
        }

        quickapp::RPKLoader loader;
        if (loader.open(data.data(), data.size())) {
            ++opened;
            // 打开成功也要尝试读，解压路径同样要扛住畸形数据
            std::string text;
            loader.readText("manifest.json", text);
            loader.readText("pages/Demo/index.js", text);
            for (const auto& f : loader.listFiles()) {
                loader.readText(f.c_str(), text);
            }
        } else {
            ++rejected;
        }
    }

    std::printf("fuzz done: %d opened, %d rejected, no crash\n", opened, rejected);
    return 0;
}
EOF

c++ -std=c++17 -fsanitize=address -g -I include /tmp/fuzz_rpk.cpp \
    build/libquickapp-core.a -lz -o /tmp/fuzz_rpk 2>/dev/null && \
    /tmp/fuzz_rpk build/tests/test.rpk 2>&1 | tail -5
```

预期：

```text
fuzz done: NNN opened, NNN rejected, no crash
```

关键是**没有 ASan 报告，进程正常退出**。部分畸形数据可能"打开成功"（EOCD 恰好完好但内容损坏），此时 CRC 校验会在 `readText` 阶段拦住。

```bash
rm -f /tmp/fuzz_rpk.cpp /tmp/fuzz_rpk
```

### 8.7.5：真实 RPK 验证

用工具链产出的真实包验证，这是最有说服力的检查：

```bash
RPK=/Users/qiaoyang/code/my-github/quickapp-kit/quickapp-examples/quickapp-code-test1/dist/com.example.case1.debug.1.0.0.rpk

cat > /tmp/test_real_rpk.cpp << 'EOF'
#include <cstdio>
#include <vector>
#include "js_engine.h"
#include "manifest_parser.h"
#include "rpk_loader.h"

static std::vector<uint8_t> readFile(const char* p) {
    std::FILE* f = std::fopen(p, "rb");
    if (!f) return {};
    std::fseek(f, 0, SEEK_END); long n = std::ftell(f); std::fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> b(n); std::fread(b.data(), 1, n, f); std::fclose(f);
    return b;
}

int main(int argc, char** argv) {
    if (argc < 2) { std::printf("usage: %s <rpk>\n", argv[0]); return 1; }
    auto data = readFile(argv[1]);
    if (data.empty()) { std::printf("cannot read %s\n", argv[1]); return 1; }

    quickapp::RPKLoader loader;
    if (!loader.open(data.data(), data.size())) {
        std::printf("open failed: %s\n", loader.getLastError().c_str());
        return 1;
    }

    std::printf("\n=== RPK contents (%zu files) ===\n", loader.fileCount());
    for (const auto& f : loader.listFiles()) {
        std::string content;
        const bool ok = loader.readText(f.c_str(), content);
        std::printf("  %-40s %s (%zu bytes)\n", f.c_str(),
                    ok ? "OK" : "FAIL", content.size());
    }

    std::string manifestJson;
    if (!loader.readText("manifest.json", manifestJson)) {
        std::printf("cannot read manifest\n");
        return 1;
    }

    auto engine = quickapp::createJSEngine();
    engine->initialize();

    quickapp::ManifestParser parser;
    quickapp::Manifest m;
    if (!parser.parse(engine.get(), manifestJson.c_str(), m)) {
        std::printf("parse failed: %s\n", parser.getLastError().c_str());
        return 1;
    }

    std::printf("\n=== Manifest ===\n");
    std::printf("  package: %s\n", m.package.c_str());
    std::printf("  name:    %s\n", m.name.c_str());
    std::printf("  version: %s (%d)\n", m.versionName.c_str(), m.versionCode);
    std::printf("  entry:   %s -> %s\n", m.entry.c_str(),
                m.entryPage() ? m.entryPage()->bundlePath().c_str() : "?");
    std::printf("  pages:\n");
    for (const auto& [name, route] : m.pages) {
        const auto d = m.effectiveDisplay(name);
        std::printf("    %-24s uri=%-24s bundle=%-28s title='%s'\n",
                    name.c_str(), route.path.c_str(),
                    route.bundlePath().c_str(), d.titleBarText.c_str());
    }
    std::printf("  features:");
    for (const auto& f : m.features) std::printf(" %s", f.c_str());
    std::printf("\n");

    // 验证每个页面的 bundle 都真实存在
    bool allFound = true;
    for (const auto& [name, route] : m.pages) {
        if (!loader.fileExists(route.bundlePath().c_str())) {
            std::printf("  MISSING bundle: %s\n", route.bundlePath().c_str());
            allFound = false;
        }
    }
    std::printf("\nall page bundles present: %s\n", allFound ? "yes" : "NO");

    engine->destroy();
    return allFound ? 0 : 1;
}
EOF

c++ -std=c++17 -I include /tmp/test_real_rpk.cpp \
    build/libquickapp-core.a build/third_party/quickjs/libquickjs.a \
    -lz -o /tmp/test_real_rpk && /tmp/test_real_rpk "$RPK"
```

预期：

```text
=== RPK contents (5 files) ===
  manifest.json                            OK (892 bytes)
  app.js                                   OK (1543 bytes)
  pages/Demo/index.js                      OK (4821 bytes)
  pages/DemoDetail/index.js                OK (3102 bytes)
  assets/logo.png                          OK (2048 bytes)

=== Manifest ===
  package: com.example.case1
  name:    快应用示例
  version: 1.0.0 (1)
  entry:   pages/Demo -> pages/Demo/index.js
  pages:
    pages/Demo               uri=/pages/Demo          bundle=pages/Demo/index.js
                             title='快应用示例模版'
    pages/DemoDetail         uri=/pages/DemoDetail    bundle=pages/DemoDetail/index.js
                             title='详情页'
  features: system.router system.prompt

all page bundles present: yes
```

每个文件都能解压、manifest 全字段正确、所有页面 bundle 都能通过推导路径找到 —— 这证明实现和真实工具链产物完全兼容。

```bash
rm -f /tmp/test_real_rpk.cpp /tmp/test_real_rpk
```

### 8.7.6：平台无关性回归

```bash
nm build/libquickapp-core.a | grep -E "__android_log_print|objc_msgSend|AAssetManager|_fopen"
```

预期：无输出。

特别注意 `fopen` —— 如果它出现在符号表里，说明 Core 里有代码在做文件 IO，违反了平台无关约束。测试代码里的 `readFileToMemory` 用了 `fopen`，但那在 `tests/` 目录，不进 `libquickapp-core.a`。

---

## 技术决策

### 1. 手写 ZIP 解析替代 minizip

**原因：** 当前网络环境无法访问 GitHub，无法获取 minizip 源码。

**实际收益：**

| 维度 | 手写（约 250 行） | minizip |
|---|---|---|
| 依赖 | 只需 zlib（系统自带） | 额外源码 + 构建配置 |
| 代码量 | 250 行，全部可读 | 约 5000 行 |
| 功能 | 只读 + Store/Deflate | 读写 + 加密 + 分卷 + zip64 |
| 我们需要的 | 只读 + Store/Deflate | — |
| 安全审计 | 250 行可以逐行 review | 依赖上游 |

RPK 场景只需要"从内存读 ZIP，解压单个文件"。minizip 的写入、加密、分卷、zip64 都用不上。手写反而更容易保证边界检查的完备性。

**不支持的能力（明确边界）：**

```text
✗ zip64（单文件 > 4GB 或条目数 > 65535）—— RPK 不会这么大
✗ 加密 ZIP —— 快应用规范不使用
✗ 分卷 —— 不适用
✗ 除 Store/Deflate 外的压缩方法（bzip2/LZMA）—— 工具链不产出
```

遇到不支持的压缩方法时 `extractEntry` 返回 false 并给出方法编号，不会静默出错。

### 2. 从后往前解析（EOCD 优先）

```text
不这样：从头顺序读 Local File Header
    问题：LFH 的 compressedSize 在流式写入模式下可能是 0，
         真实值在数据后面的 Data Descriptor 里。
         某些打包工具（包括部分 Node.js 库）会这么写。

而是：先读 Central Directory
    Central Directory 的字段总是准确的（写入时已知全部信息）。
```

代价是需要搜索 EOCD 签名（因为注释长度可变）。搜索范围限制在末尾 64KB 内，成本可忽略。

### 3. 懒解压

```cpp
bool open(...) {
    // 只建立索引：文件名 → 偏移/大小/CRC
    // 不解压任何数据
}
bool readText(path, out) {
    // 此时才解压
}
```

一个 RPK 可能有几十个文件，但启动时只需要 `manifest.json`、`app.js` 和入口页 bundle 三个。全部预解压会浪费时间和内存（assets 里的图片可能几 MB）。

代价是每次 `readText` 同一文件都重新解压。如果将来有热点文件反复读取，可以加 LRU 缓存。当前场景每个 bundle 只读一次，不需要。

### 4. 不拷贝输入数据

```cpp
const uint8_t* data_ = nullptr;   // 指向外部数据，不拥有
size_t size_ = 0;
```

RPK 可能几 MB。如果 `open()` 内部拷贝一份，内存占用翻倍。

约定写在头文件注释里：调用方必须保证数据在 Loader 使用期间有效。平台层的典型做法是把字节数组作为成员变量持有，生命周期覆盖整个 Runtime。

### 5. 设置解压大小上限

```cpp
constexpr uint32_t kMaxUncompressedSize = 32 * 1024 * 1024;
```

防 zip bomb：恶意 RPK 可以声明 `uncompressedSize = 0xFFFFFFFF`，我们 `out.resize()` 会瞬间尝试分配 4GB。

超限的条目在索引阶段就被跳过并记警告，不会进入 `entries_`，后续 `readText` 会返回"文件不存在"。

### 6. CRC 校验开启

```cpp
const uLong actual = crc32(0L, out.data(), out.size());
if (actual != entry.crc32) { /* 失败 */ }
```

成本：一次遍历解压后的数据，约 1GB/s，对 100KB 的 bundle 是 0.1ms。

收益：能发现三类问题：
```text
1. RPK 传输/存储损坏
2. 我们自己的偏移计算错误（数据读错位置）
3. 恶意篡改（不是安全边界，但能提高门槛）
```

`crc32 == 0` 时跳过校验，因为某些工具对空文件不写 CRC。

### 7. 复用 QuickJS 的 JSON 解析

```cpp
JSValue root = JS_ParseJSON(ctx, json, strlen(json), "manifest.json");
```

对比引入 cJSON：

| 维度 | QuickJS JSON | cJSON |
|---|---|---|
| 新增依赖 | 0 | 1 个库（约 3000 行） |
| 二进制体积 | 0 | 约 30KB |
| 正确性 | 经过 ES 规范测试套件验证 | 需自行验证 |
| 错误信息 | 带位置的 SyntaxError | 只有失败指针 |
| UTF-8 处理 | 完整支持 | 需注意 |
| 代价 | 必须先有 JSEngine | 独立可用 |

唯一代价是 `ManifestParser::parse` 需要传入 `JSEngine*`。而启动流程里 JSEngine 本来就先于 Manifest 解析创建，不构成额外约束。

### 8. entry → bundlePath 的映射封装在 PageRoute

```cpp
std::string bundlePath() const {
    return name + "/" + (component.empty() ? "index" : component) + ".js";
}
```

不把这个拼接逻辑散落在调用方，原因：

```text
1. 规则有默认值处理（component 缺省为 "index"）
2. 将来规范可能变化（比如支持 .mjs 后缀）
3. 调用方分布在 RuntimeBootstrap 和 RouterModule 两处
```

集中在一处，改动范围可控。

### 9. display 配置的三层合并

```text
第 1 层：结构体默认值（#f2f2f2 / #414141 / menu=true）
第 2 层：manifest.display 的全局配置
第 3 层：manifest.display.pages[pageName] 的页面级覆盖
```

`effectiveDisplay()` 负责合并，调用方（TitleBar 渲染）只需一次调用拿到最终结果。

字符串字段用"非空才覆盖"判断，bool 字段用"JSON 里存在该键才写入"判断（`getBool` 返回值区分了这两种情况）。这样能区分"未设置"和"显式设为 false"。

---

## QA

### 1. 为什么 Core 不直接读文件

三端的文件访问方式完全不同：

```text
Android  AssetManager（RPK 在 APK 里，不是普通文件路径）
iOS      NSBundle / Documents 目录，需要沙箱路径
LVGL     可能从 SPI Flash、SD 卡、甚至编译期烧进固件的数组
```

如果 Core 用 `fopen`，Android 的 assets 根本没有文件系统路径（它在 APK 的 ZIP 里），必须先拷贝到 cache 目录，多一次 IO 和磁盘占用。

只接收 `const uint8_t*` 让三端各用最自然的方式读取，Core 完全不参与。8.7.6 的 `nm | grep _fopen` 就是在守护这条约束。

### 2. 为什么跳过目录条目

ZIP 里的目录是独立条目，特征是名字以 `/` 结尾、大小为 0：

```text
pages/                    ← 目录条目
pages/Demo/               ← 目录条目
pages/Demo/index.js       ← 文件条目
```

我们按完整路径索引文件，不需要目录结构。索引目录条目会带来两个问题：

```text
1. fileExists("pages/") 返回 true，语义混乱
2. readText("pages/") 返回空字符串而不是失败
```

测试里的 `CHECK(!loader.fileExists("pages/"), ...)` 验证了这一点。

### 3. `windowBits` 为什么传 -15

zlib 的 `inflateInit2(strm, windowBits)` 用参数符号区分格式：

```text
 15      zlib 格式（有 2 字节头 0x78 0x9C + 4 字节 Adler32 尾）
 31      gzip 格式（有 10 字节头 0x1F 0x8B ...）
-15      raw deflate（无头无尾，纯压缩数据）
```

ZIP 存的是 raw deflate —— 头部信息（CRC、大小）已经在 Local File Header 里了，不需要重复。传 15 会因为找不到 zlib 头而返回 `Z_DATA_ERROR`。

`MAX_WBITS` 就是 15，所以写 `-MAX_WBITS` 比写 `-15` 更清楚表达"取最大窗口的 raw 模式"。

### 4. 为什么 LFH 的文件名长度要重新读

```cpp
// 不复用 Central Directory 里的 nameLen
const uint16_t nameLen  = readU16(lfhOffset + 26);
const uint16_t extraLen = readU16(lfhOffset + 28);
```

文件名长度通常一致，但**扩展字段长度经常不同**。Central Directory 的扩展字段可能包含 NTFS 时间戳、Unix UID/GID，而 Local File Header 的扩展字段可能只有 Zip64 占位或者干脆为空。

用 Central Directory 的 `extraLen` 去算数据偏移，会算错位置，解压出垃圾数据。CRC 校验能发现这个错误，但直接从 LFH 读是正确做法。

### 5. `mutable std::string lastError_` 的作用

```cpp
mutable std::string lastError_;

bool readText(const char* path, std::string& out) const {   // const 方法
    lastError_ = "...";   // 需要修改成员
}
```

`readText` 逻辑上不改变 Loader 的状态（只是读取），所以标 `const`。但失败时要记录原因。`mutable` 让这个字段可以在 `const` 方法里修改。

替代方案是让 `readText` 非 const，但那样调用方持有 `const RPKLoader&` 时就没法读文件了，不合理。

### 6. Manifest 解析失败时 out 参数的状态

```cpp
bool parse(JSEngine*, const char* json, Manifest& out);
// 失败时 out 的内容不确定
```

因为解析是逐字段进行的，失败可能发生在中途（比如顶层字段读完了，但 `router` 缺失）。此时 `out` 里有部分数据。

约定写在头文件注释里：**返回 false 时不要使用 out**。调用方应该：

```cpp
Manifest manifest;
if (!parser.parse(engine, json, manifest)) {
    QA_LOGE("manifest error: %s", parser.getLastError().c_str());
    return false;   // 不碰 manifest
}
// 只在成功后使用
```

要做到"失败时 out 完全不变"需要先解析到临时对象再 swap，多一次拷贝。当前约定成本更低。

### 7. `findPageByUri` 为什么有回退逻辑

```cpp
// 先按 path 精确匹配
for (const auto& [name, route] : pages) {
    if (route.path == cleanUri) return &route;
}
// 回退：去掉前导斜杠当页面标识
if (cleanUri.front() == '/') return findPage(cleanUri.substr(1));
```

因为 `manifest.json` 的 `router.pages[x].path` 字段不是所有工具链版本都生成。缺失时我们在解析阶段按 `"/" + name` 推导，但如果 JS 侧传来的 URI 格式略有差异（比如带尾部斜杠），精确匹配会失败。

回退逻辑让 `router.push({uri: "/pages/Demo"})` 在两种情况下都能工作。这是"V1 兼容优先"的具体体现——宁可多一条容错路径，也不要让现有 RPK 跑不起来。

### 8. 测试为什么用 CMake 生成 RPK 而不是提交二进制

```text
提交 .rpk 二进制的问题：
1. 无法 code review —— 改了什么内容看不出来
2. 修改测试数据要重新打包，容易忘记
3. 仓库体积增长（虽然只有几 KB）

CMake 生成的好处：
1. manifest.json 内容以文本形式在 make_test_rpk.cmake 里，可 review
2. 测试代码和测试数据同步修改
3. 用 cmake -E tar --format=zip，无需外部 zip 命令，跨平台
```

代价是每次 clean build 要重新生成（约 0.1 秒）。

### 9. 真实 RPK 里的 assets 图片能读吗

能，`readBinary` 支持任意二进制内容：

```cpp
std::vector<uint8_t> pngData;
loader.readBinary("assets/logo.png", pngData);
```

8.7.5 的验证里 `assets/logo.png` 读取成功（显示 OK 和字节数）。

但 Core 不解析图片格式。图片数据最终要通过某种方式交给平台层显示，这需要 `PlatformBridge` 增加一个传二进制的函数（比如 `setImageData(id, data, size)`）。V1 的组件范围只有 div/text/input，没有 image，所以还没做。

### 10. Step 08 完成后得到了什么

Core 能消费真实的快应用包了：

```text
✓ include/rpk_loader.h + src/rpk_loader.cpp        约 250 行手写 ZIP 解析
✓ include/manifest_parser.h + src/manifest_parser.cpp  Manifest 模型 + QuickJS JSON
✓ tests/make_test_rpk.cmake                        构建期生成测试包
✓ tests/test_rpk_loader.cpp                        3 组共 21 个场景全部通过
✓ ASan 验证无越界读、无泄漏
✓ 1000 轮 fuzz（随机截断 + 位翻转）无崩溃
✓ 真实工具链 RPK 验证：5 个文件全部解压成功，manifest 全字段正确
✓ 所有页面 bundle 都能通过 entry + component 推导路径找到
```

数据加载链路完成：

```text
平台读文件 → uint8_t* → RPKLoader.open()
    → readText("manifest.json") → ManifestParser.parse() → Manifest
    → manifest.entryPage()->bundlePath() → readText() → 入口 bundle 源码
```

下一步把这份源码交给 JS 引擎执行，并把 `__native_render__` 的输出变成真正的渲染命令。

---

## 下一步

按 `tasks.md` 进入 Step 09：实现 `VNode`（虚拟节点树）、`StyleResolver`（classList → 样式合并）和 `LayoutEngine`（Flex 布局计算），把 `__native_render__` 收到的 JS 模板对象转换为带像素坐标的渲染命令。
