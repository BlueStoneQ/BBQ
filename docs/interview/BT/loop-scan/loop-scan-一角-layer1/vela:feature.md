## resume摘要
1.Vela嵌入式快应用框架(js/cpp双端)
vela系统快应用框架层(IoT/穿戴), QuickJS + LVGL + LibUV(Eventloop)
- Feature/Bridge机制(platform侧能力接入体系, 系统能力向应用层开放): 横跨cpp和js两侧,基于Quickjs External obj/func机制,无json序列化跨边界通信,Feature注册和管理

## feature管理
对,核心就是一张 map,但"feature 管理"不止一张——按职责其实是**两三张 map**,别混成一张。

先给结论:**Feature 管理的骨架 = 一张"注册表 map"(name → feature 实现)+ 一张"回调表 map"(callbackId → JS 回调)。前者管"能力在哪",后者管"异步结果发回给谁"。**

**map 一:注册表(name → Feature 实现)—— 原生侧**

启动时每个 Feature 把自己注册进来:

```cpp
// 原生侧,能力名 → 实现
std::unordered_map<std::string, Feature*> name2FeatureMap;
// "system.file" → FileFeature 实例
```

JS 调 `system.file.read(...)` 过 external func 落到原生分发器,`name2FeatureMap.get("system.file")` 找到实现执行。这就是"注册和管理"的核心——**注册 = 往这张 map 里塞;管理/查找 = 从这张 map 取。**

**map 二:回调表(callbackId → JS 回调)—— JS 侧**

异步能力(read 完才回结果),得记住"结果回来该调哪个 JS 函数":

```js
// JS 侧,实例内
callbackId2FuncMap: Map<callbackId, Function>
// "1" → onSuccess
```

你前面用带类型语义命名理清过的就是这张:调用时生成 callbackId 存进去,原生干完带着 callbackId 回来,`get(callbackId)` 取回调执行,非 keepAlive 就 delete。

**为什么是两张、各在一侧(owner 分明)**:

- 注册表在**原生侧**——feature 是原生实现的,owner 是原生,JS 不持有 feature 实体,只知道 name(字符串)。
- 回调表在**JS 侧**——回调是 JS 函数,owner 是 JS,原生不持有 JS 函数,只知道 callbackId(字符串)。

**两侧靠 id/name 字符串对话,各存各的 map**——这又是前面反复出现的"id 对话解耦"思想:JS 不认识 feature 实体(只给 name),原生不认识 JS 回调(只给 callbackId),各自用一张 map 把"字符串 id → 本地实体"映射回来。

**可能还有第三张(看实现)**:如果需要按实例管权限/生命周期,还有 `instanceId → 实例上下文` 的 map(哪个页面/module 调的,能不能用这个能力)。但骨架就前两张。

一句话:**Feature 管理本质就是查表,核心两张 map——原生侧 `name → Feature`(找能力),JS 侧 `callbackId → 回调`(回结果);两侧不持有对方实体,靠字符串 id/name 对话,各用一张 map 映射回本地。**

补个边界:vela 具体字段名/是不是 `unordered_map` 我没读过 vela 源码,但"注册表 + 回调表两张 map"是这类 feature 系统的通用骨架,nyrax 侧(读过)的 callbackId2FuncMap 就是这个。


- promise包装
对,Promise 包装在 **JS 侧**做,而且就是在 feature 的 JS 层(调用入口那层)。原生侧根本不知道 Promise 的存在——它只认 callbackId。

第一性:**Promise 是 JS 语言的东西,原生(C++)没有 Promise。所以"回调 → Promise"的转换,只能在 JS 侧完成。原生侧永远是 callbackId 那套一次性回调,JS 侧把它包装成 Promise 给应用用。**

看代码就清楚,包装点在 JS feature 入口:

```js
// JS 侧 feature 入口:把 callbackId 回调机制包装成 Promise
function invokeFeature(name, action, params) {
  return new Promise((resolve, reject) => {
    const callbackId = genId();
    // 存的不是应用的回调,而是 Promise 的 resolve/reject
    callbackId2FuncMap.set(callbackId, (result) => {
      if (result.code === 0) resolve(result.data);
      else reject(result.error);
    });
    // 过 external func 下去,原生只拿到 callbackId,不知道 Promise
    nativeInvoke(name, action, params, callbackId);
  });
}
```

链路:

```
应用: await system.file.read(path)
  │
JS feature 层: new Promise → 把 resolve/reject 包成回调存进 callbackId2FuncMap
  │  external func 下发(带 callbackId,无 Promise)
原生: 干活 → 带 callbackId 回来
  │
JS: callbackId2FuncMap.get(callbackId) 取出那个回调 → 调它 → resolve/reject → 应用的 await 返回
```

关键点:

1. **原生侧无感知**——它进来是 callbackId、回去也是 callbackId,一次性回调机制。Promise 是 JS 侧套在这个机制外面的壳。
2. **存进 map 的其实是 resolve/reject**——callbackId2FuncMap 里那个 Function,本质是"把 Promise 的 resolve/reject 包起来的回调"。原生回调它,就等于 resolve 了应用的 Promise。
3. **两种回调形态,同一套底层**:应用想用回调风格(`read(path, onSuccess)`)还是 Promise 风格(`await read(path)`),差别只在 JS feature 层怎么包——底层都是 callbackId + map。Promise 只是其中一种包装。
4. **keepAlive(监听类)不能包 Promise**——Promise 只能 resolve 一次,而监听类要多次回调(如传感器数据流)。所以那种保持回调风格或包成 EventEmitter/AsyncIterator,不用 Promise。这也说明 Promise 包装是 JS 侧按能力类型选的策略,不是底层强制。

一句话:**Promise 包装纯在 JS 侧(feature 入口层)做——原生只认 callbackId 的一次性回调,JS 侧 new 一个 Promise、把 resolve/reject 当回调存进 callbackId2FuncMap,原生回来时取出来 resolve。原生对 Promise 无感知。回调风格 vs Promise 风格只是 JS 层的不同包装,底层同一套 callbackId + map;keepAlive 多次回调的能力不能用 Promise。**

## external func 通信
### 注入
### 传参
- CPP core侧直接通过JSValue句柄访问到js调用传递的参数
### 返回值：callBack & Promise
- 异步回调回传机制：
```js
- JS 侧:传一个回调函数下来(onSuccess)
  → C++ 拿到它的 JSValue 句柄,存起来(引用计数 +1,防止被 GC)
原生异步干完:
  → JS_Call(ctx, 那个回调句柄, ...) 反调它,把结果作为 JSValue 参数传进去
  → 用完 JS_FreeValue 释放句柄(引用计数 -1)
```
### event
event 机制本质就是"keepAlive 版的回调"——和普通 feature 调用同一套底层(直接持有 JS 回调句柄反调),唯一区别是这个句柄不是一次性的,而是常驻、可多次触发,直到退订才释放。

## 扩展机制设计：如何开发上线一个feature

好,讲扩展机制:怎么开发上线一个 feature。先讲 RN TurboModule 的做法(作参照),再对照出你的 feature 扩展该怎么设计——因为你的债务点正是"要做成 TurboModule 那种"。

先给结论:**开发一个 feature 的本质 = "定契约 → 实现原生 → 注册进表 → 暴露给 JS"。TurboModule 相对老 NativeModule 的关键升级,是加了一层"接口契约(spec)+ 代码生成 + 按需懒加载",这也是你 feature 扩展要对齐的三点。**

---

**一、TurboModule 怎么开发一个扩展(参照)**

四步:

1. **定接口契约(JS spec)**:先用 TS 写接口声明,比如
   ```ts
   export interface Spec extends TurboModule {
     getDeviceName(): string;              // 同步
     readFile(path: string): Promise<string>; // 异步
   }
   export default TurboModuleRegistry.get<Spec>('MyFeature');
   ```
   **契约先行**是 Turbo 的灵魂——JS 和原生都以这个 spec 为准。

2. **代码生成(codegen)**:工具读 spec,生成 C++/Java/ObjC 的**抽象基类**(方法签名、参数类型的桥接胶水)。开发者不用手写序列化/类型转换,codegen 保证两侧类型对齐。

3. **实现原生**:继承生成的基类,填方法实现(Android Kotlin/Java、iOS ObjC/Swift、或纯 C++)。

4. **注册**:把这个 module 注册进 TurboModule 的 provider/registry,JS 侧 `TurboModuleRegistry.get('MyFeature')` 就能拿到。

TurboModule 的三个关键特性(区别于老 NativeModule):

- **接口契约 + codegen**:强类型,两侧对齐,免手写桥接。
- **JSI 直调**:通过 JSI 直接函数调用,无 JSON 序列化(和你 external func 同源)。
- **懒加载**:不是启动全注册,而是 JS 第一次 `get('MyFeature')` 时才实例化——启动不为没用到的 module 付费。

---

**二、对照:你的 feature 扩展该怎么设计**

你的债务点是"vela/nyrax 退化成统一分发器,而我要做成 Turbo 那种独立 external func 直调"。所以你的扩展机制应该这样对齐:

**开发一个 feature 的完整流程(你的设计):**

1. **定契约**:声明这个 feature 的方法签名(name、每个 action 的参数/返回/同步异步)。这是 JS 和原生共同的约定。

2. **实现原生 feature**:C++ 实现,方法以 external func 形式暴露——**每个 feature(或每个方法)是一个独立的可调函数对象**,不是塞进一个统一分发器里按 name 分支。这是和当前退化实现的关键区别。

3. **注册**:把 feature 的 external func 绑定到 JS 可达的位置(挂到某个命名空间对象上,如 `system.file`),同时进注册表 map。

4. **JS 侧封装**:把原生 external func 包装成应用友好的 API(callback/Promise 包装,如前面讲的),`system.file.read(path)` 这样调。

5. **上线**:走扩展包/版本机制发布(这块涉及分发,是生态侧)。

**关键设计对照(统一分发器 vs 独立 external func):**

| | 统一分发器(当前退化实现) | 独立 external func(TurboModule 式,你的设计) |
|---|---|---|
| 通道 | 一个 external func,`invoke(name, action, params)` | 每个 feature/方法是独立可调函数对象 |
| 分发 | 原生侧按 name/action **运行时字符串分支**分发 | JS 直接持有该函数,**直接调到目标 C++**,无分发 |
| 类型 | 参数打包成通用 object,弱类型 | 契约 + codegen,强类型对齐 |
| 加载 | 通常全量 | 可懒加载,按需实例化 |
| 代价 | 多一层分发、弱类型、易错 | 直调、强类型;但每个都要绑定,注册更重 |

**为什么你的设计(独立 external func)更优,一句话**:统一分发器等于在免序列化的直调通道上,又加回了一层"运行时按字符串找方法"的间接开销和弱类型;TurboModule 式直调把这层也去掉——JS 拿到的就是那个方法本身,直接调,类型还是编译期对齐的。这是"把直调贯彻到底"vs"半直调(还留个分发中转)"的区别。

---

**这一角勾出的能力冰山:**

- **钩子**:"feature 扩展机制,参照 TurboModule 开发上线"。
- **契约驱动的扩展设计**:spec 先行 + codegen,是可扩展体系的核心(第三方能接入的前提是有清晰契约)。
- **架构判断力(债务点)**:统一分发器 vs 独立 external func 的取舍——你有明确主张并说得清为什么,这是最能打的点。
- **生态视角**:开发 → 注册 → 上线 → 分发,是"能力开放平台"的完整闭环,扣 BT 平台架构岗。

一句话收口:**开发一个 feature 的本质是"定契约 → 实现原生 → 注册 → 暴露 JS → 上线"。TurboModule 的参照价值在三点:接口契约 + codegen(强类型对齐)、JSI 直调(免序列化)、懒加载(启动不为没用到的付费)。你的设计要对齐的关键是把 feature 做成"独立 external func 直调",而不是当前退化的"统一分发器 + 运行时字符串分发"——后者在直调通道上又加回了一层间接和弱类型,前者才是把直调贯彻到底。**

补边界:TurboModule 的四步/codegen 是 RN 公开机制,准确;你 feature 侧的具体实现我没读 vela 源码,以上是按"你的设计主张(Turbo 式)"推的方案,不是 vela 现状。

先纠正我自己:**我说"债务点"是措辞错了。** 我们是在**设计**这个扩展机制,不是在记录一个已知缺陷。而且我不该断言"nyrax 没有 feature 扩展机制"——**nyrax 具体有没有、做成什么样,我没读过那部分源码,不知道。** 前面把它说成"退化的债务",是我拿之前一个模糊印象硬套,收回。就当作我们从零设计这套机制。

回到你两个问题,都很关键:

**问题一:external func 的暴露,该不该框架封装细节?**

**对,必须框架封装,这正是设计的核心。** 理由是第一性的:

写 external func 要碰引擎底层 API(`JS_NewCFunction`、从 `JSValue` 里 `JS_ToInt32` 取参、`JS_FreeValue` 管引用计数、异常处理、线程约束……)。**如果每个 feature 开发者都手写这些,既容易错(漏 free 就内存泄漏、类型转错就崩),又把引擎细节泄露给了业务开发者。**

好的扩展机制应该是:**框架提供一层封装(基类/宏/codegen),feature 开发者只写"业务逻辑",引擎绑定/取参/类型转换/回调这些胶水由框架生成或提供。** 这正是 TurboModule 的 codegen 干的事——开发者写 spec + 实现,桥接胶水机器生成。

所以你的扩展机制分两层:

- **框架层(封装引擎细节)**:提供注册 API、参数解析、callbackId 回传、错误包装。开发者看不到 `JSValue`。
- **feature 开发层**:只写"输入参数 → 干活 → 输出结果"的业务。

**问题二:external func 最小示例(先看框架层底下到底长啥样)**

先给"裸的"——不封装时,一个 QuickJS external func 长这样(这就是框架要替开发者封装掉的东西):

```c
// 裸 external func:框架层内部干的活,业务开发者不该直接碰
static JSValue file_read(JSContext *ctx, JSValueConst this_val,
                         int argc, JSValueConst *argv) {
    // 1. 取参:从 JSValue 句柄读出原生值
    const char *path = JS_ToCString(ctx, argv[0]);   // argv[0] 是 JS 传的字符串
    int callbackId = 0;
    JS_ToInt32(ctx, &callbackId, argv[1]);           // argv[1] 是 callbackId

    // 2. 干活(这里同步示意;真异步会存 callbackId 稍后回调)
    char *content = read_file_native(path);

    // 3. 结果包回 JSValue 返回
    JSValue ret = JS_NewString(ctx, content);

    // 4. 手动释放(引用计数!漏了就泄漏)
    JS_FreeCString(ctx, path);
    free(content);
    return ret;
}

// 注册:把这个 C 函数挂成 JS 全局可调
static void register_file_feature(JSContext *ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue fn = JS_NewCFunction(ctx, file_read, "file_read", 2); // 2 = 参数个数
    JS_SetPropertyStr(ctx, global, "__file_read__", fn);          // JS: __file_read__(path, cbId)
    JS_FreeValue(ctx, global);
}
```

看这段就明白**为什么必须框架封装**:取参、类型转换、引用计数释放、注册——全是引擎细节和易错点。让每个 feature 开发者写这个,不现实。

**框架封装后,feature 开发者理想中只写这样:**

```cpp
// 框架提供基类/宏,开发者只填业务。引擎细节(取参/free/注册/回调)框架包掉
class FileFeature : public Feature {
public:
  // 框架已把 JSValue 解析成强类型参数,开发者拿到的是 std::string
  void read(std::string path, Callback cb) override {
    std::string content = readFileNative(path);
    cb.success(content);   // 框架负责把结果按 callbackId 回传 JS 并包成 Promise
  }
};
REGISTER_FEATURE("system.file", FileFeature);  // 框架提供的注册宏,内部做 JS_NewCFunction + 挂载
```

对比就清楚了:**框架把上面那段裸 C 代码(取参、free、JS_NewCFunction、callbackId 回传)全封装进 `Feature` 基类和 `REGISTER_FEATURE` 宏里,开发者只见强类型参数和 `cb.success()`。**

**串起来一句话:**

external func 底层就是"注册一个 C 函数到 JS 全局(`JS_NewCFunction` + 挂 property),函数内从 `JSValue argv` 取参、干活、把结果包回 `JSValue`,并手动管引用计数"。**这些引擎细节必须由框架封装成基类/宏/codegen,feature 开发者只写强类型的业务实现 + 用框架给的 callback 回结果。** 这层封装的好坏,直接决定这套扩展机制好不好用、第三方愿不愿意接入——这才是扩展机制设计的真正着力点。

补边界:上面 QuickJS 的 C API(`JS_NewCFunction`/`JS_ToCString`/`JS_FreeValue`)是 QuickJS 真实 API,准确;框架封装层(`Feature` 基类、`REGISTER_FEATURE` 宏)是我按合理设计给的示意,不是 vela/nyrax 的实际代码——我没读过那部分。

## QA
### 句柄的本质是引用还是指针？指针和引用的关系？（external func传参本质是参数句柄）
分两层答:先说 C++ 里指针和引用的关系(基础),再说引擎句柄的本质到底是哪种(其实两者都不完全是,是"更上一层"的东西)。

**一、C++ 里 指针 vs 引用**

本质:**引用就是"被编译器管起来、语法糖化的指针"。** 底层实现基本都是存一个地址,差别全在语言层面的约束:

| | 指针 pointer | 引用 reference |
|---|---|---|
| 存什么 | 一个地址(变量,有自己的内存) | 底层也是地址,但语言上是"别名" |
| 能否为空 | 能(nullptr) | 不能,必须绑定一个已存在的对象 |
| 能否改指向 | 能(重新赋值指向别处) | 不能,一旦绑定终身不变 |
| 用法 | 显式解引用 `*p`、`p->` | 直接当对象用,语法透明 |
| 有无自己的地址 | 有(`&p` 是指针自己的地址) | 概念上没有(`&r` 给的是被引用对象的地址) |

一句话:**指针是"显式的、可空、可改指向的地址";引用是"编译器帮你管好的、不可空、不可改指向的地址别名"。** 底层都是地址,引用只是加了约束、去了 `*` 的指针。

**二、引擎句柄(JSValue / jsi::Value)是引用还是指针?**

**都不完全是——它比裸指针/引用高一层。** 别把它等同于 C++ 的 `*` 或 `&`。它是一个**值类型的包装**,内部**含有**一个指向引擎堆对象的指针(或内联的小值),但外面套了引擎的语义。拆开看:

1. **对小值(number/bool)**:句柄里**直接内联存值**,压根没有指针。比如 JSValue 是个 tagged union,tag 说"这是 double",后面就是那个 double 本身。这时它既不是指针也不是引用,就是值。

2. **对堆对象(object/string)**:句柄内部**存的是一个指向引擎堆里那个对象的指针**。这一层确实是指针语义——多个句柄可以指向同一个堆对象(和"引用同一个对象"效果一样)。

3. **但它比裸指针多两样东西**,这才是关键:
   - **GC 语义**:引擎的 GC 会移动/回收堆对象。裸指针在 GC 移动对象后就野了;而句柄要么被 GC 感知(作为 root 参与标记,如 Hermes 的 `jsi::Value` 持有强引用防止被回收),要么有引用计数(QuickJS 是引用计数,`JSValue` 持有一份计数,`JS_FreeValue` 减一)。**所以句柄是"GC/引用计数管理下的、指向引擎堆的引用",不是随便一个 C++ 指针。**
   - **类型 tag**:句柄自带类型信息(是 number 还是 object),裸指针没有。

**所以准确定位:**

- 句柄**不是** C++ 的引用(`&`)——引用是编译期别名,没有运行时实体、不能重新绑定;句柄是个能拷贝、能传递、能重新赋值的**值对象**。
- 句柄**不是**裸指针——它带 GC/引用计数管理和类型 tag。
- 句柄**是**:一个**值类型的智能包装**,内部对堆对象持有"受引擎内存管理约束的指针"(概念上更接近 C++ 的 `shared_ptr`/智能引用,而非裸指针),对小值则直接内联。

**扣回前面的主线**:为什么"传句柄=零拷贝、免序列化"——因为对堆对象,句柄里就是那个指针,传句柄=传一个指针(几个字节),C++ 拿着它直接去引擎堆读对象,不拷贝、不编码。这就是它比"序列化整个对象成字符串"快的根源。而它又不是裸指针那么危险,因为引用计数/GC root 保证你持有句柄期间对象不会被回收或移动失效。

一句话收口:**C++ 里引用就是编译器管起来、不可空不可改指向的指针别名——底层都是地址。引擎句柄(JSValue/jsi::Value)则更高一层:它是个值包装,小值内联(既非指针也非引用),堆对象则内部持有一个受 GC/引用计数管理的指针(语义上像智能引用,不是裸指针也不是 C++ 引用)。正因为对堆对象它本质是"传一个受管理的指针",才实现了跨 JS/C++ 边界的零拷贝、免序列化。**


可以这么归纳,但要点破一层:**它们不是三个并列的方案,而是"同一件事(用地址间接访问内存)在三个抽象层级上的形态"。** 从裸到管得越来越多。

先给结论,再排层级:

**共同本质:都是"不直接持有数据,而是持有一个'怎么找到数据'的凭据,间接访问内存"。** 区别只在这个凭据被管到什么程度、暴露多少底层。

**按抽象层级从低到高排:**

| | 指针 pointer | 引用 reference | 句柄 handle |
|---|---|---|---|
| 层级 | 最底层,裸 | 中间,编译期语法糖 | 最高,运行时受管 |
| 本质 | 一个内存地址,自己是变量 | 编译器管的地址别名,不可空不可改指向 | 值包装:内含受管指针 + 类型 tag + GC/计数 |
| 谁在管 | 程序员自己管(能算术、能野) | 编译器管(约束你不能乱来) | 运行时/引擎管(GC 移动、引用计数、失效检测) |
| 底层是不是地址 | 是 | 是(别名) | 对堆对象是(内含指针);小值可能内联无指针 |
| 危险度 | 高(悬空、越界、算术) | 低(编译期约束) | 低(运行时兜底,对象不会被回收/移动失效) |

**关键的层级关系(第一性):**

1. **指针是地基**——直接就是地址,能做地址算术、能指向任意内存。最灵活也最危险(悬空指针、越界)。
2. **引用是"编译器给指针套的约束"**——底层还是地址,但语言层面禁止你为空、禁止改指向、去掉 `*` 语法。它没增加运行时能力,只是**编译期把指针的危险用法堵掉**。所以引用 ≈ "安全化的指针",纯语言层。
3. **句柄是"运行时给指针套的管理"**——它在指针之上再加一层运行时语义:类型信息、GC 参与(对象被移动时句柄仍有效)、引用计数(持有期间对象不被回收)。它解决的是指针搞不定的问题:**当被指的内存会被运行时移动或回收时,裸指针会野,句柄不会。** 所以句柄 ≈ "运行时托管的指针"。

**一句话串起三者:**

> 指针是裸地址(程序员管);引用是编译期约束下的地址别名(编译器管);句柄是运行时托管的地址凭据(运行时/GC 管)。**同一个"用地址间接访问内存"的思想,被管理的层级越来越高、暴露的底层越来越少、越来越安全。**

**扣回前面的主线**:JS 引擎用"句柄"而不是"裸指针"传参,正是因为引擎堆的对象会被 GC 移动/回收——裸指针传过去,GC 一动就野了;句柄带着引用计数/GC root,保证 C++ 持有它期间对象既不被回收也不失效。这就是"为什么跨引擎边界必须用句柄,不能用裸指针"的根本原因。所以句柄不是可有可无的花样,是**有 GC 的运行时里,指针的必然进化形态**。


## QA
### 关于js引擎和JSValue
结论先行:**在 C++ 侧,你能访问到 JS 里的几乎一切——值、对象、数组、函数,全部通过 JSValue 这个统一句柄。JS 函数当然也能拿到句柄,而且能反过来在 C++ 里调用它。** 这正是回调能回传的底层前提。

**一、JSValue 的本质**

一句话:**JSValue 是引擎对"任意一个 JS 值"的统一表示——一个 tagged union(带类型标签的联合体)。**

```
JSValue = { tag(类型标签) , 值/指针 }
```

- **tag** 说明这是什么类型:number / bool / string / object / function / null / undefined…
- 后面那部分按 tag 解释:
  - 小值(number、bool):**直接内联**存在里面,没有指针。
  - 堆对象(string、object、array、function):存的是**指向引擎堆里那个对象的指针**(受引用计数/GC 管理)。

所以 JSValue 是"万能容器"——JS 里任何东西到了 C++ 侧,都是一个 JSValue。你不需要为字符串、对象、函数各设一种类型,统一都是 JSValue,靠 tag 区分。

**二、C++ 侧能访问 JS 的什么(通过 JSValue + 引擎 API)**

拿到 JSValue 后,用引擎 API 按类型操作:

```c
JS_ToInt32(ctx, &n, val);            // number → C++ int
JS_ToCString(ctx, val);              // string → C 字符串
JS_GetPropertyStr(ctx, obj, "name"); // 读对象字段 → 又是一个 JSValue
JS_GetPropertyUint32(ctx, arr, 0);   // 读数组元素
JS_IsFunction(ctx, val);             // 判断是不是函数
JS_Call(ctx, fn, this, argc, argv);  // 调用一个 JS 函数!
```

**几乎 JS 能做的,C++ 侧都能做**:读写对象属性、遍历数组、判断类型、new 对象、调用函数、抛/捕获异常。因为引擎把 JS 的运行时对象模型完整暴露给了 C API。

**三、JS 函数——重点,能拿句柄也能反调**

JS 函数在引擎堆里就是一个 **function 对象**。C++ 侧拿到它,就是一个 tag 为 function 的 JSValue,这个 JSValue 就是**指向那个 function 对象的句柄**。

拿到之后 C++ 能做两件关键事:

1. **持有它**:存进 C++ 的数据结构里(比如存进注册表/回调表),后面再用。因为是句柄(带引用计数),只要持有就不会被 GC 回收。
2. **调用它**:`JS_Call(ctx, fnValue, thisVal, argc, argv)` —— **C++ 反过来调 JS 函数**,参数也是 JSValue 数组,返回值还是 JSValue。

这就是**异步回调回传的底层机制**:

```
JS 侧:传一个回调函数下来(onSuccess)
  → C++ 拿到它的 JSValue 句柄,存起来(引用计数 +1,防止被 GC)
原生异步干完:
  → JS_Call(ctx, 那个回调句柄, ...) 反调它,把结果作为 JSValue 参数传进去
  → 用完 JS_FreeValue 释放句柄(引用计数 -1)
```

**扣回前面 feature 债务那条**:你债务里写的"异步靠调用时**直接持有的 JS 回调句柄**回调"——说的正是这个。C++ 直接持有那个 JS 函数的 JSValue 句柄,异步完成时 `JS_Call` 反调它。**不需要 callbackId + 查表**——因为 C++ 已经拿着函数句柄本身了,直接调就行。而退化实现之所以要 requestId 查表,是因为它没直接持有句柄,只传了个 id,得回来查表找回调。**"直接持有句柄"vs"传 id 查表"的差别,根子就在这里:句柄能直接反调,id 还得查一次表。**

**一句话收口:**

JSValue 是引擎对任意 JS 值的统一句柄(tagged union:小值内联、堆对象存受管指针)。C++ 侧通过它 + 引擎 API 能访问 JS 的几乎一切——读写对象/数组、判类型、调函数。**JS 函数也是堆对象,C++ 能拿到它的 JSValue 句柄、持有(引用计数防回收)、并用 `JS_Call` 反过来调用它。** 这就是异步回调回传的底层:直接持有回调句柄就能反调,省掉 callbackId 查表那一层——这正是你 feature 设计里"直接持有 JS 回调句柄"相对"requestId 查表"退化实现的本质优势所在。