# Java / Kotlin 核心语法（对比 TypeScript）

> 前端出身，用 TS 的认知迁移理解 Java/Kotlin。
> 不是语法手册，是"TS 里的 XX 在 Java/Kotlin 里怎么写"。

---

## 目录

- [一、变量与类型](#一变量与类型)
- [二、函数](#二函数)
- [三、类与接口](#三类与接口)
- [四、空安全](#四空安全)
- [五、集合](#五集合)
- [六、异步](#六异步)
- [七、模块/包](#七模块包)
- [八、Java vs Kotlin 核心差异](#八java-vs-kotlin-核心差异)

---

## 一、变量与类型

| TS | Java | Kotlin |
|----|------|--------|
| `let x: number = 1` | `int x = 1;` | `var x: Int = 1` |
| `const x = 1` | `final int x = 1;` | `val x = 1`（不可变） |
| `let x = "hi"` | `String x = "hi";` | `var x = "hi"`（类型推断） |
| `let x: string \| null = null` | `String x = null;` | `var x: String? = null`（可空） |
| `any` | `Object` | `Any` |
| `void` | `void` | `Unit` |

**关键差异**：
- Java 有基本类型（int/boolean/double）和包装类型（Integer/Boolean/Double），Kotlin 统一用 Int/Boolean/Double
- Kotlin 的 `val` = TS 的 `const`（不可重新赋值），`var` = TS 的 `let`
- Java 没有类型推断（必须写类型），Kotlin 有

---

## 二、函数

| TS | Java | Kotlin |
|----|------|--------|
| `function add(a: number, b: number): number` | `int add(int a, int b)` | `fun add(a: Int, b: Int): Int` |
| 箭头函数 `(x) => x * 2` | 无（用 Lambda） `x -> x * 2` | `{ x -> x * 2 }` |
| 默认参数 `f(x = 1)` | 不支持（用重载） | `fun f(x: Int = 1)` |
| 可选参数 `f(x?: number)` | 不支持 | 用默认参数或可空类型 |

**关键差异**：
- Java 函数必须在类里（没有顶层函数），Kotlin 可以有顶层函数
- Kotlin 的 Lambda 语法和 TS 箭头函数很像
- Java 8+ 有 Lambda，但语法比 Kotlin 啰嗦

---

## 三、类与接口

| TS | Java | Kotlin |
|----|------|--------|
| `class Dog extends Animal` | `class Dog extends Animal` | `class Dog : Animal()` |
| `implements IAnimal` | `implements IAnimal` | `: IAnimal`（和继承同语法） |
| `interface IAnimal { bark(): void }` | `interface IAnimal { void bark(); }` | `interface IAnimal { fun bark() }` |
| `abstract class` | `abstract class` | `abstract class` |
| `private/public/protected` | 同 | 同（默认 public） |
| `static method` | `static void foo()` | `companion object { fun foo() }` |

**关键差异**：
- Java/Kotlin 没有 TS 的 `type` 关键字（用 interface 或 class）
- Kotlin 默认 public（TS 也是），Java 默认 package-private
- Kotlin 没有 `static`，用 `companion object` 替代
- Kotlin 的 `data class` = TS 里定义一个纯数据类型（自动生成 equals/hashCode/toString）

---

## 四、空安全

| TS（strictNullChecks） | Java | Kotlin |
|------------------------|------|--------|
| `x: string \| null` | `@Nullable String x` | `x: String?` |
| `x?.method()` | `if (x != null) x.method()` | `x?.method()` |
| `x ?? "default"` | `x != null ? x : "default"` | `x ?: "default"` |
| `x!` (非空断言) | 无（直接用，可能 NPE） | `x!!`（非空断言，可能 NPE） |

**关键差异**：
- Java 没有语言级空安全（NPE 是 Java 最常见的 crash）
- Kotlin 的空安全和 TS 的 strictNullChecks 几乎一样（`?` 标记可空，`?.` 安全调用，`?:` 默认值）
- 这是 Kotlin 相比 Java 最大的改进之一

---

## 五、集合

| TS | Java | Kotlin |
|----|------|--------|
| `number[]` 或 `Array<number>` | `int[]` 或 `List<Integer>` | `List<Int>` / `MutableList<Int>` |
| `Map<string, number>` | `Map<String, Integer>` | `Map<String, Int>` / `MutableMap` |
| `arr.map(x => x * 2)` | `list.stream().map(x -> x * 2).collect(...)` | `list.map { it * 2 }` |
| `arr.filter(x => x > 0)` | `list.stream().filter(x -> x > 0).collect(...)` | `list.filter { it > 0 }` |
| `[...arr1, ...arr2]` | `new ArrayList<>(arr1); list.addAll(arr2)` | `arr1 + arr2` |

**关键差异**：
- Kotlin 的集合操作和 TS 几乎一样简洁（map/filter/reduce）
- Java 需要 Stream API，啰嗦很多
- Kotlin 区分不可变集合（List）和可变集合（MutableList），TS 没有这个区分

---

## 六、异步

| TS | Java | Kotlin |
|----|------|--------|
| `async/await` | `CompletableFuture` / 回调 | `suspend fun` + 协程 |
| `Promise<T>` | `CompletableFuture<T>` | `Deferred<T>` |
| `Promise.all([...])` | `CompletableFuture.allOf(...)` | `awaitAll(...)` |

**关键差异**：
- Kotlin 协程和 TS 的 async/await 思路一样（写同步风格的异步代码）
- Java 没有原生 async/await，用 CompletableFuture 或回调（啰嗦）
- Android 里异步常用：Kotlin 协程 > RxJava > 回调

```kotlin
// Kotlin 协程（类似 TS async/await）
suspend fun fetchData(): String {
    val result = withContext(Dispatchers.IO) {
        api.getData()  // 在 IO 线程执行
    }
    return result  // 回到原线程
}
```

---

## 七、模块/包

| TS | Java | Kotlin |
|----|------|--------|
| `import { Foo } from './foo'` | `import com.xxx.Foo;` | `import com.xxx.Foo` |
| `export class Foo` | `public class Foo`（文件名=类名） | `class Foo`（默认 public） |
| 一个文件多个 export | 一个文件只能一个 public class | 一个文件可以多个类/函数 |
| `package.json` 管依赖 | `build.gradle` 管依赖 | `build.gradle.kts` |

**关键差异**：
- Java 强制"一个文件一个 public class，文件名=类名"
- Kotlin 放松了这个限制（一个文件可以有多个类/函数）
- 包管理：TS 用 npm，Java/Kotlin 用 Gradle（Maven 仓库）

---

## 八、Java vs Kotlin 核心差异

Kotlin 是 Java 的"现代化改良版"，完全兼容 Java（可以互调）。

| 维度 | Java | Kotlin |
|------|------|--------|
| 空安全 | 无（NPE 地狱） | 语言级（`?` 标记） |
| 类型推断 | 无（必须写类型） | 有（`val x = 1`） |
| 数据类 | 手写 getter/setter/equals | `data class`（一行搞定） |
| 单例 | 手写（双重检查锁） | `object` 关键字 |
| 扩展函数 | 无 | `fun String.hello() = "Hello $this"` |
| 协程 | 无（用 Thread/Future） | 原生支持（suspend/launch） |
| Lambda | Java 8+ 有，但啰嗦 | 简洁（`{ it * 2 }`） |
| 默认参数 | 不支持（用重载） | 支持 |
| 字符串模板 | `"Hello " + name` | `"Hello $name"` |

**一句话**：Kotlin 之于 Java ≈ TypeScript 之于 JavaScript。解决了痛点（空安全/类型推断/简洁语法），完全兼容旧代码。

---

## 九、Kotlin 作用域函数（TS 没有的）

Kotlin 有一组"作用域函数"，用于对象创建后链式配置。TS 没有对应语法。

| 函数 | this/it | 返回值 | 用途 |
|------|---------|--------|------|
| `apply {}` | this = 对象 | 对象本身 | 创建后配置（Builder 模式替代） |
| `also {}` | it = 对象 | 对象本身 | 创建后做副作用（打日志等） |
| `let {}` | it = 对象 | Lambda 返回值 | 空安全链式调用 |
| `run {}` | this = 对象 | Lambda 返回值 | 对象上执行计算 |

**最常用的 `apply`**：

```kotlin
// Kotlin
val intent = Intent(context, XRNActivity::class.java).apply {
    putExtra("route", "order/detail")  // this 省略，指向 intent
    putExtra("params", bundleOf("id" to "123"))
}

// 等价 TS（没有 apply 语法糖）
const intent = new Intent(context, XRNActivity.class);
intent.putExtra("route", "order/detail");
intent.putExtra("params", { id: "123" });
```

**本质**：`apply {}` = 创建对象 + 花括号里配置它 + 返回对象本身。花括号是 Kotlin Lambda 语法，里面的 `this` 指向对象可省略。
