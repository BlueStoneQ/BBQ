# iOS 内存管理（ARC）

> 本质：iOS 用**引用计数**管理内存（和 C++ shared_ptr 一样），不用 GC（和 Android/JS 不同）。
> 结论：对象没人引用 → 立即释放（确定性析构），不存在 GC 停顿。代价是你得处理循环引用。

---

## 目录

- [一句话本质](#一句话本质)
- [ARC vs GC vs 手动管理](#arc-vs-gc-vs-手动管理)
- [引用计数怎么工作的](#引用计数怎么工作的)
- [循环引用（Retain Cycle）](#循环引用retain-cycle)
- [weak 和 unowned](#weak-和-unowned)
- [Autorelease Pool](#autorelease-pool)
- [在 RN/跨端中的体现](#在-rn跨端中的体现)
- [Q&A](#qa)

---

## 一句话本质

```
iOS (ARC)：每个对象有一个引用计数器，+1/-1，归零立即释放
Android (GC)：垃圾回收器定期扫描，找到没人引用的对象批量回收
JS (GC)：和 Android 类似，V8/Hermes 的 GC 自动回收
C++ (手动/智能指针)：手动 new/delete，或用 shared_ptr（引用计数，和 ARC 本质相同）
```

**ARC = Automatic Reference Counting**（自动引用计数）。"自动"是指编译器自动插入 retain/release，你不用手写。

---

## ARC vs GC vs 手动管理

| 维度 | iOS (ARC) | Android/JS (GC) | C++ (手动) |
|------|-----------|-----------------|------------|
| 机制 | 引用计数（编译时插入 retain/release） | 可达性分析 + 标记清除/分代回收 | 手动 new/delete |
| 释放时机 | **确定性**：引用归零立即释放 | **不确定**：GC 什么时候跑由运行时决定 | 确定性：你手动调 delete |
| GC 停顿 | ❌ 没有（不存在 STW） | ✅ 有（GC 暂停所有线程，虽然现代 GC 很短） | ❌ 没有 |
| 循环引用 | ⚠️ 你要自己处理（weak） | ✅ GC 能处理（可达性分析能发现孤岛） | ⚠️ shared_ptr 也有这个问题 |
| 内存峰值 | 低（用完立即释放） | 高（等 GC 来清，有延迟） | 取决于你 |
| 心智负担 | 中（要想循环引用） | 低（GC 兜底） | 高（忘 delete = 泄漏） |

**类比 C++**：ARC ≈ 所有对象都用 `shared_ptr` 管理，编译器帮你自动写 `make_shared` 和 `reset`。循环引用的处理也一样：C++ 用 `weak_ptr`，iOS 用 `weak`。

---

## 引用计数怎么工作的

```swift
// Swift 代码
var a = MyObject()  // retainCount = 1（a 持有）
var b = a           // retainCount = 2（a + b 持有）
b = nil             // retainCount = 1（只有 a 持有）
a = nil             // retainCount = 0 → 立即调用 deinit → 内存释放
```

**编译器在背后做了什么**（ARC 的"Automatic"）：

```
// 你写的代码
var a = MyObject()

// 编译器实际生成的（伪代码）
var a = MyObject()
objc_retain(a)      // 编译器自动插入：引用计数 +1

// 当 a 离开作用域
objc_release(a)     // 编译器自动插入：引用计数 -1 → 归零 → 释放
```

**和 Android 对比**：
```
Android：你 new 了一个对象 → 用完不管 → 等 GC 来回收（不知道什么时候）
iOS：你 new 了一个对象 → 最后一个引用消失 → 立即释放（确定性）
```

---

## 循环引用（Retain Cycle）

ARC 唯一的坑：两个对象互相持有 → 引用计数永远不归零 → 内存泄漏。

```swift
class Parent {
    var child: Child?      // Parent 强引用 Child
}

class Child {
    var parent: Parent?    // Child 强引用 Parent ← 问题在这
}

let p = Parent()
let c = Child()
p.child = c    // p → c（c 的 retainCount = 2）
c.parent = p   // c → p（p 的 retainCount = 2）

// p 和 c 离开作用域后：
// p 的 retainCount = 1（c 还持有它）
// c 的 retainCount = 1（p 还持有它）
// 都不归零 → 永远不释放 → 泄漏！
```

**类比 C++**：和 `shared_ptr` 循环引用完全一样的问题。

**类比 Android**：Android 的 GC 能处理这个——GC 做可达性分析时会发现 p 和 c 组成的"孤岛"从 GC Root 不可达 → 直接回收。ARC 做不到这一点，因为它只数引用数量，不分析可达性。

---

## weak 和 unowned

解决循环引用的两个关键字：

### weak（弱引用）

```swift
class Child {
    weak var parent: Parent?   // weak：不增加引用计数，parent 释放后自动变 nil
}
```

- **不增加引用计数**（和 C++ `weak_ptr` 一样）
- 对象释放后自动置 nil（所以必须是 Optional 类型 `?`）
- 最常用，安全

### unowned（无主引用）

```swift
class Child {
    unowned let parent: Parent  // unowned：不增加引用计数，但不置 nil
}
```

- **不增加引用计数**
- 对象释放后**不置 nil**（访问已释放的 unowned → crash！类似 C++ 悬垂指针）
- 比 weak 少一次 nil 检查开销，但不安全
- 用于"确定对方生命周期比我长"的场景

### 类比

| iOS | C++ | 说明 |
|-----|-----|------|
| 强引用（默认） | `shared_ptr` | 增加引用计数 |
| `weak` | `weak_ptr` | 不增加计数，可安全检查是否已释放 |
| `unowned` | 裸指针 `T*` | 不增加计数，访问已释放 = UB/crash |

### 最常见的循环引用场景 + 解法

| 场景 | 问题 | 解法 |
|------|------|------|
| **闭包捕获 self** | 闭包持有 self，self 持有闭包 | `[weak self] in` |
| delegate 模式 | A 持有 B，B.delegate = A | delegate 声明为 weak |
| 父子对象 | 父持有子，子持有父 | 子对父用 weak |
| Timer | self 持有 timer，timer 回调持有 self | timer invalidate + `[weak self]` |

**闭包捕获 self（最常见）**：

```swift
class ViewController {
    var name = "Hello"
    
    func setup() {
        // ❌ 闭包默认强捕获 self → 循环引用
        networkManager.onComplete = {
            print(self.name)  // 闭包 → self，self → networkManager → 闭包
        }
        
        // ✅ 用 [weak self] 打破循环
        networkManager.onComplete = { [weak self] in
            guard let self = self else { return }  // self 可能已释放
            print(self.name)
        }
    }
}
```

**类比前端**：类似 React useEffect 里的闭包引用问题（虽然 JS 有 GC 不会泄漏，但会导致过期闭包/stale closure）。iOS 这里是真泄漏。

---

## Autorelease Pool

**本质**：延迟释放的一个容器。对象放进去后不立即释放，等 pool 结束时统一释放。

```swift
// 类比前端：就像 setTimeout(() => release(), 0) — 延迟到当前事件循环结束时释放
autoreleasepool {
    for i in 0..<100000 {
        let data = processImage(i)  // 产生大量临时对象
        // 没有 autoreleasepool → 10 万个临时对象堆积到循环结束才释放
        // 有 autoreleasepool → 每次循环结束时释放
    }
}
```

**什么时候需要手写 autoreleasepool？**

大多数时候不需要——RunLoop 每次迭代结束时自动 drain autorelease pool。只有在**循环中产生大量临时对象**时手动加，防止内存峰值过高。

**类比 Android**：Android 没有这个概念，因为 GC 会在合适时机批量回收。iOS 没有 GC，所以需要 autorelease pool 来"攒一批一起释放"。

---

## 在 RN/跨端中的体现

| 场景 | 说明 |
|------|------|
| TurboModule iOS 侧 | ObjC 对象的内存由 ARC 管理，C++ JSI 层持有 ObjC 对象时要注意引用计数 |
| RCTBridge 销毁 | 多实例架构关闭页面时，必须确保 Bridge 所有回调解注册，否则循环引用 → 实例泄漏 |
| Native Module delegate | delegate 必须声明 weak，否则 Module 和 ViewController 循环引用 |
| 闭包回调 | BLE 回调、网络回调如果强捕获 self → ViewController 泄漏 |
| Xcode Instruments → Leaks | 检测 iOS 内存泄漏的工具（对应 Android 的 LeakCanary） |

---

## Q&A

### ARC 有没有性能开销？

有，但极小。每次赋值时 retain/release 是原子操作（`atomic increment/decrement`），在 ARM64 上约 1-2ns。比 GC 的 STW 停顿（几 ms ~ 几十 ms）好得多。

### 为什么 Apple 选 ARC 而不是 GC？

1. **确定性释放**：实时性要求高的场景（动画 60fps）不能容忍 GC 停顿
2. **内存峰值低**：用完立即释放，不像 GC 有延迟
3. **嵌入式/移动设备**：内存有限，不能让 GC 堆积一堆待回收对象
4. Apple 早期（MRC 时代）就是引用计数，ARC 是自然演进

### iOS 怎么检测内存泄漏？

| 工具 | 说明 |
|------|------|
| Xcode Instruments → Leaks | 类似 Android LeakCanary，运行时检测泄漏对象 |
| Xcode Memory Graph | 可视化对象引用关系图，找循环引用 |
| Xcode Debug Memory Graph | 暂停 App → 看当前所有存活对象和引用链 |
| `deinit` 打 log | 手动验证：对象应该释放时 deinit 是否被调用 |

### deinit 是什么？

`deinit` = Swift 的析构函数（类比 C++ `~destructor`，类比 Android `finalize()`）。对象引用归零时自动调用。

```swift
class MyViewController {
    deinit {
        print("页面被释放了")  // 如果这行不打印 → 泄漏了
    }
}
```
