> 每个文件都加上详细注释，讲清原理、本质和语法。
>
> RN 新架构的 TurboModule 底层必须经过 ObjC++（因为 C++ JSI 绑定需要 ObjC++ 桥接）。纯 Swift 不能直接写 TurboModule——需要 Swift + ObjC++ 桥接文件配合。所以目前 TurboModule 推荐纯 ObjC++ 写（你文档 rn-turbomodule-ios.md 里的版本一），Swift 是可选但多一层桥接开销

## 目录

- [前置：TypeScript Spec](#前置typescript-spec)
- [版本一：纯 OC++（推荐）](#版本一纯-oc推荐)
- [版本二：Swift + 桥接](#版本二swift--桥接)
- [OC 语法快速教学](#oc-语法快速教学从-swiftts-视角)
- [核心本质总结](#核心本质总结)

---

## 前置：TypeScript Spec

```typescript
// src/specs/NativeCalculator.ts

// TurboModule 是 RN 新架构的接口标记
// 作用：告诉 Codegen 工具，这个接口需要生成 C++ 绑定代码
import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
import { TurboModuleRegistry } from 'react-native';

// Spec 接口定义：JS 侧调用什么，Native 侧就要实现什么
// 这是 JS 和 Native 之间的"契约"
export interface Spec extends TurboModule {
  // 同步方法：JS 调用后直接返回结果，阻塞 JS 线程
  add(a: number, b: number): number;
  
  // 同步方法
  getDeviceModel(): string;
  
  // 异步方法：返回 Promise，不阻塞 JS 线程
  fetchFromNetwork(url: string): Promise<string>;
}

// getEnforcing：强制注册，如果 Native 侧没实现会红屏报错
// 'NativeCalculator' 是模块名，必须和 Native 侧 RCT_EXPORT_MODULE 的参数一致
export default TurboModuleRegistry.getEnforcing<Spec>('NativeCalculator');
```

---

## 版本一：纯 OC++（推荐）

### NativeCalculator.h

```objc
// .h 文件 = 头文件（Header），只声明，不实现
// 作用：告诉编译器"这个类存在，有哪些方法和属性"
// 类比：TypeScript 的 .d.ts 声明文件

// #import = 导入其他头文件，和 C 的 #include 类似，但自动去重
// <ReactCommon/RCTTurboModule.h> 用尖括号 = 系统/库头文件
// "NativeCalculator.h" 用引号 = 项目自己的头文件
#import <ReactCommon/RCTTurboModule.h>

// @interface = 声明一个类，类似 Swift 的 class 或 TS 的 interface
// : NSObject = 继承 NSObject，OC 所有类都必须继承 NSObject（获得内存管理、Runtime 能力）
// <RCTBridgeModule, RCTTurboModule> = 遵循两个协议（Protocol），类似 TS 的 implements
// RCTBridgeModule：旧架构模块标记，RN 0.60+ 需要
// RCTTurboModule：新架构模块标记，声明"我是 JSI 模块"
@interface NativeCalculator : NSObject <RCTBridgeModule, RCTTurboModule>

// 注意：.h 里不写方法实现，只声明类继承和协议遵循
// 具体方法在 .mm 里用 RCT_EXPORT_METHOD 宏注册

@end
```

### NativeCalculator.mm

```objc
// .mm 文件 = Objective-C++ 源文件
// 本质：编译器用 C++ 编译器处理这个文件，所以可以同时写 OC 和 C++ 代码
// 如果改成 .m，编译器用 OC 编译器，遇到 C++ 代码会报错

// 导入自己的头文件
#import "NativeCalculator.h"

// Codegen 自动生成：NativeCalculatorSpecJSI.h
// 这个文件是 C++ 的，包含：
// 1. NativeCalculatorSpecJSI 类定义（继承 ObjCTurboModule）
// 2. 方法签名到 C++ 函数的映射
// 3. JSI 绑定代码（JS 调用如何转成 C++ 函数调用）
// 注意：这个文件不需要手写，yarn codegen 自动生成
#import <ReactCommon/NativeCalculatorSpecJSI.h>

// UIKit 是 iOS 系统框架，提供 UIDevice 等类
#import <UIKit/UIKit.h>

// @implementation = 类实现开始，类似 Swift 的 class {} 或 TS 的 class 实现
// 和 @interface 配对，必须同名
@implementation NativeCalculator

// RCT_EXPORT_MODULE('name') 是一个宏（Macro）
// 本质展开后 ≈ 一个 +load 方法，App 启动时自动注册这个类到模块表
// 参数 'NativeCalculator' 必须和 JS 侧 TurboModuleRegistry.getEnforcing('xxx') 一致
// 如果不写参数，默认用类名 NativeCalculator
RCT_EXPORT_MODULE(NativeCalculator);

// ============================================
// 核心方法：getTurboModule
// ============================================
// 作用：返回 C++ TurboModule 实例，让 JSI 运行时知道这个模块的存在
// 调用时机：JS 第一次调用 NativeModules.NativeCalculator.xxx 时
// 参数 params：包含 JS 运行时、Executor、Module 注册表等上下文

// - 开头 = 实例方法（类似 Swift 的 func，没有 static）
// (std::shared_ptr<facebook::react::TurboModule>) = 返回类型
//   std::shared_ptr = C++ 智能指针（自动引用计数，类似 Swift ARC）
//   facebook::react::TurboModule = C++ 命名空间 + 类名
// getTurboModule: = 方法名，冒号表示有参数
// (const facebook::react::ObjCTurboModule::InitParams &)params
//   const = 只读
//   & = 引用传递（不拷贝，类似 Swift inout）
//   params = 参数名

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    
    // std::make_shared = C++ 创建 shared_ptr 的方式
    // NativeCalculatorSpecJSI(params) = 调用构造函数，传入参数
    // 这个对象负责：接收 JSI 调用 → 分发到对应的 OC 方法
    return std::make_shared<facebook::react::NativeCalculatorSpecJSI>(params);
}

// ============================================
// RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD = 同步方法宏
// ============================================
// 本质：把这个 OC 方法注册到 Codegen 生成的映射表里
// JS 调用时，JSI 直接同步执行，返回值立即传给 JS
// 注意：会阻塞 JS 线程，只用于 <1ms 的计算

// 方法名展开后：JS 侧 add(a, b) → OC 侧 add:(double)a b:(double)b
// OC 命名规则：方法名 + 参数标签，用冒号分隔
// add:b: = 完整方法名，类似 Swift 的 add(a:b:)

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(add:(double)a b:(double)b) {
    // @(value) = OC 的装箱语法，把 double 转成 NSNumber（对象）
    // 因为 JSI 返回需要是对象类型
    return @(a + b);
}

// 同步方法：获取设备型号
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getDeviceModel) {
    // [[UIDevice currentDevice] model] = OC 消息发送语法
    // [对象 方法] = 调用方法，本质编译成 objc_msgSend
    // UIDevice = iOS 系统类，代表当前设备
    // currentDevice = 类方法，返回单例
    // model = 实例方法，返回 @"iPhone" 或 @"iPad" 等
    return [[UIDevice currentDevice] model];
}

// ============================================
// RCT_EXPORT_METHOD = 异步方法宏
// ============================================
// 本质：方法在后台线程执行，通过 Promise 回调返回结果
// 参数 resolve = 成功回调，reject = 失败回调
// 这两个是 Block（OC 的闭包），类似 Swift 的闭包或 JS 的 callback

RCT_EXPORT_METHOD(fetchFromNetwork:(NSString *)url
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    // NSString → NSURL 转换
    // OC 中对象用指针表示（*），NSString * = 指向 NSString 对象的指针
    NSURL *nsUrl = [NSURL URLWithString:url];
    
    // NSURLSession = iOS 原生网络请求类，类似 JS 的 fetch
    // sharedSession = 单例方法
    // dataTaskWithURL:completionHandler: = 创建异步下载任务
    // completionHandler: 后面的 ^{} 是 Block 语法（OC 闭包）
    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:nsUrl
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            // ^ = Block 开始标志
            // (NSData *data, NSURLResponse *response, NSError *error) = 参数列表
            // {} = Block 体
            
            // error 存在说明请求失败
            if (error) {
                // reject 三个参数：errorCode, message, error 对象
                reject(@"NETWORK_ERROR", error.localizedDescription, error);
                return;
            }
            
            // NSData → NSString 转换
            // initWithData:encoding: = 用 UTF-8 编码解码二进制数据
            NSString *result = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            
            // resolve = 成功回调，参数传给 JS 的 Promise.resolve()
            // ?: 是 nil 合并运算符，如果 result 为 nil 返回 @""
            resolve(result ?: @"");
        }];
    
    // [task resume] = 启动网络请求
    // 注意：dataTask 创建后默认挂起，必须调用 resume
    [task resume];
}

@end
```

---

## 版本二：Swift + 桥接

### CalculatorSwift.swift

```swift
// Swift 文件，写业务逻辑
// import Foundation = 基础框架（String、Data、URL 等）
// 不需要 import UIKit，因为 UIDevice 在 Foundation 中... 不对，UIDevice 在 UIKit
// 实际：Foundation 包含基础类型，UIKit 包含 UI 相关

import Foundation

// ============================================
// @objc = 暴露给 Objective-C 运行时
// ============================================
// 本质：告诉编译器，这个类/方法需要生成 ObjC 的消息发送表
// 没有 @objc，OC 代码无法调用这个 Swift 类
// 注意：@objc 类必须继承 NSObject（获得 ObjC 运行时能力）

// public = 访问级别，让其他模块（包括自动生成的桥接头）可见
// 默认 internal（模块内可见），必须改成 public 或 @objc public

@objc public class CalculatorSwift: NSObject {
    
    // ============================================
    // 同步方法：加法
    // ============================================
    // @objc = 暴露给 OC，否则 OC 调用不到
    // public = 桥接头需要访问
    
    // Swift 参数标签语法：add(a:b:) = 外部名 a, b
    // OC 桥接后方法名变成：addWithA:b:（自动转换）
    // 这是因为 OC 方法名拼接规则：方法名 + With + 第一个参数大写 + 第二个参数标签
    
    @objc public func add(a: Double, b: Double) -> Double {
        return a + b
    }
    
    // ============================================
    // 同步方法：获取设备型号
    // ============================================
    // UIDevice.current = Swift 的类属性访问，类似 OC [UIDevice currentDevice]
    // .model = 实例属性，返回 String
    
    @objc public func getDeviceModel() -> String {
        return UIDevice.current.model
    }
    
    // ============================================
    // 异步方法：网络请求
    // ============================================
    // completion: @escaping (String?, String?) -> Void
    //   @escaping = 闭包逃逸标记，表示闭包可能在函数返回后才执行
    //   (String?, String?) -> Void = 参数类型：两个可选 String，无返回值
    //   第一个 String = 成功结果，第二个 String = 错误信息
    //   为什么不用 Result 类型？因为 OC 桥接不支持 Swift 枚举
    
    @objc public func fetchFromNetwork(url: String, completion: @escaping (String?, String?) -> Void) {
        
        // guard let = 可选绑定，条件不满足执行 else 分支
        // 类似 OC 的 if (url == nil) { return; }
        guard let nsUrl = URL(string: url) else {
            // 调用闭包，返回错误
            completion(nil, "Invalid URL")
            return
        }
        
        // URLSession.shared = 单例，类似 OC [NSURLSession sharedSession]
        // .dataTask(with:completionHandler:) = 创建异步任务
        // completionHandler 是尾随闭包（Trailing Closure），函数最后一个参数可以写在括号外
        
        URLSession.shared.dataTask(with: nsUrl) { data, response, error in
            // 闭包参数：data（二进制数据）、response（HTTP 响应）、error（错误）
            
            // if let = 可选绑定，error 有值时执行
            if let error = error {
                // error.localizedDescription = 用户可读的错误描述
                completion(nil, error.localizedDescription)
                return
            }
            
            // String(data:encoding:) = 初始化方法，NSData → String
            // ?? = nil 合并运算符，如果左边为 nil 返回右边默认值
            let result = String(data: data ?? Data(), encoding: .utf8) ?? ""
            
            // 成功回调
            completion(result, nil)
        }.resume()  // 启动任务，类似 OC [task resume]
    }
}
```

### NativeCalculator.h（和纯 OC++ 版一样）

```objc
// 头文件不变，因为对外暴露的接口相同
#import <ReactCommon/RCTTurboModule.h>

@interface NativeCalculator : NSObject <RCTBridgeModule, RCTTurboModule>
@end
```

### NativeCalculator.mm（Swift 桥接版）

```objc
#import "NativeCalculator.h"
#import <ReactCommon/NativeCalculatorSpecJSI.h>

// ============================================
// #import "MyApp-Swift.h" = 桥接头文件
// ============================================
// 这不是手写的！是 Xcode 编译 Swift 时自动生成的
// 作用：把 Swift 的 @objc public 类暴露给 OC
// 生成规则：$(SWIFT_MODULE_NAME)-Swift.h
// 例如项目名 MyApp → MyApp-Swift.h
// 这个头文件包含所有 @objc 标记的 Swift 类的 OC 接口声明

#import "MyApp-Swift.h"

@implementation NativeCalculator

RCT_EXPORT_MODULE(NativeCalculator);

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeCalculatorSpecJSI>(params);
}

// ============================================
// 同步方法：调用 Swift
// ============================================
// [[CalculatorSwift alloc] init] = 创建 Swift 对象
//   alloc = 分配内存（继承自 NSObject 的方法）
//   init = 初始化（Swift 的 init() 对应 OC 的 init）
// [swift addWithA:a b:b] = 调用 Swift 方法
//   注意方法名！Swift 的 add(a:b:) → OC 桥接为 addWithA:b:
//   这是 Swift 编译器自动转换的命名规则

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(add:(double)a b:(double)b) {
    CalculatorSwift *swift = [[CalculatorSwift alloc] init];
    return [swift addWithA:a b:b];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getDeviceModel) {
    CalculatorSwift *swift = [[CalculatorSwift alloc] init];
    return [swift getDeviceModel];
}

// ============================================
// 异步方法：Swift 闭包桥接到 OC Block
// ============================================
// Swift 的 @escaping (String?, String?) -> Void
// 桥接到 OC 后变成：void (^)(NSString * _Nullable, NSString * _Nullable)
// _Nullable = 可为 nil，对应 Swift 的 Optional（String?）

RCT_EXPORT_METHOD(fetchFromNetwork:(NSString *)url
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    
    CalculatorSwift *swift = [[CalculatorSwift alloc] init];
    
    // 调用 Swift 方法，传入 OC Block 作为回调
    // Swift 闭包会自动桥接为 OC Block
    [swift fetchFromNetworkWithUrl:url completion:^(NSString *result, NSString *error) {
        // Block 体，在 Swift 闭包执行完成后调用
        
        if (error) {
            reject(@"NETWORK_ERROR", error, nil);
        } else {
            resolve(result);
        }
    }];
}

@end
```

---

## OC 语法快速教学（从 Swift/TS 视角）

| 概念 | OC 写法 | Swift 对应 | TS 对应 |
|------|---------|-----------|---------|
| **类声明** | `@interface Foo : NSObject` | `class Foo: NSObject` | `class Foo` |
| **类实现** | `@implementation Foo` | `class Foo { }` | `class Foo { }` |
| **方法** | `- (void)foo;` | `func foo()` | `foo(): void` |
| **类方法** | `+ (void)foo;` | `static func foo()` | `static foo(): void` |
| **消息发送** | `[obj method]` | `obj.method()` | `obj.method()` |
| **属性** | `@property (nonatomic) NSString *name;` | `var name: String` | `name: string` |
| **协议** | `<ProtocolName>` | `: ProtocolName` | `implements` |
| **Block（闭包）** | `^(params){ body }` | `{ params in body }` | `(params) => { body }` |
| **nil** | `nil` | `nil` | `null` |
| **空对象** | `NSNull.null` | `NSNull()` | `null` |
| **字符串** | `@"hello"` | `"hello"` | `"hello"` |
| **数组** | `@[@1, @2]` | `[1, 2]` | `[1, 2]` |
| **字典** | `@{@"k": @"v"}` | `["k": "v"]` | `{k: "v"}` |
| **id 类型** | `id` | `Any` | `any` |
| **instancetype** | `instancetype` | `Self` | `this` |

---

## 核心本质总结

| 概念 | 本质 |
|------|------|
| **RCT_EXPORT_MODULE** | 宏展开为 `+load` 方法，App 启动时注册到模块表 |
| **RCT_EXPORT_METHOD** | 宏展开为方法注册代码，把 OC 方法签名和 JS 方法名映射 |
| **RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD** | 同上，但标记为同步执行，不走异步队列 |
| **getTurboModule** | 返回 C++ 对象，让 JSI 运行时有地方分发调用 |
| **JSI** | C++ 共享内存，JS 直接调用 C++ 函数，无序列化 |
| **Codegen** | 读取 TS 接口 → 生成 C++ 头文件 → 编译时类型检查 |
| **@objc** | Swift 编译器生成 ObjC 消息发送表，让 OC 能调用 |
| **MyApp-Swift.h** | Xcode 自动生成，包含所有 @objc 类的 OC 接口声明 |

---

## 一句话

> **TurboModule 的本质是：Codegen 根据 TS 接口生成 C++ 绑定代码，JSI 让 JS 直接调用 C++ 函数，OC++ 的 `.mm` 文件作为适配层把 C++ 调用转成 OC 方法调用。Swift 只能通过 `@objc` + 桥接头参与这个流程，所以 TurboModule 的壳必须是 OC++，Swift 只能写被调用的业务逻辑。**