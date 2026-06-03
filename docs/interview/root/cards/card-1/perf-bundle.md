# Bundle 优化（包体 + 加载）

> 问题：Bundle 太大 → 下载慢 + 解析慢 + 启动慢
>
> 本质：减少产物体积 + 运行时按需加载
>
> 多 Bundle 方案详见 [architecture-engineering.md](../../RN/architecture-engineering.md) 和 XRN

---

## 目录

- [如何分析](#如何分析)
- [如何优化](#如何优化)
  - [RN/JS 层（Bundle 瘦身）](#rnjs-层bundle-瘦身)
  - [Native 层（APK 瘦身）](#native-层apk-瘦身)
  - [构建层](#构建层)

---

## 如何分析

| 工具 | 看什么 |
|------|--------|
| `source-map-explorer` | JS Bundle 各模块占比（npm 命令行工具，打开可视化页面显示每个包的体积占比，类似 webpack-bundle-analyzer） |
| APK Analyzer（Android Studio） | APK 内部各部分体积（dex/lib/assets） |
| `adb shell ls -la` | Bundle 文件实际大小 |

---

> **Bundle 缓存与预加载**：RN 本身不提供 Bundle 缓存/热更新机制，只提供"从哪里加载 Bundle"的接口。缓存、版本管理、预加载、灰度、回滚都在 XRN 的自定义 Native 壳子中实现。→ [rn-engineering-deep.md](../card-3/rn-engineering-deep.md)

---

## 如何优化

### RN/JS 层（Bundle 瘦身）

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **Tree Shaking** | 未使用的导出不打入 Bundle | 减少无用代码 |
| **条件编译** | 按平台/环境裁剪代码 | 不同平台只包含自己的代码 |
| **替换大依赖** | moment → dayjs，lodash → lodash-es | 体积减少 80%+ |
| **图片压缩 + WebP** | 静态资源压缩 | 资源体积减少 50%+ |
| **字体子集化** | 只包含用到的字符 | 字体文件从 MB → KB |
| **React.lazy** | 非首屏组件懒加载 | 首次加载量减少 |

### Native 层（APK 瘦身）

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **abiFilters** | 只保留 arm64-v8a（去掉 x86/armeabi） | .so 体积减半 |
| **R8/ProGuard** | 代码混淆 + 无用代码删除 | DEX 体积减少 30-40% |
| **模块裁剪** | 不用的 Native Module 不打入 | 减少 .so 和 DEX |
| **App Bundle（AAB）** | Google Play 按设备分发 | 用户下载量减少 |

### 构建层

| 手段 | 做什么 | 效果 |
|------|--------|------|
| **Hermes AOT** | 预编译为 .hbc 字节码 | 加载快（跳过解析） |
| **Metro minifier** | 压缩 + drop_console | Bundle 体积减少 |

```bash
# 分析 Bundle 各模块占比
npx source-map-explorer dist/index.bundle dist/index.bundle.map

# 分析 APK
# Android Studio → Build → Analyze APK → 选择 APK 文件
```
