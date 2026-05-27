# 16. 游戏引擎集成

> Unity/Unreal 在 Android 中的集成方式、目录结构、通信方案。

## 目录

- [一、游戏引擎在 Android 中的本质](#一游戏引擎在-android-中的本质)
- [二、Unity 集成方案](#二unity-集成方案)
- [三、Unreal 集成方案](#三unreal-集成方案)
- [四、通信方案](#四通信方案)
- [五、和快应用框架的类比](#五和快应用框架的类比)

---

## 一、游戏引擎在 Android 中的本质

游戏引擎在 Android 里的集成模式和快应用框架类似——都是在 Android 进程里嵌入一个"外部引擎"：

```
快应用框架：Android 进程 + V8 引擎（执行 JS）+ 原生 View 渲染
Unity 游戏：Android 进程 + Unity 引擎（执行 C#）+ OpenGL/Vulkan 渲染
Unreal 游戏：Android 进程 + UE 引擎（执行 C++/Blueprint）+ OpenGL/Vulkan 渲染
```

核心区别：
- 快应用框架用原生 View 渲染 UI
- 游戏引擎用 GPU 自绘（OpenGL ES / Vulkan），不用 Android View 系统

---

## 二、Unity 集成方案

### 导出 Android 项目结构

Unity 导出 Android 项目后的目录：

```
unity-android-project/
├── launcher/                    ← Android 壳工程（Application 入口）
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/.../MainActivity.java
│   └── build.gradle
├── unityLibrary/                ← Unity 引擎 + 游戏代码
│   ├── src/main/
│   │   ├── assets/              ← 游戏资源（场景/模型/贴图）
│   │   ├── jniLibs/             ← Unity 引擎 so 库
│   │   │   ├── arm64-v8a/
│   │   │   │   ├── libunity.so
│   │   │   │   ├── libil2cpp.so  ← C# 编译成的 Native 代码
│   │   │   │   └── libmain.so
│   │   │   └── armeabi-v7a/
│   │   └── java/.../UnityPlayerActivity.java
│   └── build.gradle
└── settings.gradle
```

### Unity 的运行模式

```
Android Activity
  └── UnityPlayer（SurfaceView）
      └── Unity 引擎（C++ 核心）
          ├── IL2CPP（C# → C++ → Native 执行）
          ├── 渲染管线（OpenGL ES / Vulkan）
          ├── 物理引擎
          ├── 音频引擎
          └── 脚本系统（执行游戏逻辑）
```

Unity 占据整个 SurfaceView，自己管理渲染循环（Game Loop），不使用 Android 的 View 系统。

### 嵌入模式（Unity as a Library）

Unity 2019.3+ 支持作为库嵌入到现有 Android App 中：

```
你的 App
├── 原生 Activity（正常 Android UI）
└── Unity Activity（游戏画面）
    └── UnityPlayer
```

可以在原生页面和 Unity 页面之间切换。

---

## 三、Unreal 集成方案

### 目录结构

```
unreal-android-project/
├── app/
│   ├── src/main/
│   │   ├── java/.../GameActivity.java
│   │   └── jniLibs/
│   │       └── arm64-v8a/
│   │           ├── libUE4.so          ← UE 引擎核心
│   │           └── libMyGame.so       ← 游戏逻辑
│   └── assets/
│       └── *.pak                      ← 打包的游戏资源
└── build.gradle
```

### Unreal 的特点

- 纯 C++ 引擎，不需要虚拟机
- 渲染质量最高（支持 Vulkan、光线追踪）
- 包体最大（引擎 so + 资源 pak 通常 100MB+）
- 适合 3A 级手游

---

## 四、通信方案

### Android ↔ 游戏引擎通信

| 方向 | Unity (C#) | Unreal (C++) |
|------|-----------|-------------|
| Android → 引擎 | `UnityPlayer.UnitySendMessage()` | JNI 直接调用 |
| 引擎 → Android | `AndroidJavaObject` 调用 Java | JNI 调用 Java |

### Unity 通信示例

```java
// Android 调用 Unity（发消息给 Unity 的 GameObject）
UnityPlayer.UnitySendMessage("GameManager", "OnAndroidEvent", "data");

// Unity 调用 Android（C# 侧）
AndroidJavaObject activity = new AndroidJavaClass("com.unity3d.player.UnityPlayer")
    .GetStatic<AndroidJavaObject>("currentActivity");
activity.Call("showToast", "Hello from Unity");
```

### 类比快应用框架

| | 快应用框架 | Unity |
|---|---|---|
| 引擎 | V8（JS） | IL2CPP（C#→Native） |
| 通信方式 | J2V8 同步 Bridge | UnitySendMessage / AndroidJavaObject |
| 渲染 | Android View | OpenGL/Vulkan SurfaceView |
| 包体 | ~60MB（优化后） | ~100-500MB |

---

## 五、和快应用框架的类比

两者的架构模式高度相似：

```
快应用框架：
  Android 壳 → V8 引擎 → JS 业务代码 → Bridge → 原生 View 渲染

Unity 游戏：
  Android 壳 → Unity 引擎 → C# 游戏代码 → JNI → GPU 渲染

共同点：
  - 都是在 Android 进程里嵌入外部引擎
  - 都有"引擎代码"和"业务代码"的分离
  - 都需要 Bridge/JNI 和 Android 原生层通信
  - 都面临包体优化问题（引擎 so 很大）

区别：
  - 快应用用原生 View（系统 UI 一致性好）
  - 游戏用 GPU 自绘（性能好，但不是原生 UI）
```

理解了快应用框架的架构，理解游戏引擎集成就很自然——同一个模式，换了引擎和渲染方式。
