# 17. 直播与 IM

> 直播推拉流方案、IM 长连接、协议选型、在 Android 中的集成。

## 目录

- [一、直播技术栈](#一直播技术栈)
- [二、IM 技术栈](#二im-技术栈)
- [三、在 Android 中的集成方式](#三在-android-中的集成方式)
- [四、和快应用框架的关系](#四和快应用框架的关系)

---

## 一、直播技术栈

### 直播全链路

```
主播端（采集+编码+推流）
  ↓ RTMP / SRT / WebRTC
CDN（分发）
  ↓ HTTP-FLV / HLS / WebRTC
观众端（拉流+解码+渲染）
```

### 核心协议

| 协议 | 延迟 | 适用场景 | 说明 |
|------|------|---------|------|
| RTMP | 1-3s | 推流（主播端→CDN） | 基于 TCP，稳定 |
| HTTP-FLV | 1-3s | 拉流（CDN→观众） | HTTP 长连接，兼容性好 |
| HLS | 5-30s | 拉流（点播/回放） | 分片 TS，延迟高但兼容最好 |
| WebRTC | <1s | 实时互动（连麦） | P2P/SFU，延迟最低 |
| SRT | 0.5-2s | 推流（替代 RTMP） | 抗丢包，适合弱网 |

### Android 端实现

| 层 | 技术 |
|---|------|
| 采集 | Camera2 API / CameraX |
| 编码 | MediaCodec（硬编码）/ FFmpeg（软编码） |
| 推流 | librtmp / SRT SDK |
| 拉流 | ExoPlayer / IJKPlayer / FFmpeg |
| 渲染 | SurfaceView / TextureView / OpenGL |

### 主流 SDK

| SDK | 厂商 | 特点 |
|-----|------|------|
| 腾讯云 TRTC | 腾讯 | 实时音视频，低延迟 |
| 阿里云直播 SDK | 阿里 | 推拉流一体 |
| 声网 Agora | 声网 | RTC，连麦互动 |
| 七牛直播 SDK | 七牛 | 推拉流 + 连麦 |
| 自研（FFmpeg + WebRTC） | - | 灵活但开发成本高 |

---

## 二、IM 技术栈

### IM 核心架构

```
客户端 A ←→ 长连接 ←→ IM 服务器 ←→ 长连接 ←→ 客户端 B
                         ↕
                    消息存储（MySQL/MongoDB）
                    离线消息队列（Redis/Kafka）
```

### 长连接协议

| 协议 | 说明 | 适用 |
|------|------|------|
| WebSocket | 全双工，基于 HTTP 升级 | Web + 移动端通用 |
| TCP 自定义协议 | 最高效，自定义二进制帧 | 大厂自研 IM |
| MQTT | 轻量级发布/订阅 | IoT + 推送 |
| XMPP | XML 协议，标准但重 | 早期 IM（已过时） |

### Android 端 IM 实现要点

| 问题 | 解决方案 |
|------|---------|
| 保活（后台不被杀） | 前台 Service + 通知 / WorkManager / 厂商推送通道 |
| 断线重连 | 心跳检测 + 指数退避重连 |
| 消息可靠性 | ACK 确认 + 消息序号 + 重发机制 |
| 消息存储 | SQLite/Room 本地存储 + 服务端同步 |
| 推送 | FCM（海外）/ 厂商通道（国内：小米推送/华为推送） |

### 主流 IM SDK

| SDK | 厂商 | 特点 |
|-----|------|------|
| 腾讯云 IM | 腾讯 | 功能全，微信同源技术 |
| 网易云信 | 网易 | 稳定，文档好 |
| 融云 | 融云 | 轻量，集成快 |
| 环信 | 环信 | 老牌 IM SDK |
| 自研 | - | WebSocket + Protobuf |

---

## 三、在 Android 中的集成方式

### 直播 SDK 集成

```groovy
// build.gradle
dependencies {
    implementation 'com.tencent.liteav:LiteAVSDK_TRTC:11.0.0'
}
```

```kotlin
// 推流
val pusher = V2TXLivePusher(context, V2TXLiveDef.V2TXLiveMode.V2TXLiveMode_RTMP)
pusher.setRenderView(surfaceView)
pusher.startCamera(true)
pusher.startPush("rtmp://push.example.com/live/stream1")

// 拉流
val player = V2TXLivePlayer(context)
player.setRenderView(surfaceView)
player.startLivePlay("http://pull.example.com/live/stream1.flv")
```

### IM SDK 集成

```groovy
dependencies {
    implementation 'com.tencent.imsdk:imsdk-plus:7.0.0'
}
```

```kotlin
// 初始化
V2TIMManager.getInstance().initSDK(context, sdkAppID, config)

// 登录
V2TIMManager.getInstance().login(userID, userSig, callback)

// 发消息
val msg = V2TIMManager.getMessageManager().createTextMessage("Hello")
V2TIMManager.getMessageManager().sendMessage(msg, receiverID, null, ...)

// 收消息（监听）
V2TIMManager.getInstance().addSimpleMsgListener(object : V2TIMSimpleMsgListener() {
    override fun onRecvC2CTextMessage(msgID: String, sender: V2TIMUserInfo, text: String) {
        // 收到私聊消息
    }
})
```

### 目录结构（集成后）

```
app/
├── src/main/
│   ├── java/
│   │   ├── live/           ← 直播模块
│   │   │   ├── LiveActivity.kt
│   │   │   ├── LivePusher.kt
│   │   │   └── LivePlayer.kt
│   │   └── im/             ← IM 模块
│   │       ├── ChatActivity.kt
│   │       ├── MessageManager.kt
│   │       └── ConnectionManager.kt
│   └── jniLibs/
│       └── arm64-v8a/
│           ├── libliteavsdk.so    ← 直播 SDK 的 so
│           └── libImSDK.so        ← IM SDK 的 so
└── build.gradle
```

---

## 四、和快应用框架的关系

快应用框架可能需要支持直播和 IM 能力（作为 Feature 暴露给开发者）：

```
JS: system.live.startPush(url)
  ↓ Bridge
Java: LiveFeature.startPush()
  ↓ 调用直播 SDK
推流开始

JS: system.im.sendMessage(to, text)
  ↓ Bridge
Java: IMFeature.sendMessage()
  ↓ 调用 IM SDK
消息发送
```

这些 SDK 通常以 AAR 形式集成，包含 so 库（几十 MB）。这也是为什么 buildForRom 时可能需要裁剪这些模块——直播/IM SDK 的 so 库很大，预装包放不下。

### 架构模式一致

```
快应用框架集成直播：
  JS Feature 接口 → Bridge → Java Feature 实现 → 直播 SDK → 硬件（Camera/Codec）

快应用框架集成 IM：
  JS Feature 接口 → Bridge → Java Feature 实现 → IM SDK → 网络（WebSocket/TCP）
```

和集成相机、网络、存储等 Feature 是同一个模式——框架提供标准 JS 接口，底层对接不同的 Native SDK。
