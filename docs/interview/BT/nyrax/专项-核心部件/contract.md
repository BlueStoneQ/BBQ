## 合约概述
- 合约 = 机制 + 数据
- 合约 通信的载体：
    - core - platform侧：就是cpp 虚函数
    - js - core侧：就是external func

这个理解抓住了本质。**合约 = 两侧对接的"接口机制"，两条边界各用各的机制：**

- **Core ↔ Platform**：**C++ 纯虚函数**（`MountPort::post` 那种 `= 0` 接口）。因为两侧都是 C++（或经 JNI/ObjC++ 桥），用 C++ 的接口机制——虚函数/依赖倒置。
- **JS ↔ Core**：**QuickJS External Func**（`$quickapp_runtime_v1_*$` 那批）。因为跨了 JS/C++ 语言边界，用 QuickJS 暴露 C 函数给 JS 调的机制。

**合约 = 机制 + 数据**，虚函数/external func 是"怎么调"，还有一半是"传什么"：

| 边界 | 调用机制（怎么调） | 数据契约（传什么） |
|---|---|---|
| Core↔Platform | C++ 纯虚函数（Port） | MountTransaction / MeasureRequest… 结构体 |
| JS↔Core | QuickJS External Func | message 对象（→ RuntimeValue） |

所以更完整的一句：**合约 = "调用机制 + 数据结构"两半。机制上——Core↔Platform 是 C++ 纯虚函数,JS↔Core 是 QuickJS External Func;数据上——两侧各有约定的消息结构(MountTransaction / message)。** 你说的"虚函数 / external func"是**机制那半**，抓得准；再加上"传什么的数据结构"就齐了。

一句收束：**对——合约本质就是"两侧对接的接口机制":Core↔Platform 用 C++ 纯虚函数(依赖倒置),JS↔Core 用 QuickJS External Func。机制随边界跨什么而定。完整地说,合约=机制(虚函数/external func)+数据(约定的消息结构),你抓住的是机制那半,准确。**

## surface/mount/measure/feature port
- Contract = Core↔平台的一组纯虚接口(Port);四个 Port 本质同一个"抽象消息端口"模式,只是消息不同——Surface Port(管屏)、Mount Port(下发 MountTransaction 建 View)、Measure Port(同步问平台量尺寸)、Feature Port(系统能力接入)。Mount/Surface 单向 post 异步,Measure 同步返回。这些纯虚类就是"依赖抽象接口"的实体,Core 只依赖它们、平台各自实现,于是一 Core 喂三端、可插拔可裁剪。它是架构图的核心,串起事务(Mount Port 载体)、runtime tree(产出方)、依赖倒置(Port 即接口)。

## Measure contract

**谁需要、需要什么信息** —— **Yoga 需要"叶子内容的真实尺寸"，只有平台知道。**

看 MeasureRequest 字段就懂：Core 发给平台的是 `{ text, font_token, font_size, font_weight, width/height 约束, role }`，平台返回 `{ width, height }`。

本质：**Yoga 能算 flex 布局（怎么排、怎么分空间），但算不出"这段文字用这个字体这个字号,实际占多宽多高"**——因为**字体的字形度量在平台**（Android 的 TextPaint/iOS 的 CoreText/LVGL 的字库），Core 是平台无关的 C++，它没有字体引擎。

所以 Measure Port 的触发者是 **Yoga 布局过程中遇到"内容尺寸依赖平台的叶子节点"**（Text/Button/Input——前面 minimal_layout_engine 里给这些挂 measure func 的那段）：Yoga 排到这个节点、要它的尺寸时,回调 measure → Core 通过 Measure Port **同步问平台**"这段 text 多大" → 平台用自己的字体引擎量好返回 → Yoga 拿到尺寸继续排整棵。

**Yoga 需要 platform 信息吗** —— **只需要一样:文本/内容的度量尺寸(width/height)。** 其余布局输入（flex 方向、约束、margin/padding）都在 style 里、Core 自己有。**唯一 Core 给不出、必须问平台的,就是"文字/图片这类内容自身占多大"**——因为那取决于平台字体引擎。这也是为什么 Measure 必须**同步**(measure 返回值直接喂给 Yoga 那一拍,等不了异步)。

`platform_font_generation` 那个字段还点出一个细节：**字体是会变的**（系统换字体/字号），所以带个"字体代次",字体变了度量结果失效、要重量。

**hap 里需要这个信息吗** —— **需要,但机制不同,不用这种"跨边界 Measure Port"。**

hap 也要量文本尺寸(任何 UI 都要),但 **hap 的 Yoga 和文本 View 在同一侧(都在 Android/Java)**——Yoga 节点直接挂在 Android View 上,量文本时**直接问那个 TextView/TextPaint 就行,同进程直接调,不用跨语言 Port**。

所以差异的根在**"Yoga 在哪一侧、离字体引擎远不远"**：
- **hap**:Yoga 在 Android 侧,和字体引擎(TextPaint)同侧 → 直接量,无需 Port。
- **nyrax**:Yoga 在平台无关 C++ Core,**离字体引擎隔了一条语言/平台边界** → 必须用 Measure Port 跨边界同步问平台。

**所以 Measure Port 是 nyrax "把 Yoga 下沉到平台无关 Core" 付的代价**——Yoga 一旦离开平台,就够不到字体引擎了,只能开一个同步回问的口子。hap 不下沉,没这问题,但也就享受不到"一套布局喂三端"。

一句收束:**Measure Port 是 Yoga 在布局中遇到文本/图片这类内容叶子时,同步向平台问"这段内容占多大宽高"的口子——因为字体字形度量在平台(TextPaint/CoreText/字库),平台无关的 Core 算不出。Yoga 只缺这一样平台信息,其余布局输入自己有。hap 也要量文本,但它 Yoga 和字体引擎同在 Android 侧、直接量,不需要跨边界 Port;nyrax 因把 Yoga 下沉到 C++ Core、隔了边界,才必须开这个同步 Measure Port——这是 Yoga 下沉换来"一套布局喂三端"所付的代价。**

## 是需要每一个文本的尺寸信息吗 还是说 需要一个即可
**每一个需要测量的文本节点都要单独问一次——不是问一次就够。**

看代码事实（minimal_layout_engine 那段）：它是**遍历所有节点**，给每个符合条件的（Text/Button/Input 且没写死宽高）**各挂一个 measure func**。Yoga 算到哪个节点，就为**那个节点**回调一次 measure，带**那个节点自己的** text/font/约束去问平台。10 个不同文本 = 10 次 measure 请求。

为什么必须一个一个问：因为**每个文本的内容、字号、约束都不同**，尺寸各不相同——"你好"和一整段话占的宽高天差地别。平台度量的是"**这段具体文字 + 这个字体字号 + 这个宽度约束**"下的结果，**没有"一个通用尺寸"能复用**。所以是 per-node 的。

但有两点让它不至于失控（这才是完整答案）：

1. **只有"内容尺寸未定"的叶子才问**——写死了 `width`/`height` 的节点不问（代码里那个条件：`width==null || height==null` 才挂 measure func）。容器、定宽高的节点都跳过。**不是所有节点都问,只问"尺寸由内容决定"的文本类叶子。**

2. **有缓存维度**——MeasureRequest 带 `content_revision` + `platform_font_generation`。意思：**同一节点、内容没变、字体没变,结果可缓存复用,不用重复问平台**。只有内容变了或字体换了才重新量。（这是"能缓存就别重复跨边界"的优化。）

所以准确说：**不是"问一个就够",是"每个内容尺寸待定的文本叶子各问一次";但定宽高的不问、且同节点内容/字体不变时结果可缓存复用。** per-node 是必须的(每段文字尺寸不同),缓存是省重复的。

一句收束:**每个"内容决定尺寸"的文本类叶子(Text/Button/Input 且没写死宽高)都要单独 measure 一次——因为各自内容/字号/约束不同、尺寸互不通用,不能一个顶所有;但定宽高的节点跳过不问,且靠 content_revision + font_generation 做缓存,内容和字体没变就复用、不重复跨边界问。per-node 必需,缓存去重。**

## contract示例：mount contract
- 本质就是定义在core侧的虚函数，由platform侧在JNI之类的地方实现，core侧调用
```cpp
// ── Mount Contract：Core↔平台 只靠"数据 + 一个接口"对齐 ──

/** 
MountTransaction 是 C++ 结构体，从 Core 发到平台适配器时是内存里的对象/引用，不 JSON。 但到"平台适配器 → 平台原生语言"那一小步，取决于平台：
- LVGL（同进程 C/C++）：Core 和适配器都是 C++，纯内存对象直接传，零序列化零拷贝。这是最纯的。
- Android（C++ → Java）：走 JNI。不是 JSON 序列化，但 JNI 层会把 C++ 的 MountOperation 逐字段构造成 Java 对象（NewObject 建 MountOperation[]/- MountTransaction，前面 jni_gateway 看过）。是"结构转换"不是"字符串序列化"——没有 JSON 编解码，但有 C++结构→Java对象 的字段搬运。
- iOS（C++ → Swift）：走 ObjC++ 桥，同理——结构转换，不 JSON。


零成本：LVGL 同进程，C++ 对象直传。
结构转换（非序列化）：Android/iOS，JNI/ObjC++ 把 C++ 结构搬成宿主语言对象——免了 JSON 编解码那层,但有跨语言的对象构造。
从来没有的：JSON 字符串序列化。这正是 nyrax 相对 hap 的改进点——hap 那跳是 JSON 序列化(callNative 传 argsString),nyrax 这跳是 native 结构直传/转换,免 JSON。

其实就是渲染指令，这些组合成的东西 就是渲染事务
*/
// 1. 6 种原子操作（一个 variant）—— 平台能听懂的全部指令，全用 NodeId 寻址
using MountOperation = variant<
  CreateHost      { NodeId id; ComponentType type; },   // 建节点
  SetHostProp     { NodeId id; string name; Value v; }, // 设属性
  SetHostLayout   { NodeId id; Rect rect; },            // 设坐标(布局结果)
  InsertHostChild { NodeId id; NodeId parent; int index; }, // 挂到父下第几位
  MoveHost        { NodeId id; NodeId parent; int index; },  // 移动
  RemoveHost      { NodeId id; }                        // 删除
>;

// 2. 一个事务 = 一批操作（原子整体）+ 版本号（对账）
struct MountTransaction {
  SurfaceId surface;              // 哪块屏
  uint64_t revision;             // 版本，回传对账用
  MountMode mode;                // 全量 / 增量
  vector<MountOperation> operations;  // 一批操作
};

// 3. 接口：Core 只依赖这个纯虚 Port，平台去实现
class MountPort {
  virtual void post(MountTransaction&&) = 0;   // Core 发；平台实现"怎么变成真 View"
};

// 4. 平台干完回传结果（成/败 + 版本）
struct MountTransactionResult {
  SurfaceId surface; uint64_t revision;
  bool mounted; optional<Error> error;
};

```

## js->cpp:core 渲染指令
```js
JS 侧: framework 造 message = {surfaceId, revision, operations:[{kind:"updateBinding", ...}]}
        —— 一个普通 JS 对象（QuickJS 堆对象）
   ↓ 调 $quickapp_runtime_v1_submitRenderTransaction$(message)  ← external func，参数是 JSValue
Core 侧(C++, ABI service):
   → engine_->toRuntimeValue(ctx, valueRef, limits)   ← 把 JSValue 直接读成 C++ 的 RuntimeValue
   → 不 JSON.stringify、不 parse，逐字段从 QuickJS 对象读出来
   → 转成 RenderTransactionIntent 投递给 Core
```
- 传的是 JSValue（QuickJS 对象句柄），不是 JSON 字符串。external func 的参数本来就是 JSValue。
- toRuntimeValue = 免序列化的读取：C++ 直接遍历那个 QuickJS 对象的字段（JS_GetPropertyStr 那套），把值搬进 C++ 的 RuntimeValue。是"跨语言读字段"，不是"字符串编解码"——和前面 Mount 那跳 JNI 结构转换同一个性质。
- 对比 hap：hap 是 callNative(pageId, argsString)——argsString 是 JSON 字符串,两边 stringify/parse。nyrax 是 JSValue 直读成 RuntimeValue,免了 JSON。这就是"免 JSON 序列化 Bridge"在 JS→Core 这跳的体现。


## 关于渲染事务的原子性
原子性只在 Core 侧成立（build-then-commit），跨到平台就没有原子性、无法回退——平台失败靠 revision 对账 + 重建收敛，不是回退。

1. 原子性怎么保证？一批一批的吗？

是一批一批（一个 MountTransaction = 一批 operations）。但原子性不是靠"批"本身，是靠 Core 侧的 build-then-commit：

Core 生成事务时,在暂存区(staged)上把整批算齐 + 逐步校验;全部成功才产出一个完整 MountTransaction,中途任一步失败就丢弃草稿、真实 runtime tree 一个字节没动。
不改真身、只改草稿 → 失败无需回退(压根没提交)。这是 Core 内的原子性。
2. 但平台是一条一条消费的——一条报错怎么回退？

答案：平台侧不回退,也无法回退。 这是你这三问里最关键、也最该讲清的边界:

Core 把事务序列化式地发出去(单向指令),一旦发出就"已提交"。平台一条条消费 operations,消费到第 5 条报错——Core 手里没有平台的 undo 句柄,退不了前 4 条。
原因就是前面聊的:跨边界发的是单向指令流,不是函数直调。函数直调能拿返回值同步回退;指令流出门即不可撤回。
3. 那平台失败到底怎么处理?

不是回退,是对账 + 重建(render-pipeline.md 里核过的 MountCoordinator.accept 逻辑):

事务带 revision。平台处理完回 MountTransactionResult{ mounted, error }。
失败:Core 收到 mounted=false → 发失败 marker + 上报给上游 + revision 不推进(停在上一个成功版)。
关键:revision 不推进,保证两边状态不错位——Core 的"已确认状态"和平台实际状态都停在失败前那版,只是"这次更新没生效"。
要恢复:不是撤销上一批,而是上层重新发起渲染 → Core 基于当前权威 runtime tree 重新生成正确的 mount → 让平台重建到正确态。用"重放到正确态"代替"回退到旧态"。
诚实边界:当前 MountCoordinator 不自动重发,止于"标记失败+版本不推进+上报",重试由上层触发。
为什么这样设计能成立(第一性):因为权威在 Core 的 runtime tree。平台只是 Core 状态的一个镜像/投影。镜像坏了不用"回退镜像",直接"拿权威重新投一次"就对了。有单一权威做锚,就不需要分布式回滚——重放比回退简单、也更可靠。 这正是"单一权威 tree"这个设计的红利。

一句收束:事务一批一批发(MountTransaction=一批 operations)。原子性只在 Core 内:build-then-commit——暂存区算齐才提交,失败丢草稿、真身不动,无需回退。跨到平台没有原子性也无法回退:发的是单向指令,一条报错退不了前面几条;靠 revision 对账(失败不推进版本、两边停在同一旧态)+ 基于权威 runtime tree 重放重建来收敛,不是回退。能这么做的根:Core 是单一权威,平台是镜像,镜像坏了重投即可,不需分布式回滚。