# C++ / Rust 核心语法（对比 TypeScript）

> 前端出身，用 TS 的认知迁移理解 C++/Rust。
> 重点：内存管理（这是和 TS 最大的区别）。

---

## 目录

- [一、核心区别：内存管理](#一核心区别内存管理)
- [二、变量与类型](#二变量与类型)
- [三、函数](#三函数)
- [四、类/结构体](#四类结构体)
- [五、指针与引用](#五指针与引用)
- [六、内存管理](#六内存管理)
- [七、错误处理](#七错误处理)
- [八、异步](#八异步)
- [九、模块](#九模块)
- [十、C++ vs Rust 核心差异](#十c-vs-rust-核心差异)

---

## 一、核心区别：内存管理

TS/Java/Kotlin 有 GC（垃圾回收），你不用管内存释放。C++/Rust **没有 GC**，你必须自己管。

| | TS | C++ | Rust |
|---|-----|-----|------|
| 内存管理 | GC 自动回收 | 手动（new/delete）或智能指针 | 所有权系统（编译时检查） |
| 内存安全 | 天然安全 | 不安全（容易泄漏/野指针） | 编译时保证安全 |
| 性能 | GC 有暂停 | 极致（无 GC 开销） | 极致（无 GC 开销） |

**Rust 的核心创新**：不用 GC 也能保证内存安全（通过所有权 + 借用检查，编译时就发现问题）。

---

## 二、变量与类型

| TS | C++ | Rust |
|----|-----|------|
| `let x: number = 1` | `int x = 1;` | `let x: i32 = 1;` |
| `const x = 1` | `const int x = 1;` | `let x = 1;`（默认不可变） |
| `let mut` 概念无 | `int x = 1;`（默认可变） | `let mut x = 1;`（显式可变） |
| `string` | `std::string` | `String` / `&str` |
| `boolean` | `bool` | `bool` |
| `any` | `void*`（危险） | 无（强类型，用泛型/trait） |

**关键差异**：
- Rust 默认不可变（`let x`），要可变必须 `let mut x`。和 TS 的 const/let 反过来
- C++ 默认可变，要不可变加 `const`
- Rust 的 `String`（堆上，可变）vs `&str`（引用，不可变）≈ TS 没有这个区分

---

## 三、函数

| TS | C++ | Rust |
|----|-----|------|
| `function add(a: number, b: number): number` | `int add(int a, int b)` | `fn add(a: i32, b: i32) -> i32` |
| 箭头函数 `(x) => x * 2` | Lambda `[](int x) { return x * 2; }` | 闭包 `\|x\| x * 2` |
| 返回值 | `return x` | `return x;` | `x`（最后一行无分号 = 返回值） |

**关键差异**：
- Rust 最后一行不加分号就是返回值（类似 Ruby）
- C++ Lambda 的 `[]` 是捕获列表（声明闭包能访问哪些外部变量）
- Rust 闭包自动推断捕获方式

---

## 四、类/结构体

| TS | C++ | Rust |
|----|-----|------|
| `class Dog { }` | `class Dog { };` | `struct Dog { }`（没有 class） |
| `interface` | 纯虚类 | `trait` |
| `extends` | `: public Animal` | 无继承（用 trait 组合） |
| `implements` | `: public IAnimal` | `impl Trait for Dog` |
| 方法 | `bark() { }` | `void bark() { }` | `fn bark(&self) { }` |

**关键差异**：
- Rust 没有类继承（没有 `extends`），用 trait（接口）+ 组合替代
- Rust 的 `struct` + `impl` = TS 的 `class`
- C++ 有多继承（复杂），Rust 用 trait 避免了多继承的问题

```rust
// Rust：struct 定义数据，impl 定义方法，trait 定义接口
struct Dog { name: String }

impl Dog {
    fn bark(&self) { println!("{} barks", self.name); }
}

trait Animal {
    fn speak(&self);
}

impl Animal for Dog {
    fn speak(&self) { self.bark(); }
}
```

---

## 五、指针与引用

TS 里没有指针概念（一切都是引用，GC 管理）。C++/Rust 需要理解：

| 概念 | C++ | Rust | TS 类比 |
|------|-----|------|---------|
| 值 | `int x = 1` | `let x = 1` | `let x = 1`（基本类型） |
| 引用 | `int& ref = x` | `let ref = &x` | 对象变量（引用语义） |
| 可变引用 | `int& ref = x` | `let ref = &mut x` | 无对应 |
| 指针 | `int* ptr = &x` | 无裸指针（unsafe 里有） | 无 |
| 智能指针 | `std::unique_ptr<T>` | `Box<T>` | 无（GC 替代了） |

**Rust 的借用规则**（编译时检查）：
- 同一时间只能有一个可变引用 OR 多个不可变引用
- 引用不能比被引用的数据活得更久
- 这些规则在编译时检查，违反就编译不过

---

## 六、内存管理

### C++：手动管理

```cpp
// 手动分配/释放（容易忘记 delete → 泄漏）
int* p = new int(42);
delete p;

// 智能指针（推荐，自动释放）
auto p = std::make_unique<int>(42);  // 离开作用域自动释放
auto p = std::make_shared<int>(42);  // 引用计数，最后一个释放时回收
```

### Rust：所有权系统

```rust
// 所有权转移（move）
let s1 = String::from("hello");
let s2 = s1;  // s1 的所有权转移给 s2，s1 不能再用
// println!("{}", s1);  // 编译错误！

// 借用（borrow）
let s1 = String::from("hello");
let len = calculate_length(&s1);  // 借用，不转移所有权
println!("{}", s1);  // 还能用
```

**TS 类比**：
- C++ 的 `unique_ptr` ≈ "这个对象只有一个主人，主人没了对象就释放"
- C++ 的 `shared_ptr` ≈ "引用计数，最后一个引用断开时释放"
- Rust 的所有权 ≈ "编译器帮你检查谁是主人，确保不会泄漏也不会重复释放"

---

## 七、错误处理

| TS | C++ | Rust |
|----|-----|------|
| `try/catch` | `try/catch` | 无异常，用 `Result<T, E>` |
| `throw new Error()` | `throw std::runtime_error()` | `Err(e)` |
| `Promise.reject()` | — | `Err(e)` |

```rust
// Rust：用 Result 替代 try/catch
fn read_file(path: &str) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?;  // ? = 如果 Err 就提前返回
    Ok(content)
}

// 调用方
match read_file("config.json") {
    Ok(content) => println!("{}", content),
    Err(e) => println!("Error: {}", e),
}
```

**Rust 的 `?` 操作符** ≈ TS 里 `await` 的错误传播（如果失败就提前返回错误）。

---

## 八、异步

| TS | C++ | Rust |
|----|-----|------|
| `async/await` | `std::async` / 线程 | `async/await`（tokio 运行时） |
| `Promise<T>` | `std::future<T>` | `Future<Output = T>` |

```rust
// Rust async（需要 tokio 运行时）
async fn fetch_data() -> Result<String, Error> {
    let resp = reqwest::get("https://api.com").await?;
    let body = resp.text().await?;
    Ok(body)
}
```

Rust 的 async/await 语法和 TS 几乎一样，但需要一个运行时（tokio/async-std）来驱动。

---

## 九、模块

| TS | C++ | Rust |
|----|-----|------|
| `import { Foo } from './foo'` | `#include "foo.h"` | `use crate::foo::Foo;` |
| `export class Foo` | 头文件声明 | `pub struct Foo` |
| `package.json` | CMakeLists.txt | `Cargo.toml` |
| npm | vcpkg / conan | crates.io（cargo） |

**关键差异**：
- C++ 用头文件（.h）+ 实现文件（.cpp）分离声明和实现（历史包袱）
- Rust 的模块系统和 TS 类似（文件 = 模块，pub = export）
- Rust 的 Cargo ≈ npm（包管理 + 构建 + 发布一体）

---

## 十、C++ vs Rust 核心差异

| 维度 | C++ | Rust |
|------|-----|------|
| 内存安全 | 不保证（靠程序员自觉） | 编译时保证（所有权系统） |
| 学习曲线 | 陡（历史包袱多） | 陡（所有权概念新） |
| 生态 | 极大（几十年积累） | 快速增长（年轻但活跃） |
| 编译速度 | 慢 | 更慢 |
| 适合 | 已有 C++ 项目/游戏引擎/系统编程 | 新项目/安全敏感/并发 |
| 和 JS 的互操作 | V8 API / N-API | wasm-bindgen / neon |

**一句话**：C++ 是"自由但危险"（你管一切），Rust 是"安全但严格"（编译器管你）。两者性能一样好，Rust 更适合新项目。

---

## 十一、进程与线程

### 本质

- **进程**：操作系统分配资源的最小单位（独立内存空间）
- **线程**：CPU 调度的最小单位（共享进程内存）

类比：进程 = 独立的房子（各有各的家具），线程 = 同一个房子里的人（共享家具，但可能抢）。

### 各语言的线程模型

| | TS/JS | Java/Kotlin | C++ | Rust |
|---|-------|-------------|-----|------|
| 线程模型 | 单线程 + 事件循环 | 多线程（真并行） | 多线程（真并行） | 多线程（真并行） |
| 并发方式 | async/await + Event Loop | Thread + 协程 | std::thread + async | std::thread + async/tokio |
| 多核利用 | Worker Thread / Worker | 天然多线程 | 天然多线程 | 天然多线程 |
| 共享内存 | 不共享（Worker 通过消息） | 共享（需要锁） | 共享（需要锁） | 共享（编译时检查安全） |
| 数据竞争 | 不存在（单线程） | 运行时可能出错 | 运行时可能出错 | **编译时阻止** |

### 关键认知

- **JS 是假并发**：Event Loop 在单线程上交替执行任务，不是真正的并行
- **Java/C++ 是真并发**：多个线程同时跑在多个 CPU 核上，共享内存 → 需要锁（Mutex）防止数据竞争
- **Rust 的独特之处**：编译器通过所有权系统在编译时就阻止数据竞争（Send/Sync trait），不需要运行时检查

### Android 中的线程

```
主线程（UI Thread）：View 操作、事件分发
子线程：网络/IO/计算
线程间通信：Handler/Looper（消息机制）

RN 中：
  JS Thread：Hermes 执行 JS
  UI Thread：Native View 操作
  Native Modules Thread：异步操作
```

---

## 十二、内存管理（深入）

### 各语言的内存模型

| | TS/JS | Java/Kotlin | C++ | Rust |
|---|-------|-------------|-----|------|
| 分配 | 引擎自动（new 对象） | JVM 自动（new） | 手动（new/malloc）或栈 | 栈（默认）或堆（Box） |
| 释放 | GC 自动 | GC 自动 | 手动（delete/free）或 RAII | 所有权离开作用域自动释放 |
| 栈 vs 堆 | 开发者不感知 | 基本类型栈，对象堆 | 开发者决定 | 开发者决定 |
| 内存泄漏 | 闭包引用/事件监听未清理 | 同 | 忘记 delete | 几乎不可能（编译器保证） |

### 栈 vs 堆

```
栈（Stack）：函数调用时自动分配，函数返回自动释放。快，但大小有限。
堆（Heap）：手动分配（或 GC 管理），生命周期灵活。慢，但大小不限。

TS：你不用管（V8 决定放哪）
Java：基本类型在栈，对象在堆（GC 管）
C++：局部变量在栈，new 出来的在堆（你管）
Rust：默认在栈，Box<T> 放堆（离开作用域自动释放）
```

### C++ 智能指针（替代手动 delete）

```cpp
// unique_ptr：独占所有权，离开作用域自动释放
auto p = std::make_unique<Device>();  // 只有 p 能用这个对象
// p 离开作用域 → 自动 delete

// shared_ptr：共享所有权，引用计数，最后一个释放时回收
auto p1 = std::make_shared<Device>();
auto p2 = p1;  // 引用计数 = 2
// p1 和 p2 都离开作用域 → 引用计数归零 → 自动 delete

// weak_ptr：弱引用，不增加引用计数（防循环引用）
```

### Rust 所有权（深入）

```rust
// 1. 每个值有且只有一个 owner
let s1 = String::from("hello");  // s1 是 owner

// 2. 赋值 = 转移所有权（move）
let s2 = s1;  // 所有权从 s1 转移到 s2
// s1 不能再用了（编译错误）

// 3. 函数传参也是 move
fn take(s: String) { }
take(s2);  // s2 的所有权转移给函数参数
// s2 不能再用了

// 4. 不想转移 → 借用（&）
fn borrow(s: &String) { }  // 只是借来看看，不拿走
borrow(&s2);  // s2 还能用

// 5. 离开作用域 → owner 自动释放内存
{
    let s = String::from("hello");
}  // s 离开作用域 → 内存自动释放（不需要 GC）
```

---

## 十三、函数数据传递

### 值传递 vs 引用传递

| | TS | Java | Kotlin | C++ | Rust |
|---|-----|------|--------|-----|------|
| 基本类型 | 值传递 | 值传递 | 值传递 | 值传递（默认） | 值传递（move） |
| 对象/结构体 | 引用传递（共享） | 引用传递（共享） | 同 Java | 值传递（拷贝）或引用 | move（转移）或借用（&） |

### C++ 的三种传参

```cpp
void byValue(Device d) { }      // 拷贝一份（开销大）
void byRef(Device& d) { }       // 引用（不拷贝，可修改原对象）
void byConstRef(const Device& d) { }  // 常量引用（不拷贝，不能修改）
void byPtr(Device* d) { }       // 指针（可以为 null）
```

### Rust 的三种传参

```rust
fn take_ownership(d: Device) { }   // move：拿走所有权，调用方不能再用
fn borrow(d: &Device) { }          // 不可变借用：只读，调用方还能用
fn borrow_mut(d: &mut Device) { }  // 可变借用：可改，但同时只能有一个
```

### 对比 TS

TS 里你不用想这些——对象永远是"引用传递"（共享同一个对象），GC 管释放。C++/Rust 需要你明确"这个数据是拷贝过去、借过去、还是送过去"。

---

## 十四、依赖安装和管理

| | TS | Java/Kotlin | C++ | Rust |
|---|-----|-------------|-----|------|
| 包管理器 | npm / pnpm / yarn | Gradle（Maven 仓库） | vcpkg / conan / CMake FetchContent | Cargo（crates.io） |
| 配置文件 | package.json | build.gradle(.kts) | CMakeLists.txt / vcpkg.json | Cargo.toml |
| 锁文件 | package-lock.json | gradle.lockfile | vcpkg.json | Cargo.lock |
| 安装命令 | `npm install` | `./gradlew build`（自动下载） | `vcpkg install` 或 CMake 自动 | `cargo build`（自动下载） |
| 仓库 | npmjs.com | Maven Central / Google | vcpkg registry | crates.io |
| monorepo | pnpm workspace | Gradle multi-module | CMake subdirectory | Cargo workspace |

### 关键差异

- **Rust 的 Cargo 最接近 npm**：`cargo add xxx` ≈ `npm install xxx`，`Cargo.toml` ≈ `package.json`，体验最好
- **Java 的 Gradle 比较重**：构建 + 依赖管理 + 任务系统合一，学习曲线陡
- **C++ 最混乱**：没有统一标准，CMake + vcpkg 是当前最佳实践但远不如 npm/cargo 好用
- **Android 项目**：Gradle 管 Java/Kotlin 依赖 + NDK 管 C++ 编译，两套系统并存

---

## 十五、引用 vs 指针（深入）

### 本质区别

底层实现一样（都是内存地址），区别在于语义和安全约束：

| | 引用（&） | 指针（*） |
|---|----------|----------|
| 能为 null | 不能 | 能 |
| 能重新指向 | 不能 | 能 |
| 需要解引用 | 不需要（自动） | 需要（`*ptr`） |
| 能做算术 | 不能 | 能（`ptr++`） |

### 引用为什么存在

解决指针的两个痛点：
1. **null 崩溃**：引用不能为 null → 拿到就保证有效
2. **语法丑/易错**：引用像直接用原对象，不需要 `*` 解引用

**核心场景**："我想操作原对象，不想拷贝，也不想处理 null" → 用引用。

**一句话**：引用 = 指针的安全子集（去掉 null/算术/重指向，只保留"不拷贝直接操作"）。

### 互相转换

| 参数类型 | 传什么 | 怎么转 |
|---------|--------|--------|
| 要引用 `Device&` | 传对象 | 直接传 |
| 要引用 `Device&` | 传指针 | `*ptr`（解引用） |
| 要指针 `Device*` | 传对象 | `&obj`（取地址） |
| 要指针 `Device*` | 传引用 | `&ref`（取地址） |

底层都是地址，转换就是在"安全"和"自由"之间切换。
