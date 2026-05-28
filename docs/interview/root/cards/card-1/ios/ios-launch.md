# iOS 启动优化

## Android vs iOS 对照

| 维度 | Android | iOS |
|------|---------|-----|
| 启动链路 | Application.onCreate → Activity → RN 引擎 → Bundle | main() → AppDelegate → RN 引擎 → Bundle |
| 预热引擎 | Application.onCreate 延迟创建 ReactInstanceManager | AppDelegate 中提前调用 `[bridge start]` |
| 预请求 | OkHttp 异步请求 + 内存缓存 | NSURLSession 异步请求 + 内存缓存 |
| 启动测量 | `adb shell am start -W` | Instruments → App Launch |
| 系统要求 | 无硬性限制 | Apple 要求 main() → 首帧 < 400ms（否则可能被 watchdog 杀） |

---

## iOS 启动链路

```
main()
  → UIApplicationMain
  → AppDelegate.didFinishLaunchingWithOptions   ← 最早可控时机
    ├── 初始化 RN Bridge / ReactInstanceManager
    ├── 预请求首屏数据（NSURLSession）
    └── 注册 TurboModule
  → RootViewController 加载
  → RN Bundle 加载 + JS 执行
  → 首帧渲染
```

## iOS 特有优化

| 手段 | 原理 | 效果 |
|------|------|------|
| **减少 +load 方法** | +load 在 main() 前执行，阻塞启动 | 改用 +initialize（懒加载） |
| **减少动态库数量** | dyld 加载每个 .dylib 有开销 | 合并小库、用静态链接 |
| **Pre-main 优化** | 减少 ObjC 类数量、减少 Category | 启动前阶段 -50~100ms |
| **RN 引擎预热** | AppDelegate 中提前初始化 Bridge | 用户进入 RN 页面时引擎已就绪 |
| **Hermes 预编译** | .hbc 字节码（和 Android 一样） | JS 解析时间 -50~70% |

## 预请求（iOS 版）

```objc
// AppDelegate.m
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
  // 启动时立即发预请求（和 RN 引擎初始化并行）
  [[PrefetchManager shared] prefetchDataForRoute:@"/home" params:@{}];
  
  // 初始化 RN
  self.bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:options];
  // ...
}
```

```objc
// PrefetchManager.m
@implementation PrefetchManager

- (void)prefetchDataForRoute:(NSString *)route params:(NSDictionary *)params {
  NSString *url = [self apiUrlForRoute:route];
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
    dataTaskWithURL:[NSURL URLWithString:url]
    completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      if (data && !error) {
        self.cache[route] = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      }
    }];
  [task resume];
}

@end
```

## 测量工具

| 工具 | 用途 |
|------|------|
| Xcode Instruments → App Launch | 测量 pre-main + post-main 时间 |
| `DYLD_PRINT_STATISTICS=1` | 环境变量，打印 dyld 加载耗时 |
| MetricKit | 线上采集启动时间（iOS 13+） |
| 自埋点 | AppDelegate 开始 → 首帧回调的时间差 |
