# Step 9：RPK Packager

## 目录

- [目标](#目标)
- [Step 9.1：ZIP 格式结构](#step-91zip-格式结构)
- [Step 9.2：实现 ZIP 写入器](#step-92实现-zip-写入器)
- [Step 9.3：实现 build.txt 生成](#step-93实现-buildtxt-生成)
- [Step 9.4：实现打包入口](#step-94实现打包入口)
- [Step 9.5：接入 build 管线](#step-95接入-build-管线)
- [Step 9.6：单元测试](#step-96单元测试)
- [Step 9.7：逐层验证](#step-97逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**把编译产物打包为标准 RPK（ZIP），原子写入 dist 目录。**

| 输入 | 输出 |
|---|---|
| manifest 对象 + bundles Map + assets Map | `dist/<package>.<mode>.<version>.rpk` |

**验收标准：**
- 产物能被 `unzip -l` 正常列出
- 产物能被 Android 的 `RPKLoader`（手写 ZIP 解析器）正确解析
- 条目路径无前导 `/`、无 `./`、使用正斜杠
- JS/JSON 用 DEFLATE，二进制用 STORE
- 编译中途中断时 `dist/` 下不出现损坏的 `.rpk`
- 生成 `META-INF/build.txt`，含各文件 SHA256

**本步不包含：**
- 签名生成（`META-INF/CERT`，V1 不实现）
- Release 压缩（Step 10）
- 增量打包（Step 12）

---

## Step 9.1：ZIP 格式结构

Runtime 侧的 `rpk_loader.cpp` 是手写的 ZIP 解析器。写入器必须产出它能解析的格式。回顾它的解析逻辑：

```cpp
// 1. 从文件末尾倒扫，找 End of Central Directory 签名 0x06054b50
// 2. 从 EOCD 读 numEntries（偏移 10）和 cdOffset（偏移 16）
// 3. 遍历 Central Directory，每项签名 0x02014b50
//    读 compressionMethod(10)、compressedSize(20)、uncompressedSize(24)
//    读 nameLen(28)、extraLen(30)、commentLen(32)、localHeaderOffset(42)
//    读文件名（偏移 46 起，nameLen 字节）
// 4. 读某条目时跳到 localHeaderOffset，验证签名 0x04034b50
//    读 nameLen(26)、extraLen(28)，数据从 lhOff + 30 + nameLen + extraLen 开始
// 5. method == 0 直接拷贝；method == 8 用 inflateInit2(-MAX_WBITS) 解压
```

这确定了写入器必须产出的三种结构。

**Local File Header（每个条目一份，紧跟压缩数据）：**

```text
偏移  长度  内容
0     4     签名 0x04034b50
4     2     版本需求（20 = 2.0）
6     2     通用标志位（0）
8     2     压缩方法（0 = STORE，8 = DEFLATE）
10    2     修改时间（DOS 格式）
12    2     修改日期（DOS 格式）
14    4     CRC-32
18    4     压缩后大小
22    4     压缩前大小
26    2     文件名长度
28    2     扩展字段长度（0）
30    n     文件名（UTF-8）
30+n  m     压缩数据
```

**Central Directory Header（每个条目一份，全部集中在文件尾部）：**

```text
偏移  长度  内容
0     4     签名 0x02014b50
4     2     创建版本（20）
6     2     版本需求（20）
8     2     通用标志位（0）
10    2     压缩方法
12    2     修改时间
14    2     修改日期
16    4     CRC-32
20    4     压缩后大小
24    4     压缩前大小
28    2     文件名长度
30    2     扩展字段长度（0）
32    2     注释长度（0）
34    2     磁盘号（0）
36    2     内部属性（0）
38    4     外部属性（0）
42    4     Local File Header 偏移
46    n     文件名
```

**End of Central Directory（整个文件一份，最末尾）：**

```text
偏移  长度  内容
0     4     签名 0x06054b50
4     2     当前磁盘号（0）
6     2     Central Directory 起始磁盘号（0）
8     2     本磁盘条目数
10    2     总条目数
12    4     Central Directory 总大小
16    4     Central Directory 起始偏移
20    2     注释长度（0）
```

三个签名值容易记混，写错的后果是 `RPKLoader` 找不到结构直接返回失败：

```text
0x04034b50  Local File Header  ("PK\x03\x04")
0x02014b50  Central Directory  ("PK\x01\x02")
0x06054b50  End of Central Dir ("PK\x05\x06")
```

全部小端序（little-endian）。

---

## Step 9.2：实现 ZIP 写入器

```text
@add quickapp-toolkit/src/packager/zip-writer.ts（新建文件）
```

```typescript
import * as zlib from 'node:zlib';

/** Local File Header 签名 "PK\x03\x04" */
const SIG_LOCAL_FILE = 0x04034b50;
/** Central Directory Header 签名 "PK\x01\x02" */
const SIG_CENTRAL_DIR = 0x02014b50;
/** End of Central Directory 签名 "PK\x05\x06" */
const SIG_END_OF_CD = 0x06054b50;

/** ZIP 版本 2.0，支持 DEFLATE */
const VERSION = 20;

/** 压缩方法 */
export const enum CompressionMethod {
  Store = 0,
  Deflate = 8,
}

/**
 * CRC-32 查表，首次使用时惰性构建。
 *
 * ZIP 用的是标准 CRC-32（多项式 0xEDB88320，反射）。
 * Node 没有内置 CRC-32，zlib.crc32 在 Node 20.15+ 才有 ——
 * 为兼容 Node 18 自己实现。
 */
let crcTable: Int32Array | null = null;

/**
 * 构建 CRC-32 查表。
 * @returns 256 项查表
 */
function buildCrcTable(): Int32Array {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

/**
 * 计算 CRC-32。
 *
 * ZIP 用它做条目完整性校验。Runtime 侧的 RPKLoader 当前不校验 CRC，
 * 但 unzip、Android 的 ZipFile 等标准工具会校验 —— 写错会导致
 * "invalid compressed data" 错误。
 *
 * @param buf 数据
 * @returns 无符号 32 位 CRC 值
 */
export function crc32(buf: Buffer): number {
  if (crcTable === null) crcTable = buildCrcTable();
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * 把 JS Date 转为 DOS 时间日期格式。
 *
 * DOS 格式的年份基准是 1980，秒精度为 2 秒。1980 年之前的日期
 * 无法表示 —— 用固定时间戳可以让产物字节可复现（见技术决策）。
 *
 * @param date 时间
 * @returns [time, date] 两个 16 位值
 */
function toDosDateTime(date: Date): [number, number] {
  const year = date.getFullYear();
  // 1980 之前钳制到 1980-01-01
  if (year < 1980) return [0, (1 << 5) | 1];

  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return [time & 0xffff, dosDate & 0xffff];
}

/** 待写入的条目 */
interface PendingEntry {
  /** ZIP 内路径，已规范化 */
  name: string;
  /** 原始数据 */
  data: Buffer;
  method: CompressionMethod;
}

/** 已写入条目的元信息，用于生成 Central Directory */
interface WrittenEntry {
  name: string;
  method: CompressionMethod;
  crc: number;
  compressedSize: number
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * 规范化 ZIP 条目路径。
 *
 * ZIP 规范要求：正斜杠分隔、无前导斜杠、无 "./" 前缀。
 * Runtime 侧按精确字符串匹配查找条目（entry.name == entryPath），
 * 路径形式不一致会导致"文件明明在包里却读不到"。
 *
 * @param path 原始路径
 * @returns 规范化路径
 */
export function normalizeEntryPath(path: string): string {
  return path
    .split(/[\\/]+/)          // 统一分隔符并合并连续斜杠
    .filter((seg) => seg !== '' && seg !== '.')
    .join('/');
}

/**
 * ZIP 文件写入器。
 *
 * 手写而非用 archiver：Runtime 侧的解析器也是手写的，两侧都手写
 * 能保证对格式的理解一致。archiver 可能设置某些标志位（如
 * data descriptor、UTF-8 flag）导致手写解析器失败，而那类问题
 * 的现象是"标准工具能解压，我们的 Runtime 读不到"。
 *
 * 全部数据在内存中累积，最后一次性输出。RPK 通常几十 KB，
 * 不需要流式写入。
 */
export class ZipWriter {
  private entries: PendingEntry[] = [];
  /** 固定时间戳，保证产物字节可复现 */
  private readonly timestamp: Date;

  /**
   * @param timestamp 条目时间戳；默认固定为 1980-01-01 以保证可复现构建
   */
  constructor(timestamp: Date = new Date(1980, 0, 1, 0, 0, 0)) {
    this.timestamp = timestamp;
  }

  /**
   * 添加一个条目。
   *
   * @param path   ZIP 内路径，会被规范化
   * @param data   数据；字符串按 UTF-8 编码
   * @param method 压缩方法
   * @throws Error 路径规范化后为空，或路径重复
   */
  add(
    path: string,
    data: Buffer | string,
    method: CompressionMethod = CompressionMethod.Deflate
  ): void {
    const name = normalizeEntryPath(path);
    if (name === '') {
      throw new Error(`无效的 ZIP 条目路径："${path}"`);
    }
    if (this.entries.some((e) => e.name === name)) {
      throw new Error(`重复的 ZIP 条目路径："${name}"`);
    }

    this.entries.push({
      name,
      data: typeof data === 'string' ? Buffer.from(data, 'utf8') : data,
      method,
    });
  }

  /** 已添加的条目数 */
  get size(): number {
    return this.entries.length;
  }

  /**
   * 生成完整的 ZIP 文件内容。
   *
   * @returns ZIP 字节流
   */
  build(): Buffer {
    const [dosTime, dosDate] = toDosDateTime(this.timestamp);

    const chunks: Buffer[] = [];
    const written: WrittenEntry[] = [];
    let offset = 0;

    // ---- 阶段 1：Local File Header + 压缩数据 ----
    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, 'utf8');
      const crc = crc32(entry.data);

      // DEFLATE 用 raw 模式（无 zlib 头尾）。
      // Runtime 侧用 inflateInit2(&strm, -MAX_WBITS) 解压，
      // 负 windowBits 表示 raw deflate —— 如果这里用 deflateSync
      // （带 zlib 头），解压会失败
      const compressed =
        entry.method === CompressionMethod.Deflate
          ? zlib.deflateRawSync(entry.data)
          : entry.data;

      const header = Buffer.alloc(30);
      header.writeUInt32LE(SIG_LOCAL_FILE, 0);
      header.writeUInt16LE(VERSION, 4);
      header.writeUInt16LE(0, 6);                    // 标志位
      header.writeUInt16LE(entry.method, 8);
      header.writeUInt16LE(dosTime, 10);
      header.writeUInt16LE(dosDate, 12);
      header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(compressed.length, 18);
      header.writeUInt32LE(entry.data.length, 22);
      header.writeUInt16LE(nameBuf.length, 26);
      header.writeUInt16LE(0, 28);                   // 扩展字段长度

      chunks.push(header, nameBuf, compressed);

      written.push({
        name: entry.name,
        method: entry.method,
        crc,
        compressedSize: compressed.length,
        uncompressedSize: entry.data.length,
        localHeaderOffset: offset,
      });

      offset += 30 + nameBuf.length + compressed.length;
    }

    // ---- 阶段 2：Central Directory ----
    const cdOffset = offset;
    let cdSize = 0;

    for (const e of written) {
      const nameBuf = Buffer.from(e.name, 'utf8');
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(SIG_CENTRAL_DIR, 0);
      cd.writeUInt16LE(VERSION, 4);                  // 创建版本
      cd.writeUInt16LE(VERSION, 6);                  // 需求版本
      cd.writeUInt16LE(0, 8);                        // 标志位
      cd.writeUInt16LE(e.method, 10);
      cd.writeUInt16LE(dosTime, 12);
      cd.writeUInt16LE(dosDate, 14);
      cd.writeUInt32LE(e.crc, 16);
      cd.writeUInt32LE(e.compressedSize, 20);
      cd.writeUInt32LE(e.uncompressedSize, 24);
      cd.writeUInt16LE(nameBuf.length, 28);
      cd.writeUInt16LE(0, 30);                       // 扩展字段
      cd.writeUInt16LE(0, 32);                       // 注释
      cd.writeUInt16LE(0, 34);                       // 磁盘号
      cd.writeUInt16LE(0, 36);                       // 内部属性
      cd.writeUInt32LE(0, 38);                       // 外部属性
      cd.writeUInt32LE(e.localHeaderOffset, 42);

      chunks.push(cd, nameBuf);
      cdSize += 46 + nameBuf.length;
    }

    // ---- 阶段 3：End of Central Directory ----
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(SIG_END_OF_CD, 0);
    eocd.writeUInt16LE(0, 4);                        // 当前磁盘
    eocd.writeUInt16LE(0, 6);                        // CD 起始磁盘
    eocd.writeUInt16LE(written.length, 8);           // 本磁盘条目数
    eocd.writeUInt16LE(written.length, 10);          // 总条目数
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdOffset, 16);
    eocd.writeUInt16LE(0, 20);                       // 注释长度

    chunks.push(eocd);

    return Buffer.concat(chunks);
  }
}
```

两个易错点值得强调。

**`deflateRawSync` 而非 `deflateSync`。** 后者会加 zlib 头尾（2 字节头 + 4 字节 Adler-32），而 ZIP 的 method 8 要求 raw deflate。Runtime 侧用 `inflateInit2(&strm, -MAX_WBITS)`，负 windowBits 表示 raw 模式——如果写入端加了 zlib 头，`inflate` 会返回 `Z_DATA_ERROR`。

**CRC-32 必须正确。** Runtime 侧的 `RPKLoader` 不校验 CRC，所以写错也能被它读出来。但 `unzip -t`、Android 的 `ZipFile`、以及任何标准 ZIP 工具都会校验。写错的后果是「我们的 Runtime 能读，但 `unzip` 报 CRC 错误」——这会让人怀疑 Runtime 而不是打包器。

---

## Step 9.3：实现 build.txt 生成

回顾官方 RPK 里的 `META-INF/build.txt`：

```text
originType=quickapp-ide
toolkit=2.1.0
timeStamp=2026-07-25T15:51:37.256Z
node=v22.17.0
platform=darwin
arch=arm64
widget:CardDemo=22a01e867a68dca883b45be28b12d7c658c88846838e40783b2a445385f2bee4
app:app=680fb233f571737fa82f6abfe16b4d7c79c40bc5004d807e1b1c3e620309ff5c
```

格式是 `key=value` 每行一条。前六行是构建环境，后面是各 bundle 的 SHA256——用于增量更新时比对哪些文件变了。

```text
@add quickapp-toolkit/src/packager/build-info.ts（新建文件）
```

```typescript
import * as crypto from 'node:crypto';

/**
 * 计算 SHA256 十六进制摘要。
 *
 * 用于 build.txt 中的文件 hash。Runtime 或更新服务可据此判断
 * 某个 bundle 是否变化，实现增量下发。
 *
 * @param data 数据
 * @returns 小写十六进制摘要（64 字符）
 */
export function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** build.txt 生成参数 */
export interface BuildInfoOptions {
  /** toolkit 版本 */
  toolkitVersion: string;
  /** 构建时间；固定值可保证产物可复现 */
  timestamp: Date;
  /** 产物路径 -> 内容，用于计算 hash */
  bundles: Map<string, string>;
}

/**
 * 把 RPK 内的 bundle 路径转为 build.txt 的 key。
 *
 * 官方格式：
 *   app.js                  -> app:app
 *   pages/Demo/index.js     -> page:pages/Demo
 *   CardDemo/index.js       -> widget:CardDemo
 *
 * @param outputPath RPK 内路径
 * @returns build.txt 的 key
 */
function toBuildKey(outputPath: string): string {
  if (outputPath === 'app.js') return 'app:app';

  // pages/Demo/index.js -> page:pages/Demo
  const match = /^(pages\/[^/]+)\/[^/]+\.js$/.exec(outputPath);
  if (match) return `page:${match[1]}`;

  // 其他 .js 视为 widget（V1 不产出 widget，保留格式兼容）
  const widgetMatch = /^([^/]+)\/[^/]+\.js$/.exec(outputPath);
  if (widgetMatch) return `widget:${widgetMatch[1]}`;

  return outputPath;
}

/**
 * 生成 META-INF/build.txt 内容。
 *
 * 不生成 META-INF/CERT：V1 不做签名。Runtime 侧当前跳过签名校验
 * （见 Android tasks.md Task 2.1），缺少 CERT 不影响加载。
 *
 * @param options 生成参数
 * @returns build.txt 文本内容
 */
export function generateBuildInfo(options: BuildInfoOptions): string {
  const lines: string[] = [
    'originType=quickapp-toolkit',
    `toolkit=${options.toolkitVersion}`,
    `timeStamp=${options.timestamp.toISOString()}`,
    `node=${process.version}`,
    `platform=${process.platform}`,
    `arch=${process.arch}`,
  ];

  // hash 行按 key 排序，保证同一份源码产出的 build.txt 字节一致
  const hashLines: string[] = [];
  for (const [outputPath, content] of options.bundles) {
    hashLines.push(`${toBuildKey(outputPath)}=${sha256(content)}`);
  }
  hashLines.sort();

  return [...lines, ...hashLines].join('\n') + '\n';
}
```

hash 行排序的理由：`Map` 的迭代顺序是插入顺序，而插入顺序取决于 `manifest.router.pages` 的声明顺序。如果开发者调整了 manifest 里页面的顺序（但内容不变），`build.txt` 的字节会变，导致 RPK 的 diff 显示变化。排序消除这个噪音。

---

## Step 9.4：实现打包入口

```text
@add quickapp-toolkit/src/packager/rpk-packager.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BuildContext } from '../types';
import type { Manifest } from '../manifest/schema';
import { PackageError } from '../diagnostics/errors';
import { ZipWriter, CompressionMethod } from './zip-writer';
import { generateBuildInfo } from './build-info';

/**
 * 应使用 STORE（不压缩）的文件扩展名。
 *
 * 这些格式内部已压缩，DEFLATE 通常让体积略微增大，且浪费
 * 打包和解压时间。
 */
const STORE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico',
  '.mp3', '.mp4', '.ogg', '.wav', '.webm',
  '.woff', '.woff2', '.ttf', '.otf',
  '.zip', '.gz', '.br',
]);

/**
 * 应从 assets 中排除的文件名。
 *
 * 系统生成的元数据文件，进入 RPK 无用且会让不同开发机产出的
 * 包不一致。
 */
const EXCLUDED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/**
 * 根据扩展名选择压缩方法。
 * @param entryPath RPK 内路径
 * @returns 压缩方法
 */
function pickMethod(entryPath: string): CompressionMethod {
  const ext = path.extname(entryPath).toLowerCase();
  return STORE_EXTENSIONS.has(ext)
    ? CompressionMethod.Store
    : CompressionMethod.Deflate;
}

/** 打包参数 */
export interface PackOptions {
  ctx: BuildContext;
  manifest: Manifest;
  /** RPK 内路径 -> bundle 代码 */
  bundles: Map<string, string>;
  /** RPK 内路径 -> 源文件绝对路径 */
  assets: Map<string, string>;
  /** toolkit 版本 */
  toolkitVersion: string;
}

/** 打包结果 */
export interface PackResult {
  /** 生成的 .rpk 绝对路径 */
  rpkPath: string;
  /** 文件字节数 */
  size: number;
  /** 条目数 */
  entryCount: number;
  /** 被排除的资源文件列表（RPK 内路径） */
  excluded: string[];
}

/**
 * 生成 RPK 文件名。
 *
 * 格式：<package>.<mode>.<versionName>.rpk
 * 与官方一致：com.example.case1.debug.1.0.0.rpk
 *
 * @param manifest 已处理的 manifest
 * @param mode     构建模式
 * @returns 文件名
 */
export function rpkFileName(manifest: Manifest, mode: string): string {
  return `${manifest.package}.${mode}.${manifest.versionName}.rpk`;
}

/**
 * 把编译产物打包为 RPK。
 *
 * 采用原子写入：先写 dist/.tmp/<name>.rpk，全部内容写入成功后
 * rename 到最终路径。这保证 Property 8 —— 编译中断或磁盘写入
 * 失败时，dist/ 下不会留下损坏的 .rpk。损坏包在 Runtime 侧表现为
 * ZIP 解析错误，排查方向会被误导到 Runtime。
 *
 * @param options 打包参数
 * @returns 打包结果
 * @throws PackageError 磁盘写入失败或 ZIP 构建失败
 */
export function packRPK(options: PackOptions): PackResult {
  const { ctx, manifest, bundles, assets, toolkitVersion } = options;

  const zip = new ZipWriter();
  const excluded: string[] = [];

  // ---- 条目 1：manifest.json ----
  // 放在最前：Runtime 通常先读它，靠前能利用顺序读取的局部性。
  // 缩进 2 空格便于人工检视解压后的内容
  zip.add('manifest.json', JSON.stringify(manifest, null, 2));

  // ---- 条目 2：bundles ----
  for (const [entryPath, code] of bundles) {
    zip.add(entryPath, code, CompressionMethod.Deflate);
  }

  // ---- 条目 3：assets ----
  for (const [entryPath, sourcePath] of assets) {
    const basename = path.basename(entryPath);
    if (EXCLUDED_NAMES.has(basename)) {
      excluded.push(entryPath);
      continue;
    }

    let data: Buffer;
    try {
      data = fs.readFileSync(sourcePath);
    } catch (e) {
      throw new PackageError(
        `无法读取资源文件：${(e as Error).message}`,
        sourcePath
      );
    }

    zip.add(entryPath, data, pickMethod(entryPath));
  }

  // ---- 条目 4：META-INF/build.txt ----
  zip.add(
    'META-INF/build.txt',
    generateBuildInfo({
      toolkitVersion,
      // 用固定时间戳而非 new Date()：保证同一份源码产出字节一致的 RPK。
      // 真实构建时间对 Runtime 无意义，而可复现构建对 CI 缓存和
      // diff 比对有实际价值
      timestamp: new Date(0),
      bundles,
    })
  );

  // ---- 构建并原子写入 ----
  let content: Buffer;
  try {
    content = zip.build();
  } catch (e) {
    throw new PackageError(`ZIP 构建失败：${(e as Error).message}`, ctx.distDir);
  }

  const fileName = rpkFileName(manifest, ctx.mode);
  const finalPath = path.join(ctx.distDir, fileName);
  const tmpDir = path.join(ctx.distDir, '.tmp');
  const tmpPath = path.join(tmpDir, `${fileName}.${process.pid}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpPath, content);
    // rename 在同一文件系统内是原子操作：
    // 要么旧文件仍在，要么新文件完整可用，不存在中间状态
    fs.renameSync(tmpPath, finalPath);
  } catch (e) {
    // 清理临时文件，避免 .tmp 目录堆积
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // 临时文件可能未创建成功，忽略
    }
    throw new PackageError(
      `写入 RPK 失败：${(e as Error).message}`,
      finalPath
    );
  }

  return {
    rpkPath: finalPath,
    size: content.length,
    entryCount: zip.size,
    excluded,
  };
}
```

`new Date(0)` 作为 build.txt 的时间戳需要解释。用真实构建时间会让同一份源码每次构建产出不同字节的 RPK，破坏可复现构建。这影响两件事：CI 无法用产物 hash 做缓存判断；两次构建的 diff 全是噪音，看不出真实变更。

真实构建时间对 Runtime 没有用途——它既不做时间校验也不显示这个值。可复现性的价值更高。

如果确实需要记录构建时间，应该放在 CI 的元数据里，而不是产物内部。

---

## Step 9.5：接入 build 管线

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 在 import 段末尾追加
```

```typescript
import { packRPK, rpkFileName } from '../packager/rpk-packager';
```

```text
@update quickapp-toolkit/src/cli/cmd-build.ts — 替换 hasError 检查之后的结尾段
```

```typescript
  const hasError = reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
  if (hasError) {
    console.error('存在错误，未产出 RPK');
    return 1;
  }

  // ---- Step 9：RPK 打包 ----
  const assetMap = new Map<string, string>();
  for (const asset of tree.assets) {
    assetMap.set(asset.outputPath, asset.sourcePath);
  }

  let result;
  try {
    fs.mkdirSync(ctx.distDir, { recursive: true });
    result = packRPK({
      ctx,
      manifest,
      bundles,
      assets: assetMap,
      toolkitVersion: PACKAGER_VERSION,
    });
  } catch (e) {
    if (e instanceof CompileError) {
      ctx.diagnostics.push(fromError(e));
      reportDiagnostics(ctx.diagnostics, ctx.projectRoot);
      return 1;
    }
    throw e;
  }

  if (result.excluded.length > 0) {
    console.log(`已排除系统文件（${result.excluded.length}）：`);
    for (const p of result.excluded) console.log(`  ${p}`);
    console.log('');
  }

  console.log('产物：');
  console.log(`  ${path.relative(ctx.projectRoot, result.rpkPath)}`);
  console.log(`  ${formatSize(result.size)}，${result.entryCount} 个条目`);

  return 0;
```

---

## Step 9.6：单元测试

测试的核心思路：**用 Node 手写一个解析器读回产物。** 这个解析器要模仿 Runtime 侧 `rpk_loader.cpp` 的逻辑——如果它能读，C++ 版也应该能读。

```text
@add quickapp-toolkit/test/unit/zip-writer.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const {
  ZipWriter,
  crc32,
  normalizeEntryPath,
} = require('../../dist/packager/zip-writer.js');

/**
 * 最小 ZIP 解析器，模仿 Runtime 侧 rpk_loader.cpp 的逻辑。
 *
 * 步骤与 C++ 版一致：倒扫找 EOCD -> 遍历 Central Directory ->
 * 按 localHeaderOffset 读数据。
 *
 * @param buf ZIP 字节流
 * @returns 条目名到解压后 Buffer 的映射
 */
function parseZip(buf) {
  // 1. 倒扫找 End of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert.ok(eocd >= 0, '未找到 End of Central Directory');

  const numEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  // 2. 遍历 Central Directory
  const entries = new Map();
  let pos = cdOffset;

  for (let i = 0; i < numEntries; i++) {
    assert.strictEqual(
      buf.readUInt32LE(pos),
      0x02014b50,
      `第 ${i} 项 Central Directory 签名错误`
    );

    const method = buf.readUInt16LE(pos + 10);
    const crc = buf.readUInt32LE(pos + 16);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    // 3. 按 localHeaderOffset 读数据
    assert.strictEqual(
      buf.readUInt32LE(lhOffset),
      0x04034b50,
      `${name} 的 Local File Header 签名错误`
    );
    const lhNameLen = buf.readUInt16LE(lhOffset + 26);
    const lhExtraLen = buf.readUInt16LE(lhOffset + 28);
    const dataStart = lhOffset + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);

    assert.strictEqual(data.length, uncompressedSize, `${name} 解压后大小不符`);
    assert.strictEqual(crc32(data), crc, `${name} 的 CRC 不匹配`);

    entries.set(name, data);
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}
```

测试用例接在同一文件中：

```javascript
// ---------- 路径规范化 ----------

test('规范化去掉前导斜杠', () => {
  assert.strictEqual(normalizeEntryPath('/a/b.js'), 'a/b.js');
});

test('规范化去掉 ./ 前缀', () => {
  assert.strictEqual(normalizeEntryPath('./a/b.js'), 'a/b.js');
});

test('规范化反斜杠转正斜杠', () => {
  assert.strictEqual(normalizeEntryPath('a\\b\\c.js'), 'a/b/c.js');
});

test('规范化合并连续斜杠', () => {
  assert.strictEqual(normalizeEntryPath('a//b///c.js'), 'a/b/c.js');
});

test('规范化保留正常路径', () => {
  assert.strictEqual(
    normalizeEntryPath('pages/Demo/index.js'),
    'pages/Demo/index.js'
  );
});

// ---------- CRC-32 ----------

test('CRC-32 空数据', () => {
  assert.strictEqual(crc32(Buffer.alloc(0)), 0);
});

test('CRC-32 已知值', () => {
  // "123456789" 的标准 CRC-32 是 0xCBF43926
  assert.strictEqual(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('CRC-32 返回无符号值', () => {
  const c = crc32(Buffer.from('test'));
  assert.ok(c >= 0 && c <= 0xffffffff);
});

// ---------- 基本写入读回 ----------

test('单条目 STORE 往返', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'hello', 0);
  const entries = parseZip(z.build());
  assert.strictEqual(entries.get('a.txt').toString('utf8'), 'hello');
});

test('单条目 DEFLATE 往返', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'hello world '.repeat(100), 8);
  const entries = parseZip(z.build());
  assert.strictEqual(
    entries.get('a.txt').toString('utf8'),
    'hello world '.repeat(100)
  );
});

test('多条目往返', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'A');
  z.add('b/c.txt', 'BC');
  z.add('d/e/f.txt', 'DEF');
  const entries = parseZip(z.build());
  assert.strictEqual(entries.size, 3);
  assert.strictEqual(entries.get('a.txt').toString(), 'A');
  assert.strictEqual(entries.get('b/c.txt').toString(), 'BC');
  assert.strictEqual(entries.get('d/e/f.txt').toString(), 'DEF');
});

test('二进制数据往返', () => {
  const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x7f]);
  const z = new ZipWriter();
  z.add('img.png', data, 0);
  const entries = parseZip(z.build());
  assert.deepStrictEqual(entries.get('img.png'), data);
});

test('UTF-8 文件名往返', () => {
  const z = new ZipWriter();
  z.add('页面/示例.js', 'x');
  const entries = parseZip(z.build());
  assert.ok(entries.has('页面/示例.js'));
});

test('UTF-8 内容往返', () => {
  const z = new ZipWriter();
  z.add('a.txt', '欢迎体验快应用开发 🚀');
  const entries = parseZip(z.build());
  assert.strictEqual(
    entries.get('a.txt').toString('utf8'),
    '欢迎体验快应用开发 🚀'
  );
});

test('空内容条目', () => {
  const z = new ZipWriter();
  z.add('empty.txt', '');
  const entries = parseZip(z.build());
  assert.strictEqual(entries.get('empty.txt').length, 0);
});

test('大内容 DEFLATE 压缩有效', () => {
  const big = 'a'.repeat(100000);
  const z = new ZipWriter();
  z.add('big.txt', big, 8);
  const buf = z.build();
  assert.ok(buf.length < 5000, `压缩后 ${buf.length} 应远小于 100000`);
  const entries = parseZip(buf);
  assert.strictEqual(entries.get('big.txt').toString(), big);
});

test('add 时路径被规范化', () => {
  const z = new ZipWriter();
  z.add('/pages/Demo/index.js', 'x');
  const entries = parseZip(z.build());
  assert.ok(entries.has('pages/Demo/index.js'));
  assert.ok(!entries.has('/pages/Demo/index.js'));
});
```

错误处理、可复现性和结构校验用例：

```javascript
// ---------- 错误处理 ----------

test('空路径抛错', () => {
  const z = new ZipWriter();
  assert.throws(() => z.add('/', 'x'), /无效的 ZIP 条目路径/);
  assert.throws(() => z.add('./', 'x'), /无效的 ZIP 条目路径/);
});

test('重复路径抛错', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'x');
  assert.throws(() => z.add('a.txt', 'y'), /重复的 ZIP 条目路径/);
});

test('规范化后重复的路径也抛错', () => {
  const z = new ZipWriter();
  z.add('a/b.txt', 'x');
  assert.throws(() => z.add('/a/b.txt', 'y'), /重复的 ZIP 条目路径/);
});

// ---------- 可复现构建 ----------

test('相同输入产出字节一致的 ZIP', () => {
  const make = () => {
    const z = new ZipWriter();
    z.add('a.txt', 'A');
    z.add('b.txt', 'B');
    return z.build();
  };
  assert.ok(make().equals(make()), '两次构建应字节一致');
});

test('默认时间戳固定，不受当前时间影响', () => {
  const z1 = new ZipWriter();
  z1.add('a.txt', 'A');
  const z2 = new ZipWriter(new Date(1980, 0, 1, 0, 0, 0));
  z2.add('a.txt', 'A');
  assert.ok(z1.build().equals(z2.build()));
});

// ---------- 结构校验 ----------

test('EOCD 中的条目数正确', () => {
  const z = new ZipWriter();
  z.add('a', 'x');
  z.add('b', 'y');
  z.add('c', 'z');
  const buf = z.build();

  const eocdPos = buf.length - 22;
  assert.strictEqual(buf.readUInt32LE(eocdPos), 0x06054b50);
  assert.strictEqual(buf.readUInt16LE(eocdPos + 8), 3);
  assert.strictEqual(buf.readUInt16LE(eocdPos + 10), 3);
});

test('Central Directory 偏移和大小正确', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'hello');
  const buf = z.build();

  const eocdPos = buf.length - 22;
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);

  assert.strictEqual(buf.readUInt32LE(cdOffset), 0x02014b50);
  // CD 结束处应正好是 EOCD 起始处
  assert.strictEqual(cdOffset + cdSize, eocdPos);
});

test('DEFLATE 数据是 raw 格式，无 zlib 头', () => {
  const z = new ZipWriter();
  z.add('a.txt', 'x'.repeat(1000), 8);
  const buf = z.build();

  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  const compressedSize = buf.readUInt32LE(18);
  const raw = buf.subarray(dataStart, dataStart + compressedSize);

  // raw deflate 能被 inflateRawSync 解压
  assert.doesNotThrow(() => zlib.inflateRawSync(raw));
  // 反向验证：期望 zlib 头的 inflateSync 应失败
  assert.throws(() => zlib.inflateSync(raw));
});
```

最后一个用例是关键的反向验证。如果误用了 `deflateSync`（带 zlib 头），`inflateRawSync` 会失败或产出垃圾数据——而 Runtime 侧的 `inflateInit2(&strm, -MAX_WBITS)` 正是 raw 模式。这个用例在编译期就能拦住这类错误。

```text
@add quickapp-toolkit/test/unit/rpk-packager.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { packRPK, rpkFileName } = require('../../dist/packager/rpk-packager.js');
const { sha256 } = require('../../dist/packager/build-info.js');
const { crc32 } = require('../../dist/packager/zip-writer.js');

/** 复用 zip-writer 测试里的解析器（此处内联简化版） */
function listEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  const numEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let pos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    const lhNameLen = buf.readUInt16LE(lhOffset + 26);
    const lhExtraLen = buf.readUInt16LE(lhOffset + 28);
    const dataStart = lhOffset + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, {
      method,
      data: method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw),
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 创建临时项目并返回 ctx */
function makeCtx(mode = 'debug') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-pack-'));
  const distDir = path.join(root, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  return {
    projectRoot: root,
    srcDir: path.join(root, 'src'),
    distDir,
    mode,
    diagnostics: [],
  };
}

/** 最小 manifest */
function manifest() {
  return {
    package: 'com.test.app',
    name: 'test',
    versionName: '1.0.0',
    versionCode: 1,
    router: { entry: 'pages/Demo', pages: { 'pages/Demo': { component: 'index' } } },
    config: { debug: true, logLevel: 'debug' },
  };
}

/** 执行打包并读回 */
function pack(opts = {}) {
  const ctx = opts.ctx ?? makeCtx();
  const result = packRPK({
    ctx,
    manifest: opts.manifest ?? manifest(),
    bundles: opts.bundles ?? new Map([['app.js', '// app'], ['pages/Demo/index.js', '// page']]),
    assets: opts.assets ?? new Map(),
    toolkitVersion: '1.0.0',
  });
  return { ctx, result, entries: listEntries(fs.readFileSync(result.rpkPath)) };
}

// ---------- 文件名 ----------

test('RPK 文件名格式', () => {
  assert.strictEqual(
    rpkFileName(manifest(), 'debug'),
    'com.test.app.debug.1.0.0.rpk'
  );
  assert.strictEqual(
    rpkFileName(manifest(), 'release'),
    'com.test.app.release.1.0.0.rpk'
  );
});

test('产物路径在 distDir 下', () => {
  const { ctx, result } = pack();
  assert.strictEqual(path.dirname(result.rpkPath), ctx.distDir);
});

// ---------- 条目完整性 ----------

test('包含 manifest.json', () => {
  const { entries } = pack();
  assert.ok(entries.has('manifest.json'));
  const m = JSON.parse(entries.get('manifest.json').data.toString('utf8'));
  assert.strictEqual(m.package, 'com.test.app');
});

test('包含所有 bundle', () => {
  const { entries } = pack();
  assert.ok(entries.has('app.js'));
  assert.ok(entries.has('pages/Demo/index.js'));
  assert.strictEqual(entries.get('app.js').data.toString(), '// app');
});

test('包含 META-INF/build.txt', () => {
  const { entries } = pack();
  assert.ok(entries.has('META-INF/build.txt'));
});

test('不生成 META-INF/CERT', () => {
  const { entries } = pack();
  assert.ok(!entries.has('META-INF/CERT'), 'V1 不做签名');
});

test('entryCount 与实际条目数一致', () => {
  const { result, entries } = pack();
  assert.strictEqual(result.entryCount, entries.size);
});
```

```javascript
// ---------- 资源与压缩方法 ----------

test('资源文件被打包', () => {
  const ctx = makeCtx();
  const imgPath = path.join(ctx.projectRoot, 'logo.png');
  const imgData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  fs.writeFileSync(imgPath, imgData);

  const { entries } = pack({
    ctx,
    assets: new Map([['assets/images/logo.png', imgPath]]),
  });

  assert.ok(entries.has('assets/images/logo.png'));
  assert.deepStrictEqual(entries.get('assets/images/logo.png').data, imgData);
});

test('图片用 STORE，JS 用 DEFLATE', () => {
  const ctx = makeCtx();
  const imgPath = path.join(ctx.projectRoot, 'a.png');
  fs.writeFileSync(imgPath, Buffer.alloc(100, 7));

  const { entries } = pack({
    ctx,
    bundles: new Map([['app.js', '// '.repeat(200)]]),
    assets: new Map([['assets/a.png', imgPath]]),
  });

  assert.strictEqual(entries.get('assets/a.png').method, 0, 'png 应为 STORE');
  assert.strictEqual(entries.get('app.js').method, 8, 'js 应为 DEFLATE');
  assert.strictEqual(entries.get('manifest.json').method, 8, 'json 应为 DEFLATE');
});

test('字体和音频也用 STORE', () => {
  const ctx = makeCtx();
  const files = {};
  for (const name of ['a.woff2', 'b.mp3', 'c.mp4']) {
    const p = path.join(ctx.projectRoot, name);
    fs.writeFileSync(p, Buffer.alloc(50, 3));
    files[`assets/${name}`] = p;
  }
  const { entries } = pack({ ctx, assets: new Map(Object.entries(files)) });

  for (const name of ['a.woff2', 'b.mp3', 'c.mp4']) {
    assert.strictEqual(entries.get(`assets/${name}`).method, 0, `${name} 应为 STORE`);
  }
});

test('.DS_Store 被排除', () => {
  const ctx = makeCtx();
  const dsPath = path.join(ctx.projectRoot, '.DS_Store');
  fs.writeFileSync(dsPath, 'junk');

  const { result, entries } = pack({
    ctx,
    assets: new Map([['assets/.DS_Store', dsPath]]),
  });

  assert.ok(!entries.has('assets/.DS_Store'));
  assert.deepStrictEqual(result.excluded, ['assets/.DS_Store']);
});

test('资源文件不存在时抛错', () => {
  const ctx = makeCtx();
  assert.throws(
    () => pack({ ctx, assets: new Map([['assets/x.png', '/nonexistent/x.png']]) }),
    /无法读取资源文件/
  );
});

// ---------- build.txt 内容 ----------

test('build.txt 含构建环境信息', () => {
  const { entries } = pack();
  const txt = entries.get('META-INF/build.txt').data.toString('utf8');
  assert.match(txt, /^originType=quickapp-toolkit$/m);
  assert.match(txt, /^toolkit=1\.0\.0$/m);
  assert.match(txt, /^node=/m);
  assert.match(txt, /^platform=/m);
  assert.match(txt, /^arch=/m);
});

test('build.txt 含 bundle hash', () => {
  const { entries } = pack({
    bundles: new Map([['app.js', '// app'], ['pages/Demo/index.js', '// page']]),
  });
  const txt = entries.get('META-INF/build.txt').data.toString('utf8');
  assert.match(txt, new RegExp(`^app:app=${sha256('// app')}$`, 'm'));
  assert.match(txt, new RegExp(`^page:pages/Demo=${sha256('// page')}$`, 'm'));
});

test('build.txt 的 hash 行已排序', () => {
  const { entries } = pack({
    bundles: new Map([
      ['pages/Z/index.js', 'z'],
      ['app.js', 'a'],
      ['pages/A/index.js', 'x'],
    ]),
  });
  const txt = entries.get('META-INF/build.txt').data.toString('utf8');
  const hashLines = txt.split('\n').filter((l) => /^(app|page|widget):/.test(l));
  const sorted = [...hashLines].sort();
  assert.deepStrictEqual(hashLines, sorted, 'hash 行应按 key 排序');
});

// ---------- 原子写入与可复现 ----------

test('打包后无残留临时文件', () => {
  const { ctx } = pack();
  const tmpDir = path.join(ctx.distDir, '.tmp');
  if (fs.existsSync(tmpDir)) {
    assert.deepStrictEqual(fs.readdirSync(tmpDir), [], '.tmp 应为空');
  }
});

test('相同输入产出字节一致的 RPK', () => {
  const bundles = new Map([['app.js', '// app']]);
  const a = pack({ ctx: makeCtx(), bundles });
  const b = pack({ ctx: makeCtx(), bundles });
  assert.ok(
    fs.readFileSync(a.result.rpkPath).equals(fs.readFileSync(b.result.rpkPath)),
    '两次打包应字节一致'
  );
});

test('重复打包覆盖旧产物', () => {
  const ctx = makeCtx();
  pack({ ctx, bundles: new Map([['app.js', 'v1']]) });
  const { entries } = pack({ ctx, bundles: new Map([['app.js', 'v2']]) });
  assert.strictEqual(entries.get('app.js').data.toString(), 'v2');
});

// ---------- mode 影响 ----------

test('mode 影响文件名', () => {
  const d = pack({ ctx: makeCtx('debug') });
  const r = pack({ ctx: makeCtx('release') });
  assert.match(path.basename(d.result.rpkPath), /\.debug\./);
  assert.match(path.basename(r.result.rpkPath), /\.release\./);
});

// ---------- CRC 正确性 ----------

test('所有条目的 CRC 正确', () => {
  const ctx = makeCtx();
  const imgPath = path.join(ctx.projectRoot, 'a.png');
  fs.writeFileSync(imgPath, Buffer.alloc(64, 9));

  const { result } = pack({
    ctx,
    bundles: new Map([['app.js', '// app'], ['pages/Demo/index.js', '// page']]),
    assets: new Map([['assets/a.png', imgPath]]),
  });

  // listEntries 不校验 CRC，这里手动逐条校验
  const buf = fs.readFileSync(result.rpkPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  const numEntries = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < numEntries; i++) {
    const method = buf.readUInt16LE(pos + 10);
    const expectedCrc = buf.readUInt32LE(pos + 16);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    const lhNameLen = buf.readUInt16LE(lhOffset + 26);
    const lhExtraLen = buf.readUInt16LE(lhOffset + 28);
    const dataStart = lhOffset + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? raw : zlib.inflateRawSync(raw);

    assert.strictEqual(crc32(data), expectedCrc, `${name} CRC 不匹配`);
    pos += 46 + nameLen + extraLen + commentLen;
  }
});
```

---

## Step 9.7：逐层验证

### 9.7.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** zip-writer 24 个 + rpk-packager 20 个用例通过，累计 239 个。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `CRC 不匹配` | CRC 表构建或计算有误 | 核对多项式 `0xEDB88320`，初值 `-1`，末尾 `^ -1 >>> 0` |
| `inflateRawSync` 抛 `incorrect header check` | 用了 `deflateSync` 而非 `deflateRawSync` | 改用 raw 版本 |
| `Central Directory 签名错误` | 三个签名值写混 | 核对：Local `0x04034b50`、CD `0x02014b50`、EOCD `0x06054b50` |
| `cdOffset + cdSize !== eocdPos` | Central Directory 大小累加漏了文件名长度 | `cdSize += 46 + nameBuf.length` |
| 两次构建字节不一致 | 时间戳用了 `new Date()` | 确认 `ZipWriter` 默认时间戳固定 |

### 9.7.2：标准工具兼容性验证

产物必须能被标准 ZIP 工具正确处理——这是格式正确性的独立验证。

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1
cd ../quickapp-examples/quickapp-code-test1/dist

# 列出条目
unzip -l com.example.case1.debug.1.0.0.rpk
```

**预期输出：**

```text
Archive:  com.example.case1.debug.1.0.0.rpk
  Length      Date    Time    Name
---------  ---------- -----   ----
     1234  1980-01-01 00:00   manifest.json
     1180  1980-01-01 00:00   app.js
     3456  1980-01-01 00:00   pages/Demo/index.js
     3210  1980-01-01 00:00   pages/DemoDetail/index.js
     3072  1980-01-01 00:00   assets/images/logo.png
      412  1980-01-01 00:00   META-INF/build.txt
---------                     -------
    12564                     6 files
```

**验证点：**
- 条目路径无前导 `/`，用正斜杠
- 日期显示 1980-01-01（固定时间戳生效）
- 条目数与 `entryCount` 一致

```bash
# 校验 CRC 完整性
unzip -t com.example.case1.debug.1.0.0.rpk
```

**预期：**

```text
Archive:  com.example.case1.debug.1.0.0.rpk
    testing: manifest.json            OK
    testing: app.js                   OK
    testing: pages/Demo/index.js      OK
    testing: pages/DemoDetail/index.js   OK
    testing: assets/images/logo.png   OK
    testing: META-INF/build.txt       OK
No errors detected in compressed data of com.example.case1.debug.1.0.0.rpk.
```

任何 `bad CRC` 都表示 CRC-32 实现有问题。Runtime 侧不校验 CRC 所以能读，但这是格式缺陷，必须修。

```bash
# 完整解压并检视
rm -rf verify && unzip -q com.example.case1.debug.1.0.0.rpk -d verify
find verify -type f | sort
cat verify/META-INF/build.txt
head -20 verify/manifest.json
```

**验证点：** 目录结构与 RPK 内路径一致，`manifest.json` 的 `config.debug` 为 true。

### 9.7.3：Runtime 侧解析器兼容性验证

这是最关键的验证：产物必须能被 Android 的手写 ZIP 解析器读取。

写一个独立的 C++ 验证程序，直接复用 Runtime 的 `rpk_loader.cpp`：

```text
@add quickapp-toolkit/test/native/verify_rpk.cpp（新建文件，可选验证工具）
```

```cpp
// 用 Runtime 侧的 RPKLoader 读取 toolkit 产出的 RPK，
// 验证两侧对 ZIP 格式的理解一致。
//
// 编译（macOS/Linux，需要 zlib）：
//   c++ -std=c++17 -I<runtime>/core/include \
//       verify_rpk.cpp <runtime>/core/src/rpk_loader.cpp \
//       -lz -o verify_rpk
//
// 注意：rpk_loader.cpp 依赖 android/log.h，桌面端验证需先做
// 日志抽象（这正是 quickapp-runtime-core 的抽取工作之一）。
// 临时办法：编译时加 -Dandroid_log_print=printf 之类的桩。

#include "rpk_loader.h"
#include <cstdio>
#include <fstream>
#include <vector>

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "用法：verify_rpk <file.rpk>\n");
        return 2;
    }

    std::ifstream file(argv[1], std::ios::binary);
    if (!file) {
        std::fprintf(stderr, "无法打开：%s\n", argv[1]);
        return 1;
    }
    std::vector<uint8_t> data(
        (std::istreambuf_iterator<char>(file)),
        std::istreambuf_iterator<char>());

    quickapp::RPKLoader loader;
    if (!loader.open(data.data(), data.size())) {
        std::fprintf(stderr, "RPKLoader.open 失败\n");
        return 1;
    }

    // 逐个读取关键条目
    const char* required[] = {
        "manifest.json",
        "app.js",
        "META-INF/build.txt",
    };

    int failed = 0;
    for (const char* path : required) {
        std::string content = loader.readText(path);
        if (content.empty()) {
            std::fprintf(stderr, "FAIL 读取失败：%s\n", path);
            failed++;
        } else {
            std::printf("OK   %s (%zu 字节)\n", path, content.size());
        }
    }

    // 二进制资源
    auto png = loader.readBinary("assets/images/logo.png");
    if (png.empty()) {
        std::fprintf(stderr, "FAIL 读取失败：assets/images/logo.png\n");
        failed++;
    } else {
        // PNG 魔数校验，确认 STORE 数据未被破坏
        bool valid = png.size() > 8 && png[0] == 0x89 && png[1] == 'P' &&
                     png[2] == 'N' && png[3] == 'G';
        std::printf("%s assets/images/logo.png (%zu 字节, PNG 魔数 %s)\n",
                    valid ? "OK  " : "FAIL", png.size(),
                    valid ? "正确" : "错误");
        if (!valid) failed++;
    }

    std::printf("\n%s\n", failed == 0 ? "全部通过" : "存在失败项");
    return failed == 0 ? 0 : 1;
}
```

**预期输出：**

```text
OK   manifest.json (1234 字节)
OK   app.js (1180 字节)
OK   META-INF/build.txt (412 字节)
OK   assets/images/logo.png (3072 字节, PNG 魔数 正确)

全部通过
```

如果 `readText` 返回空字符串，两种可能：条目名不匹配（路径规范化问题），或 `inflate` 失败（DEFLATE 格式问题）。前者查 `unzip -l` 的路径形式，后者查是否用了 `deflateRawSync`。

这个验证在 `quickapp-runtime-core` 抽取完成后会更容易执行——那时 `rpk_loader.cpp` 已剥离 Android 依赖，可直接在桌面端编译。Step 11 会做完整的端到端验收。

### 9.7.4：与官方 RPK 结构对照

```bash
cd ../quickapp-examples/quickapp-code-test1/dist
echo "=== 官方产物 ==="
unzip -l com.example.case1.debug.1.0.0.rpk.official 2>/dev/null || \
  unzip -l $(ls *.rpk | grep -v "$(quickapp --version)" | head -1)
echo "=== 本工具链产物 ==="
unzip -l com.example.case1.debug.1.0.0.rpk
```

**对照清单：**

| 维度 | 官方 | 本工具链 | 必须一致 |
|---|---|---|---|
| `manifest.json` | 有 | 有 | 是 |
| `app.js` | 有 | 有 | 是 |
| `pages/*/index.js` | 有 | 有 | 是 |
| `assets/**` | 有 | 有 | 是 |
| `META-INF/build.txt` | 有 | 有 | 是 |
| `META-INF/CERT` | 有 | 无 | 否（V1 不签名） |
| `sitemap.json` | 有 | 无 | 否（SEO 用，Runtime 不读） |
| 条目路径形式 | 正斜杠无前导 | 同 | 是 |
| JS 压缩方法 | DEFLATE | DEFLATE | 是 |
| 图片压缩方法 | STORE | STORE | 是 |
| 时间戳 | 真实构建时间 | 固定 1980 | 否 |

`CERT` 和 `sitemap.json` 缺失不影响 Runtime 加载：Android tasks.md 的 Task 2.1 明确「跳过 `META-INF/CERT` 签名校验」，`sitemap.json` 是搜索引擎用的元数据。

### 9.7.5：原子写入验证

模拟打包中途失败，确认不留下损坏产物。

```bash
# 先正常打包一次
quickapp build --root=/tmp/atomic-test
ls -la /tmp/atomic-test/dist/*.rpk
cp /tmp/atomic-test/dist/*.rpk /tmp/good.rpk

# 模拟中断：在打包时 kill
quickapp build --root=/tmp/atomic-test & 
PID=$!
sleep 0.05
kill -9 $PID 2>/dev/null

# 检查产物完整性
unzip -t /tmp/atomic-test/dist/*.rpk && echo "产物完好" || echo "产物损坏"
ls -la /tmp/atomic-test/dist/.tmp/ 2>/dev/null
```

**预期：** `产物完好`。旧产物仍是上一次的完整版本，`.tmp/` 下可能有残留的临时文件（进程被 SIGKILL，来不及清理），但最终路径的 `.rpk` 未被破坏。

`.tmp` 残留是可接受的：临时文件名带 `process.pid`，不会与后续构建冲突；下次成功构建后可手动清理。如果要自动清理，可以在 `packRPK` 开头扫描 `.tmp` 删除超过一定时间的文件——V1 不做，避免误删并发构建的临时文件。

### 9.7.6：端到端产物验证

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1
```

**预期输出：**

```text
模式：debug
源码：src/

应用：case1 (com.example.case1) v1.0.0
入口：pages/Demo
配置：debug=true, logLevel=debug
能力：system.prompt、system.router、system.shortcut、system.fetch

待编译页面（2）：
  pages/Demo  ->  pages/Demo/index.js
  pages/DemoDetail  ->  pages/DemoDetail/index.js

编译：
  app.js  1.2 KB
  pages/Demo/index.js  3.4 KB
  pages/DemoDetail/index.js  3.1 KB

静态资源（1）：
  assets/images/logo.png

产物：
  dist/com.example.case1.debug.1.0.0.rpk
  8.7 KB，6 个条目
```

对比 release：

```bash
quickapp build --root=../quickapp-examples/quickapp-code-test1 --mode=release
ls -la ../quickapp-examples/quickapp-code-test1/dist/*.rpk
```

**预期：** release 产物明显小于 debug（当前约 30% 降幅，接入 Terser 后达 60-70%）。官方 debug 42KB / release 18KB 的比例可作参考——我们不生成 sourcemap，所以两者都更小。

---

## 技术决策

### 1. 手写 ZIP 写入器，不用 archiver

Runtime 侧的 `rpk_loader.cpp` 是手写的 ZIP 解析器。两侧都手写能保证对格式的理解一致。

`archiver` 可能设置手写解析器不处理的标志位——比如 data descriptor（压缩大小写在数据之后而非 header 里，需要标志位 bit 3）、UTF-8 文件名标志（bit 11）、Zip64 扩展字段。这类问题的现象是「`unzip` 能解压，我们的 Runtime 读不到」，排查时容易怀疑 Runtime。

写入器约 150 行，可控。同时避免了 archiver 的依赖树（它依赖 `zip-stream`、`compress-commons`、`readable-stream` 等十几个包）。

### 2. `deflateRawSync` 而非 `deflateSync`

ZIP 的 method 8 要求 raw deflate，不含 zlib 头尾。Runtime 侧用 `inflateInit2(&strm, -MAX_WBITS)`，负 windowBits 即 raw 模式。

如果写入端加了 zlib 头（2 字节头 + 4 字节 Adler-32），`inflate` 返回 `Z_DATA_ERROR`。单测里用「`inflateSync` 应失败」做反向验证，防止这个错误。

### 3. 自己实现 CRC-32

`zlib.crc32` 在 Node 20.15+ 才有。为兼容 Node 18（`package.json` 声明 `>=18`），自己实现查表法，约 20 行。

CRC 必须正确的理由：Runtime 侧不校验，但 `unzip -t`、Android 的 `java.util.zip.ZipFile`、以及任何标准工具都校验。写错的后果是产物「在我们的 Runtime 上能跑，用标准工具检查报错」——这会让人怀疑 Runtime 的正确性。

### 4. 固定时间戳，保证可复现构建

ZIP 条目时间戳固定为 1980-01-01，`build.txt` 的 `timeStamp` 固定为 `new Date(0)`。

同一份源码每次构建产出字节一致的 RPK，带来两个实际收益：CI 可用产物 hash 判断是否需要重新部署；两次构建的 diff 只反映真实变更，不是全文件变化。

真实构建时间对 Runtime 无用途——它既不做时间校验也不显示。需要记录时应放在 CI 元数据里，不放产物内部。

### 5. 路径在 `add` 时规范化

`normalizeEntryPath` 处理前导斜杠、`./` 前缀、反斜杠、连续斜杠。在唯一的入口做转换，后续环节无需关心。

Runtime 侧按精确字符串匹配查找条目（`entry.name == entryPath`）。路径形式不一致的后果是「文件明明在包里却读不到」——这类问题在 Windows 上打包、Android 上运行时才暴露。

### 6. 图片和媒体用 STORE

这些格式内部已压缩，DEFLATE 通常让体积略增（压缩已压缩数据），且浪费打包和解压时间。

白名单而非黑名单：未知扩展名默认 DEFLATE。文本类文件（`.json`、`.txt`、`.svg`）压缩收益大，比误压缩一个未列出的二进制格式的损失更值得。

### 7. 排除系统元数据文件

`.DS_Store`、`Thumbs.db`、`desktop.ini` 进入 RPK 无用，且会让不同开发机产出的包不一致（macOS 开发者的包多一个 `.DS_Store`）。

排除在打包阶段而非扫描阶段：扫描结果应忠实反映目录内容，过滤是打包策略。

### 8. 原子写入：临时文件 + rename

`rename` 在同一文件系统内是原子操作。要么旧文件仍在，要么新文件完整可用，不存在中间状态。

这是 Property 8 的后半部分（前半部分是 Step 8 的「有 error 就不打包」）。损坏的 `.rpk` 在 Runtime 侧表现为 ZIP 解析错误，排查方向会被误导到 Runtime。

临时文件名带 `process.pid`，避免并发构建互相覆盖。

### 9. `build.txt` 的 hash 行排序

`Map` 迭代顺序是插入顺序，而插入顺序取决于 `manifest.router.pages` 的声明顺序。开发者调整 manifest 里页面顺序（内容不变）会导致 `build.txt` 字节变化。排序消除这个噪音。

### 10. 不生成 `META-INF/CERT`

V1 不做签名。Runtime 侧明确跳过签名校验（Android tasks.md Task 2.1）。

不生成占位 CERT 而是完全省略：一个内容无意义的 CERT 会给人「已经签名了」的错觉。缺失更诚实。

---

## QA

**Q：为什么 `manifest.json` 放在第一个条目？**

Runtime 的启动序列先读 manifest。ZIP 的 Central Directory 在文件尾部，条目顺序不影响查找速度（都要先读 CD）。

但顺序读取仍有局部性收益：`RPKLoader` 把整个文件读入内存后，靠前的条目数据在同一批缓存页里。这个收益很小，主要理由是产物结构可读——解压后第一眼看到 manifest。

**Q：`ZipWriter` 全部数据在内存累积，大 RPK 会 OOM 吗？**

RPK 通常几十 KB 到几 MB。即使 10MB 的包（含大量图片），内存峰值约 20MB（原始 + 压缩两份）。不是问题。

如果将来要打包视频等大资源，应该改为流式写入：`Local File Header` 和数据边压边写，`Central Directory` 最后写。但那需要先写入临时文件再计算偏移，复杂度显著增加。当前规模不需要。

**Q：Zip64 支持吗？**

不支持。Zip64 用于超过 4GB 的归档或超过 65535 个条目。RPK 不会达到这个规模。

如果真的超过，当前实现会因为 `writeUInt32LE` 溢出而产出错误的偏移值。加一个大小检查并抛错比实现 Zip64 更合理——但 V1 连检查也不做，因为触发条件不现实。

**Q：`toDosDateTime` 里 1980 之前的日期钳制到 1980-01-01，为什么不抛错？**

默认时间戳就是 1980-01-01，正常路径不会触发。只有调用方显式传入更早时间才会——那属于误用，钳制比抛错更宽容。

`new Date(0)`（1970-01-01）只用于 `build.txt` 的文本内容，不进 DOS 日期转换。

**Q：`packRPK` 里 `bundles` 的顺序会影响产物字节吗？**

会。条目在 ZIP 中的物理顺序由 `add` 调用顺序决定。`bundles` 是 `Map`，迭代顺序是插入顺序，而插入顺序来自 `manifest.router.pages` 的声明顺序。

这意味着调整 manifest 里页面顺序会改变 RPK 字节——但 `build.txt` 的 hash 行已排序，所以 hash 内容不变。

要完全消除这个影响，需要对条目排序。V1 不做：保持声明顺序让产物结构更符合直觉（页面按 manifest 顺序排列），而字节级可复现性只在「源码完全不变」的前提下需要保证。

**Q：`.tmp` 目录残留怎么清理？**

V1 不自动清理。临时文件名带 `process.pid`，不会与后续构建冲突。

自动清理的风险是误删并发构建的临时文件——CI 上可能同时跑 debug 和 release 两个构建。要安全实现需要检查文件的 mtime 和对应进程是否存活，复杂度不值得。

实际影响：`.tmp` 下的残留文件只在进程被 SIGKILL 时产生，正常失败路径有 `unlinkSync` 清理。

**Q：Runtime 侧的 `RPKLoader` 不校验 CRC，那我们计算 CRC 是浪费吗？**

不是。三个理由：

一是标准工具（`unzip -t`、Android `ZipFile`）会校验，写错会被发现，且那时的现象容易误导排查方向。

二是 CRC 是 ZIP 格式的必需字段，不能留 0——某些解析器会认为 CRC 为 0 表示数据损坏。

三是将来 Runtime 可能加校验（增量更新场景下验证下载的包完整性），届时不需要改 toolkit。

CRC 计算的性能开销：几十 KB 数据在亚毫秒级。

**Q：`verify_rpk.cpp` 提到需要日志抽象才能桌面编译，这是什么意思？**

`rpk_loader.cpp` 里用了 `__android_log_print`（Android NDK 的日志 API），在桌面端编译会找不到符号。

这正是 `quickapp-runtime-core` 抽取工作的一部分——把日志调用换成宏抽象，Android 用 `__android_log_print`，桌面用 `fprintf`，LVGL 用串口。

Step 11 的 Runtime 契约验收会在真实 Android 环境执行，不依赖桌面编译。`verify_rpk.cpp` 是可选的辅助工具，在 core 抽取完成后才好用。

---

## 下一步

Step 10 接入 Terser 压缩：release 模式下压缩 bundle，同时保留 `$app_define$` 等注入的全局函数名不被改写。
