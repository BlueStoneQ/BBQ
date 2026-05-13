# React Native 实战手册（面向沟通 · 快速回忆）

> 不是科普，是"好久没写 RN 了，快速回忆怎么干活"的参考。
> 基于 RN 0.76+（新架构默认开启），2025-2026 最新实践。

---

## 目录

- [一、项目目录结构](#一项目目录结构)
- [二、构建与打包](#二构建与打包)
- [三、Native Module / TurboModule 开发](#三native-module--turbomodule-开发)
- [四、业务模块最佳实践](#四业务模块最佳实践)
- [五、性能优化实战](#五性能优化实战)
- [六、常见坑点与解决](#六常见坑点与解决)
- [七、高频追问](#七高频追问)

---

## 一、项目目录结构

### 1.1 RN 项目根目录（0.76+）

```
my-app/
├── android/                ← Android 原生工程
│   ├── app/
│   │   ├── src/main/java/  ← Native Module / TurboModule 代码
│   │   ├── src/main/res/   ← 原生资源
│   │   └── build.gradle    ← App 级构建配置
│   ├── build.gradle        ← 项目级构建配置
│   └── settings.gradle     ← 模块声明
├── ios/                    ← iOS 原生工程
│   ├── MyApp/
│   └── Podfile             ← CocoaPods 依赖
├── src/                    ← JS/TS 业务代码（自定义）
│   ├── screens/            ← 页面组件
│   ├── components/         ← 通用组件
│   ├── navigation/         ← 路由配置
│   ├── services/           ← 网络请求/API 层
│   ├── stores/             ← 状态管理（Zustand/MobX/Redux）
│   ├── hooks/              ← 自定义 Hooks
│   ├── utils/              ← 工具函数
│   ├── assets/             ← 图片/字体等静态资源
│   └── native-modules/     ← JS 侧 Native Module 接口定义
├── __tests__/              ← 测试
├── app.json                ← App 配置（名称/版本）
├── babel.config.js         ← Babel 配置
├── metro.config.js         ← Metro 打包器配置
├── tsconfig.json           ← TypeScript 配置
├── package.json
└── index.js                ← 入口文件（AppRegistry.registerComponent）
```

### 1.2 各目录职能

| 目录 | 职能 | 关键文件 |
|------|------|---------|
| `android/` | Android 原生壳工程 | `build.gradle`（依赖/版本）、`MainApplication`（模块注册）、`MainActivity` |
| `ios/` | iOS 原生壳工程 | `Podfile`（依赖）、`AppDelegate`（启动配置） |
| `src/screens/` | 页面级组件 | 每个页面一个文件夹（index.tsx + styles + hooks） |
| `src/components/` | 可复用 UI 组件 | 按原子设计分层（atoms/molecules/organisms） |
| `src/navigation/` | 路由 | React Navigation 配置（Stack/Tab/Drawer） |
| `src/services/` | 网络层 | Axios/fetch 封装、API 定义、拦截器 |
| `src/stores/` | 状态管理 | Zustand stores / MobX stores / Redux slices |
| `src/hooks/` | 自定义 Hooks | useAuth / useNetwork / usePermission 等 |
| `src/native-modules/` | Native Module TS 接口 | Codegen spec 文件（TurboModule 定义） |

### 1.3 企业级项目额外目录

```
src/
├── config/             ← 环境配置（dev/staging/prod）
├── i18n/               ← 国际化（react-intl / i18next）
├── theme/              ← 主题（颜色/字体/间距 token）
├── types/              ← 全局 TS 类型定义
├── constants/          ← 常量
└── modules/            ← 按业务模块拆分（feature-based）
    ├── auth/
    ├── home/
    ├── profile/
    └── settings/
```

---

## 二、构建与打包

### 2.1 Metro Bundler

RN 的 JS 打包器（类似 Webpack 但专为 RN 优化）。

```bash
# 启动 Metro dev server
npx react-native start

# 打 release bundle（Android）
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

**Metro 配置要点**（`metro.config.js`）：
- `resolver.sourceExts`：支持的文件扩展名
- `transformer`：Babel 转换配置
- `serializer`：Bundle 序列化（分包在这里做）

### 2.2 Android 构建

```bash
# Debug APK
cd android && ./gradlew assembleDebug

# Release APK
cd android && ./gradlew assembleRelease

# Release AAB（Google Play）
cd android && ./gradlew bundleRelease
```

**关键 Gradle 配置**（`android/app/build.gradle`）：
```groovy
android {
    defaultConfig {
        minSdkVersion 23
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    buildTypes {
        release {
            minifyEnabled true          // 开启 R8
            shrinkResources true        // 移除无用资源
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
    // 新架构开关（0.76+ 默认 true）
    newArchEnabled = true
}
```

### 2.3 iOS 构建

```bash
cd ios && pod install
npx react-native run-ios --configuration Release

# 或 Xcode Archive → Export IPA
```

### 2.4 环境管理

```bash
# react-native-config 管理多环境
# .env.development / .env.staging / .env.production
ENVFILE=.env.staging npx react-native run-android
```

---

## 三、Native Module / TurboModule 开发

### 3.1 新架构 TurboModule 开发流程（0.76+）

**核心变化**：旧的 `@ReactMethod` 仍然兼容，但新项目应该用 TurboModule。

#### Step 1：定义 Spec（TypeScript）

```typescript
// src/native-modules/NativeDeviceInfo.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getDeviceModel(): string;           // 同步方法
  getBatteryLevel(): Promise<number>; // 异步方法
  getIPAddress(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeDeviceInfo');
```

#### Step 2：运行 Codegen

```bash
# Codegen 根据 Spec 自动生成 Native 接口代码
cd android && ./gradlew generateCodegenArtifactsFromSchema
```

生成的文件在 `android/app/build/generated/source/codegen/`

#### Step 3：实现 Android 端（Kotlin）

```kotlin
// android/app/src/main/java/com/myapp/NativeDeviceInfoModule.kt
package com.myapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.myapp.codegen.NativeDeviceInfoSpec  // Codegen 生成的接口

class NativeDeviceInfoModule(reactContext: ReactApplicationContext) 
    : NativeDeviceInfoSpec(reactContext) {

    override fun getName() = "NativeDeviceInfo"

    override fun getDeviceModel(): String {
        return android.os.Build.MODEL
    }

    override fun getBatteryLevel(promise: Promise) {
        // 获取电量...
        promise.resolve(batteryLevel)
    }

    override fun getIPAddress(promise: Promise) {
        // 获取 IP...
        promise.resolve(ip)
    }
}
```

#### Step 4：注册 Package

```kotlin
// android/app/src/main/java/com/myapp/NativeDeviceInfoPackage.kt
package com.myapp

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeDeviceInfoPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == "NativeDeviceInfo") {
            NativeDeviceInfoModule(reactContext)
        } else null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        // ...
    }
}
```

#### Step 5：在 MainApplication 中注册

```kotlin
override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages.toMutableList()
    packages.add(NativeDeviceInfoPackage())
    return packages
}
```

#### Step 6：JS 侧调用

```typescript
import NativeDeviceInfo from './native-modules/NativeDeviceInfo';

const model = NativeDeviceInfo.getDeviceModel(); // 同步！
const battery = await NativeDeviceInfo.getBatteryLevel(); // 异步
```

### 3.2 旧架构 Native Module（兼容模式）

```kotlin
// 旧写法，0.76+ 仍然兼容
class OldModule(reactContext: ReactApplicationContext) 
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OldModule"

    @ReactMethod
    fun doSomething(param: String, promise: Promise) {
        promise.resolve("result")
    }
}
```

### 3.3 Native UI Component（Fabric）

当需要在 RN 中使用原生 View 时：

```kotlin
// Android 端：自定义 ViewManager
class MyCustomViewManager : SimpleViewManager<MyCustomView>() {
    override fun getName() = "MyCustomView"
    override fun createViewInstance(context: ThemedReactContext) = MyCustomView(context)

    @ReactProp(name = "color")
    fun setColor(view: MyCustomView, color: String) {
        view.setBackgroundColor(Color.parseColor(color))
    }
}
```

```typescript
// JS 端使用
import { requireNativeComponent } from 'react-native';
const MyCustomView = requireNativeComponent('MyCustomView');

<MyCustomView color="#ff0000" style={{ width: 100, height: 100 }} />
```

### 3.4 关键区别总结

| 维度 | 旧 Native Module | 新 TurboModule |
|------|-----------------|----------------|
| 定义 | 无 Spec | TypeScript Spec + Codegen |
| 加载 | 启动时全量注册 | 懒加载（首次访问时） |
| 通信 | Bridge（异步JSON） | JSI（同步/异步可选） |
| 类型安全 | 运行时 | 编译时（Codegen） |
| 同步方法 | 不支持 | 支持 |
| 兼容性 | 0.76+ 仍可用 | 推荐新项目使用 |

---

## 四、业务模块最佳实践

### 4.1 网络请求模块

```typescript
// services/api.ts
import axios, { AxiosInstance } from 'axios';
import { getToken, refreshToken } from './auth';

const api: AxiosInstance = axios.create({
  baseURL: Config.API_URL,
  timeout: 10000,
});

// 请求拦截：自动加 token
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：401 自动刷新 token
api.interceptors.response.use(
  response => response.data,
  async error => {
    if (error.response?.status === 401) {
      await refreshToken();
      return api(error.config); // 重试
    }
    return Promise.reject(error);
  }
);
```

**最佳实践**：
- 统一错误处理（Toast/重试/降级）
- 请求取消（AbortController / CancelToken）
- 离线队列（网络恢复后自动重发）
- 请求去重（相同请求合并）

### 4.2 持久化模块

```typescript
// 推荐：react-native-mmkv（比 AsyncStorage 快 30x）
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

// 同步读写（不需要 await！）
storage.set('user.token', 'xxx');
const token = storage.getString('user.token');

// 加密存储
const secureStorage = new MMKV({ id: 'secure', encryptionKey: 'my-key' });
```

| 方案 | 速度 | 同步 | 加密 | 适用场景 |
|------|------|------|------|---------|
| MMKV | ⭐⭐⭐⭐⭐ | ✅ | ✅ | 首选，替代 AsyncStorage |
| AsyncStorage | ⭐⭐ | ❌ | ❌ | 简单 KV，兼容旧项目 |
| SQLite (expo-sqlite) | ⭐⭐⭐ | ❌ | ✅ | 结构化数据/复杂查询 |
| Keychain/Keystore | ⭐⭐⭐ | ❌ | ✅ | 敏感凭证（token/密码） |

### 4.3 列表模块（FlatList / FlashList）

**FlatList 优化清单**：

```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  // 性能关键配置
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  windowSize={5}                    // 渲染窗口（默认21太大）
  maxToRenderPerBatch={10}          // 每批渲染数量
  initialNumToRender={10}           // 首屏渲染数量
  removeClippedSubviews={true}      // 移除屏幕外 View（Android）
  updateCellsBatchingPeriod={50}    // 批量更新间隔
/>
```

**renderItem 优化**：
```typescript
// ❌ 错误：每次渲染创建新函数/对象
renderItem={({ item }) => <Item onPress={() => handlePress(item.id)} />}

// ✅ 正确：memo + useCallback
const MemoItem = React.memo(({ item, onPress }) => (
  <Pressable onPress={onPress}><Text>{item.title}</Text></Pressable>
));

const renderItem = useCallback(({ item }) => (
  <MemoItem item={item} onPress={() => handlePress(item.id)} />
), [handlePress]);
```

**FlashList（替代 FlatList，Shopify 出品）**：
```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={80}  // 必须提供！
/>
// 比 FlatList 快 5-10x，内存占用更低
```

### 4.4 相机模块

```typescript
// react-native-vision-camera（推荐，替代 react-native-camera）
import { Camera, useCameraDevice } from 'react-native-vision-camera';

function CameraScreen() {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);

  const takePhoto = async () => {
    const photo = await camera.current?.takePhoto({
      qualityPrioritization: 'speed',
      flash: 'auto',
    });
    // photo.path → 本地文件路径
  };

  return <Camera ref={camera} device={device} isActive={true} photo={true} />;
}
```

**坑点**：
- 权限处理：Android 13+ 细粒度权限（READ_MEDIA_IMAGES vs READ_EXTERNAL_STORAGE）
- 前后台切换：`isActive` 必须在后台设为 false，否则 crash
- 性能：高分辨率拍照时 UI 线程可能卡顿，用 `qualityPrioritization: 'speed'`

### 4.5 导航模块（React Navigation 7.x）

```typescript
// navigation/index.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

// 类型安全的路由参数
type RootStackParamList = {
  Home: undefined;
  Detail: { id: string };
  Profile: { userId: string };
};

function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**最佳实践**：
- 用 `createNativeStackNavigator`（原生栈，性能远好于 JS 栈）
- Deep Linking 配置（`linking` prop）
- 路由守卫（未登录跳登录页）
- 页面懒加载（`React.lazy` + `Suspense`）

---

## 五、性能优化实战

### 5.1 启动优化

| 手段 | 效果 | 实现 |
|------|------|------|
| Hermes 引擎 | 启动快 30-50% | 默认开启（0.70+） |
| Hermes 字节码预编译 | 减少 JS 解析时间 | Release 自动生效 |
| TurboModule 懒加载 | 减少启动注册开销 | 新架构默认 |
| 首屏最小化渲染 | 减少首帧 JS 执行 | 延迟加载非首屏模块 |
| Native Splash Screen | 感知启动快 | react-native-bootsplash |
| Bundle 预加载 | RN 容器预热 | 提前创建 ReactInstanceManager |

### 5.2 渲染优化

| 手段 | 场景 | 实现 |
|------|------|------|
| `React.memo` | 避免不必要重渲染 | 包裹纯展示组件 |
| `useMemo` / `useCallback` | 避免引用变化触发子组件重渲染 | 计算结果/回调函数缓存 |
| `InteractionManager.runAfterInteractions` | 延迟非关键任务 | 动画结束后再执行重计算 |
| Reanimated 3 | 动画不经过 JS 线程 | worklet 在 UI 线程直接执行 |
| `removeClippedSubviews` | 长列表内存 | 移除屏幕外 View |

### 5.3 内存优化

| 问题 | 原因 | 解决 |
|------|------|------|
| 图片内存爆炸 | 大图未压缩直接渲染 | `react-native-fast-image` + resize |
| 列表内存泄漏 | 未清理订阅/定时器 | useEffect return cleanup |
| 导航栈堆积 | 页面不销毁 | `unmountOnBlur: true` 或手动 reset |
| 闭包引用 | useCallback 捕获大对象 | 依赖数组精确控制 |

### 5.4 包体优化

| 手段 | 效果 |
|------|------|
| Hermes 字节码 | JS Bundle 体积减小 |
| ProGuard/R8 | Java 代码压缩 |
| 只保留 arm64-v8a | 去掉 32 位 .so |
| 图片压缩 + WebP | 资源体积减小 |
| 分 Bundle | 按需加载业务代码 |
| App Bundle (AAB) | Google Play 按设备裁剪 |

---

## 六、常见坑点与解决

### 6.1 新架构迁移

| 坑 | 原因 | 解决 |
|----|------|------|
| 第三方库不兼容新架构 | 库未适配 Fabric/TurboModule | 检查 [reactnative.directory](https://reactnative.directory) 兼容性标记 |
| Codegen 类型错误 | Spec 定义和实现不匹配 | 严格按 Codegen 生成的接口实现 |
| 旧 Native Module 仍可用 | RN 内置兼容层 | 不急着迁移，但新模块用 TurboModule |

### 6.2 Android 特有

| 坑 | 原因 | 解决 |
|----|------|------|
| 64K 方法数限制 | DEX 方法数上限 | `multiDexEnabled true` |
| 键盘遮挡输入框 | `windowSoftInputMode` 配置 | `adjustResize` + KeyboardAvoidingView |
| 状态栏沉浸 | 不同 Android 版本 API 不同 | `react-native-bars` 或 `StatusBar` translucent |
| 权限运行时申请 | Android 6.0+ | `PermissionsAndroid` API + 降级处理 |
| 后台杀进程恢复 | Activity 重建但 JS 状态丢失 | 持久化关键状态 + 重新初始化检测 |

### 6.3 iOS 特有

| 坑 | 原因 | 解决 |
|----|------|------|
| Flipper 编译慢 | 调试工具依赖重 | 生产构建禁用 / 用 React Native DevTools 替代 |
| CocoaPods 版本冲突 | 依赖树复杂 | `pod deintegrate` + `pod install` 重来 |
| 推送证书 | APNs 配置复杂 | 用 Firebase Cloud Messaging 统一 |

### 6.4 跨平台通用

| 坑 | 原因 | 解决 |
|----|------|------|
| 热更新后白屏 | Bundle 加载失败 | 回滚机制 + 错误边界 |
| 深层嵌套导航 | 内存堆积 | 扁平化路由 + reset 导航栈 |
| 图片闪烁 | 网络图片无缓存 | `react-native-fast-image`（原生缓存） |
| 手势冲突 | ScrollView 内嵌可拖拽组件 | `react-native-gesture-handler` + simultaneousHandlers |
| 字体不一致 | 平台默认字体不同 | 自定义字体统一 |

---

## 七、高频追问

### Q: 新架构和旧架构的核心区别？一句话？

旧架构通过异步 JSON Bridge 通信（慢、不安全），新架构通过 JSI 直接同步调用 C++ 层（快、类型安全）。

### Q: TurboModule 和旧 Native Module 能共存吗？

能。RN 0.76+ 内置兼容层，旧 `@ReactMethod` 模块自动走旧 Bridge 路径。但新模块建议直接用 TurboModule。

### Q: 你怎么做 RN 性能优化？

分三层：
1. **JS 层**：memo/useCallback 减少重渲染、FlashList 替代 FlatList、InteractionManager 延迟任务
2. **Bridge/通信层**：TurboModule 减少序列化、Reanimated worklet 动画不过 JS 线程
3. **Native 层**：Hermes 预编译、图片原生缓存、removeClippedSubviews

### Q: 分 Bundle 怎么做？

Metro 配置多 entry point → 公共依赖提取为 Common Bundle → 业务代码独立打包 → 运行时按路由动态加载对应 Bundle → 版本独立管理和灰度。

### Q: RN 和 Native 怎么混合开发？

1. **RN 调 Native**：TurboModule（逻辑）/ Fabric Component（UI）
2. **Native 嵌 RN**：创建 `ReactRootView` 嵌入 Activity/Fragment
3. **RN 嵌 Native**：`requireNativeComponent` 包装原生 View
4. **通信**：事件（NativeEventEmitter）/ 直接调用（TurboModule）/ 共享存储（MMKV）

### Q: 你用过哪些 RN 生态库？

| 类别 | 库 |
|------|-----|
| 导航 | React Navigation 7 (native-stack) |
| 状态 | Zustand / MobX / Redux Toolkit |
| 网络 | Axios + React Query / SWR |
| 存储 | MMKV / expo-sqlite |
| 动画 | Reanimated 3 + Gesture Handler |
| 列表 | FlashList (Shopify) |
| 图片 | FastImage |
| 相机 | Vision Camera |
| 推送 | Firebase Cloud Messaging |
| 热更新 | CodePush / 自建方案 |
| 调试 | React Native DevTools / Flipper |
