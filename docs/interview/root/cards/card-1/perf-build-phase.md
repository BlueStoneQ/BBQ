# RN 构建阶段性能优化

> 核心思路：让首屏加载的东西尽可能少 + 尽可能快被执行。

| 手段 | 层级 | 工具 | 效果 |
|------|------|------|------|
| **Hermes AOT** | JS | 默认开启，无需操作（`react-native build`） | 启动快 30-50%。0.70+ 默认开启 |
| **分 Bundle** | JS | XRN CLI + Metro 多 entry | 首屏只加载 common + 当前页面 |
| **图片压缩 + WebP** | Assets | `sharp` / `imagemin`（CI 脚本） | 体积小 30-50% |
| **Source Map 分离** | JS | Metro `--sourcemap-output` + `sentry-cli upload` | 不进生产包 |
| **R8/ProGuard** | Android Native | Gradle `minifyEnabled true` | DEX 瘦身 |
| **resConfigs 语言裁剪** | Android Native | Gradle `resConfigs "en", "zh-rCN"...` | 移除无用语言资源，减 2-5MB |
| **Baseline Profile** | Android Native | Jetpack Macrobenchmark + AGP | 减少启动 page fault |

注意：Metro **不支持 Tree Shaking**（CommonJS 打包器，无 ESM 静态分析能力）。需要靠 Babel 插件或手动控制 re-export 来减小 bundle。

## 图片优化

| 阶段 | 手段 | 工具 | 效果 |
|------|------|------|------|
| 构建时 | [WebP 替代 PNG/JPG](#注释webp转换) | `sharp` / CI 脚本 | 体积减 30-50% |
| 构建时 | 去掉 @1x，只保留 @2x @3x | 手动 / lint 规则 | 减少 1/3 图片文件 |
| 运行时 | FastImage（Native 缓存 + 预加载） | `react-native-fast-image` | 加载快 + 缓存复用 |
| 运行时 | [后端返回适配尺寸缩略图](#注释cdn图片处理) | CDN 图片处理（?w=200） | 不在客户端解码原图，省内存 |
| 运行时 | 缓存上限 | FastImage maxCacheSize | 防 OOM |

---

# 注释

<a id="注释webp转换"></a>
### WebP 转换

CI 中用 `sharp` 批量转换（设计师给 PNG，构建流水线自动转 WebP）。兼容性：Android 4.0+ / iOS 14+ 原生支持，H5 主流浏览器全支持（2026）。

<a id="注释cdn图片处理"></a>
### CDN 图片处理

RN 中图片分两种，不混用：
- **本地图片**（`require('./icon.webp')`）：打进 assets/ 随 bundle 分发，不上 CDN
- **远程图片**（`{uri: 'https://cdn.xxx/img.webp?w=200'}`）：图片本身由后端上传到 CDN，客户端用 URL 直接请求，`?w=200` 是 CDN 实时缩放参数

Webpack 的 `publicPath` 是 H5 场景——把本地静态资源打包后上传 CDN，`require` 的路径自动替换为 CDN URL。RN 不这样做，因为 RN 的本地图片走 Native `AssetManager` 读取（不是 HTTP 请求），没有 publicPath 的概念。
