# 图片优化

## 目录

- [问题本质](#问题本质)
- [格式优化](#格式优化)
- [加载优化](#加载优化)
- [内存优化](#内存优化)
- [工程化](#工程化)

---

## 问题本质

图片是 App 中最大的资源消耗：**包体占比 30~50%、内存占比 40~60%、网络流量大头**。

```
一张 1080×1920 的图片：
  PNG 文件：~2MB
  解码到内存：1080 × 1920 × 4 bytes = ~8MB（ARGB）
  如果列表有 20 张 → 160MB 内存（低端机直接 OOM）
```

---

## 格式优化

| 格式 | 适用 | 大小对比 | 说明 |
|------|------|---------|------|
| **WebP** | 照片/复杂图 | 比 PNG -30~50%，比 JPEG -25% | Android 4.0+ / iOS 14+ 原生支持 |
| **SVG** | 图标/简单图形 | 极小（几 KB） | 矢量，任意缩放不模糊 |
| **Lottie JSON** | 动画 | 比 GIF -90% | 矢量动画，支持交互 |
| JPEG | 照片（不需要透明） | 最小 | 有损，不支持透明 |
| PNG | 需要透明的图 | 最大 | 无损，支持透明 |

**操作**：
```bash
# 批量转 WebP（构建时自动）
cwebp input.png -q 80 -o output.webp

# 或在 Android 构建中自动转换
android {
  buildTypes {
    release {
      // AGP 自动将 res/ 中的 PNG 转为 WebP（API 18+）
    }
  }
}
```

---

## 加载优化

### react-native-fast-image（推荐）

RN 内置的 `<Image>` 没有磁盘缓存，每次都重新下载。`FastImage` 底层用 Glide（Android）/ SDWebImage（iOS），有完整的缓存策略。

```tsx
import FastImage from 'react-native-fast-image';

<FastImage
  source={{
    uri: 'https://cdn.example.com/photo.webp',
    priority: FastImage.priority.high,  // 优先级
    cache: FastImage.cacheControl.immutable,  // 强缓存（URL 不变就不重新请求）
  }}
  resizeMode={FastImage.resizeMode.cover}
  style={{ width: 200, height: 200 }}
/>
```

### 按需加载尺寸（CDN 裁剪）

```tsx
// ❌ 加载原图 3000×4000，显示在 200×200 的区域 → 浪费带宽 + 内存
<FastImage source={{ uri: 'https://cdn.com/photo.jpg' }} style={{ width: 200, height: 200 }} />

// ✅ 让 CDN 按显示尺寸裁剪后下发（大部分 CDN 支持 URL 参数）
const imageUrl = `https://cdn.com/photo.jpg?w=400&h=400&q=80`;  // 2x 分辨率
<FastImage source={{ uri: imageUrl }} style={{ width: 200, height: 200 }} />
```

### 列表中懒加载

```tsx
// FlatList 中图片只有滚动到可视区才加载
<FlatList
  data={items}
  windowSize={5}  // 只渲染可视区 ± 2 屏的内容
  renderItem={({ item }) => (
    <FastImage
      source={{ uri: item.imageUrl }}
      // FastImage 内部已支持懒加载（不在屏幕内不请求）
    />
  )}
/>
```

### 渐进加载（先模糊后清晰）

```tsx
// 先显示低分辨率缩略图（几 KB），再加载高清图
<FastImage
  source={{ uri: highResUrl }}
  defaultSource={require('./placeholder.png')}  // 本地占位图
/>

// 或用 blurhash（极小的模糊预览，~30 bytes）
import { Blurhash } from 'react-native-blurhash';
<Blurhash blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj" style={{ width: 200, height: 200 }} />
```

---

## 内存优化

| 手段 | 做法 |
|------|------|
| **降采样** | 按显示尺寸解码，不解码原图（Glide/SDWebImage 自动做） |
| **页面不可见时释放** | `useEffect` 清理 + FastImage 的 `onLoadEnd` 配合 |
| **内存缓存上限** | Glide: `setMemoryCacheSize(20MB)`，超出 LRU 淘汰 |
| **大图分片加载** | 超大图（地图/长图）用 `react-native-image-zoom` 分片渲染 |
| **GIF 替代** | GIF 内存极高（每帧一张位图），用 Lottie 或 WebP 动画替代 |

---

## 工程化

| 环节 | 做法 |
|------|------|
| **构建时** | CI 自动检测新增图片大小（> 100KB 告警）、自动转 WebP |
| **CDN** | 图片上 CDN + 按设备 DPR 请求对应尺寸 |
| **缓存策略** | URL 带 hash → 强缓存（immutable）；内容变了换 URL |
| **本地图片** | 小图（< 5KB）base64 内联；大图走 CDN 不打包 |
| **Asset Catalog（iOS）** | 图片放 xcassets，系统自动按设备下发 @2x/@3x |
