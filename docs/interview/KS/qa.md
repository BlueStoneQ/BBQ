# KS Q&A

> 支付业务前端，问题驱动，结构化回答。

---

## 总览

| 方向 | 子方向 | 为什么有挑战 |
|------|--------|-------------|
| **安全** | HTTPS / CSP / XSS 防御 / CSRF / 防钓鱼 | 支付页面被注入 = 用户资金损失 |
| **防重复提交** | UI 禁用 / 请求去重 / 幂等 key | 用户连点 = 重复扣款 |
| **金额精度** | 整数传输 / 展示格式化 / 输入校验 | JS 浮点精度丢失 |
| **支付状态轮询** | 递增间隔 / 超时兜底 / 回调不可信 | 异步回调不确定性 |
| **取消/超时** | AbortController / 倒计时 / 超时≠失败 | 网络不确定性 |
| **Native 调用** | RN 调微信/支付宝 SDK | 跨端桥接 |
| **支付全链路** | 收银台→跳转→回来→确认 | 状态机复杂 |
| **用户体验** | 感知性能 / 操作效率 / 容错设计 / 信息层级 | 体系化叙述 |


- RN — 性能优化（启动/渲染/包体）、Native 桥接（支付 SDK）、平台差异
- H5 — 移动端 H5 的坑（键盘/1px/安全域/微信环境差异）、性能（首屏/秒开）
- 可观测 — 指标体系/埋点/监控（你 app-metrics 已有）
- 工程化 — CI/CD/组件库

---

## 目录

- [1. 安全](#1-安全)
  - [1.1 HTTPS](#11-https)
  - [1.2 CSP（Content Security Policy）](#12-cspcontent-security-policy)
  - [1.3 XSS 防御](#13-xss-防御)
  - [1.4 CSRF 防御](#14-csrf-防御)
  - [1.5 敏感数据不落盘](#15-敏感数据不落盘)
  - [1.6 安全键盘（H5 + RN）](#16-安全键盘h5--rn)
- [9. 鉴权（前端视角）](#9-鉴权前端视角)
- [2. 防重复提交（幂等）](#2-防重复提交幂等)
  - [2.1 UI 层禁用](#21-ui-层禁用)
  - [2.2 请求层去重](#22-请求层去重)
  - [2.3 幂等 key](#23-幂等-key)
- [3. 金额精度](#3-金额精度)
- [4. 支付状态轮询](#4-支付状态轮询)
- [5. 取消/超时兜底](#5-取消超时兜底)
- [6. Native 调用（RN 调支付 SDK）](#6-native-调用rn-调支付-sdk)
- [7. 支付全链路（前端视角）](#7-支付全链路前端视角)
- [8. 用户体验](#8-用户体验)

---

## 1. 安全

> **第一性原理**：支付页面被攻击 = 用户资金直接损失。前端是第一道防线，核心是"不信任任何外部输入 + 限制可执行的内容"。

### 1.1 HTTPS

#### 中间人是什么

**本质**：中间人（MITM）= 一个能读写你网络流量的第三方。

HTTP 是明文传输，数据从客户端到服务器要经过很多跳（路由器、Wi-Fi 热点、运营商、代理……）。任何一跳如果被恶意控制，就能**读取**（窃听）和**修改**（篡改）所有经过的数据。

**为什么能截取**：HTTP 包体在网络层就是普通文本，和你看到的一模一样。中间人不需要"破解"，直接读就行 — 就像邮递员拆开没封口的信。

#### 中间人的危害（场景）

| 场景 | 攻击方式 | 后果 |
|------|---------|------|
| 咖啡店 Wi-Fi | 攻击者开一个同名 Wi-Fi，所有流量经过他 | 读取用户名密码、银行卡号 |
| 运营商劫持 | 运营商在响应里注入广告 JS | 页面被篡改、插广告、甚至注入恶意脚本 |
| 支付场景 | 篡改收款账号字段 | 用户确认支付，钱转到攻击者账户 |
| 登录场景 | 窃取 session cookie | 攻击者冒充用户身份操作 |

#### HTTPS 握手过程

**Q：HTTPS 握手做了什么？**

握手分两步：先确认身份（防伪装），再协商密钥（防窃听）。

**① 校验签名，避免服务端公钥被伪造**

前提：公司提前向 CA 申请了证书 = { 域名 + 公钥 + CA用私钥对内容做的签名 }。

```
服务器 → 浏览器：给你我的证书

浏览器验证：
  1. 用系统内置的 CA公钥 解密证书中的签名 → 得到 hash₁（CA 当初算的）
  2. 自己对证书内容（域名+公钥）重新算一次 hash → 得到 hash₂
  3. hash₁ === hash₂ → ✅ 证书没被篡改，公钥可信
     hash₁ !== hash₂ → ❌ 内容被改过，报错"不安全"
```

**为什么中间人伪造不了**：他可以改公钥，但没有 CA 私钥就造不出合法签名 → hash 对不上 → 浏览器拒绝。

**② 生成传输用对称密钥（ECDHE 密钥协商）**

身份确认后，双方需要协商一个对称密钥用于后续加密通信：

```
浏览器：本地生成临时密钥对（私钥 a + 公钥 A(证书中的服务端公钥)）
服务器：本地生成临时密钥对（私钥 b + 公钥 B）

双方只交换公钥：浏览器发 A，服务器发 B

各自在本地计算共享密钥：
  浏览器算：a × B = 共享密钥
  服务器算：b × A = 共享密钥
  数学保证：a × B === b × A（椭圆曲线性质）

→ 后续所有数据用这个对称密钥加密传输
```

**关键**：私钥（a、b）永远不离开本地，网络上只传公钥 A 和 B。中间人拿到 A 和 B 也算不出共享密钥（没有 a 或 b）。

**两组密钥的区分**：

| 密钥 | 作用 | 生命周期 |
|------|------|---------|
| 证书里的公钥 | 身份确认（步骤①） | 长期（证书有效期内） |
| 临时密钥对 A/B | 协商对称密钥（步骤②） | 单次连接（每次握手重新生成） |
| 对称密钥 | 加密实际数据传输 | 单次连接 |

#### 前端做什么

- 全站强制 HTTPS（后端配 301 重定向）
- 配 HSTS header → 浏览器记住"这个域名永远只用 HTTPS"，防降级攻击（中间人把 HTTPS 请求降级为 HTTP）

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

### 1.2 CSP（Content Security Policy）

**解决什么**：即使被 XSS 注入了 `<script>`，CSP 让它无法执行。

**谁定义的**：后端，通过 HTTP 响应头 `Content-Security-Policy` 下发给浏览器。前端不写代码，浏览器收到后自动执行策略。

**是白名单吗**：是。告诉浏览器"这个页面只允许加载以下来源的资源"，不在白名单里的一律拦截。

**白名单里是什么**（资源来源 = 域名/协议）：

```
Content-Security-Policy: 
  script-src 'self' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://img.example.com;
```

| 指令 | 白名单内容 | 含义 |
|------|-----------|------|
| `script-src 'self'` | 只有同域脚本 | 外域 / inline 的 `<script>` 全拦截 |
| `style-src 'self' 'unsafe-inline'` | 同域 CSS + 允许 inline style | `<style>` 标签可用 |
| `img-src *` | 所有来源的图片 | 图片不限制 |

**怎么防 XSS — 原理**：

```
XSS 攻击：攻击者注入 <script>steal(cookie)</script> 到页面 HTML
                        ↓
浏览器检查：这个 script 来源是 inline（不是 'self' 域名的外链文件）
                        ↓
CSP 策略：script-src 'self' → inline 不在白名单
                        ↓
浏览器：拒绝执行 ❌ + 控制台报 CSP violation
```

**本质**：把"能执行什么"的决定权从"页面内容"转移到了"响应头"。即使攻击者能注入 HTML，浏览器也不执行不在白名单里的脚本。

**支付页最佳实践**：`script-src 'self'`（不允许 inline script，不允许外域脚本）。

---

### 1.3 XSS 防御

**解决什么**：攻击者把恶意脚本注入到页面里执行。

**怎么注入的**：攻击者把脚本当"正常内容"提交（评论/昵称/URL 参数），存入数据库，其他用户浏览时前端渲染出来 → 浏览器把它当正常代码执行。

```
攻击者在评论框输入：<script>steal(cookie)</script>
  → 后端没过滤，存进数据库
  → 其他用户打开页面 → 前端直接渲染到 HTML
  → 浏览器当正常 <script> 执行 → cookie 被偷
```

**为什么能执行 — JS 执行的口子**：

| 执行入口 | 危险场景 |
|---------|---------|
| `<script>` 标签加载 | 注入的 `<script>` 被浏览器解析执行 |
| `innerHTML` / `v-html` / `dangerouslySetInnerHTML` | 把用户输入当 HTML 渲染 |
| `eval(userInput)` | 把字符串当代码执行 |
| `new Function(userInput)` | 动态创建函数并执行 |
| `<img onerror="...">` / `<a href="javascript:...">` | 事件属性/伪协议注入 |

**本质**：前端把"数据"当"代码"渲染/执行了。

**防御**：

| 层 | 做什么 |
|----|--------|
| **转义（主动防御）** | 所有用户输入 escape 后再渲染（`<` → `&lt;`）。React 默认做了，`dangerouslySetInnerHTML` 除外 |
| **CSP（被动兜底）** | 即使漏了转义，inline script 也执行不了（白名单拦截） |
| **HttpOnly Cookie** | 即使脚本执行了，也读不到 session cookie |
| **禁用危险 API** | 不用 `eval` / `new Function` / `innerHTML` 处理用户输入 |

**React 为什么默认安全**：JSX 对所有变量做 HTML 转义，`{userInput}` 不会被当 HTML 执行。只有 `dangerouslySetInnerHTML` 是唯一入口。

---

### 1.4 CSRF 防御

**解决什么**：攻击者诱导用户点击一个链接，利用用户已登录的 cookie 发起伪造请求。

**场景**：用户登录了支付网站 → 点了钓鱼邮件里的链接 → 链接发起转账请求 → cookie 自动带上 → 后端以为是用户本人操作。

**前端做什么**：
1. **CSRF Token**：后端种一个 token 在 cookie（或页面），前端读出来放到请求 header（`X-CSRF-Token`）。攻击者跨域拿不到 token → 伪造请求不带 token → 后端拒绝。
2. **SameSite Cookie**：`SameSite=Strict` / `Lax` — 跨站请求不带 cookie。

---

### 1.5 敏感数据不落盘

**规则**：卡号、CVV、密码等 → 不存 localStorage / sessionStorage / 不打日志 / 不在 URL 里传 / 输入完立即提交清空。

**为什么**：XSS 即使突破了前面的防线，如果敏感数据没存在前端，也拿不走。

---

### 1.6 安全键盘（H5 + RN）

**解决什么**：系统键盘可被第三方输入法监听（输入法记录用户输入），支付密码输入需要独立安全键盘。

**H5 — 前端自绘**：

H5 没有系统级安全键盘，需要自己造：
- 用 `<div>` 模拟键盘 UI（不用 `<input>`，不唤起系统键盘）
- 键位随机排列（防录屏/肩窥按位置猜密码）
- 输入值不存 DOM / 不存明文变量（加密后直接传后端）
- 严格 CSP 防 CSS/JS 注入读取内容

本质：造一个不可被输入法/浏览器插件监听的输入界面。

**RN — 调 Native 安全键盘**：

不自己做，调 Native SDK 提供的安全键盘组件：

```js
SecureKeyboard.show({
  onComplete: (encryptedPin) => {
    // 拿到的直接是加密后的密文，JS 层看不到明文
    submitPayment({ pin: encryptedPin })
  }
})
```

Native 安全键盘运行在独立进程/安全区域，截屏 API 和辅助功能都无法读取。

**对比**：

| 平台 | 谁做 | 安全等级 |
|------|------|---------|
| H5 | 前端自绘（div 模拟 + 随机键位 + 不存明文） | 中（防输入法，防不了 XSS） |
| RN / Native | 调 SDK 安全键盘（独立进程，JS 拿不到明文） | 高 |

---

## 2. 防重复提交（幂等）

> **第一性原理**：网络不确定 + 用户不耐烦 = 同一个请求可能发多次。扣款只能扣一次。

### 2.1 UI 层禁用

最简单的一层：点击后 `button.disabled = true` + loading 态，请求完成才恢复。

防止的是"用户手快连点"。

### 2.2 请求层去重

请求拦截器里：如果同一个 URL + 同样参数的请求正在 pending，不重复发。

```ts
// axios 拦截器伪代码
const pendingMap = new Map();
const key = `${method}:${url}:${JSON.stringify(data)}`;
if (pendingMap.has(key)) return pendingMap.get(key); // 返回同一个 promise
const promise = axios(config);
pendingMap.set(key, promise);
promise.finally(() => pendingMap.delete(key));
```

防止的是"网络慢用户刷新重试"或"组件重渲染导致 useEffect 重复请求"。

### 2.3 幂等 key

**最关键的一层**（前两层都可能被绕过，这层是后端兜底）：

```
1. 进入支付页 → 前端生成 uuid（crypto.randomUUID()）
2. 提交支付 → 请求头带 X-Idempotency-Key: <uuid>
3. 后端收到 → 用 key 查 Redis：
   - 没有 → 写入 + 执行扣款 + 返回结果
   - 有了 → 直接返回上次结果（不重复扣款）
4. 同一个 key 无论请求几次，后端只执行一次
```

**关键细节**：
- uuid 在**进入页面时**生成一次，不是每次点击生成（否则每次都是新 key，去重失效）
- 支付成功后清除，下次新订单用新 key

**一句话**："三层防线：UI 禁用 → 请求去重 → 幂等 key。前两层防用户操作，第三层防系统/网络重试。"

---

## 3. 金额精度

**本质**：JS 浮点数（IEEE 754）无法精确表示小数 → `0.1 + 0.2 = 0.30000000000000004`

**行业约定**：全链路用最小货币单位整数传输存储（人民币 = 分，`¥1.50` 存 `150`）。

| ✅ 前端做 | ❌ 前端不做 |
|-----------|------------|
| 展示格式化（分→元，`(amount / 100).toFixed(2)`） | 计算订单总价 |
| 输入校验（最多 2 位小数） | 计算折扣/优惠 |
| 提交时转整数分 `Math.round(parseFloat(input) * 100)` | 任何影响实际扣款的计算 |

**为什么计算放后端**：安全（前端可篡改）+ 一致性（多端统一）+ 审计（可追溯）。

**如果前端必须算**（购物车预览）：转分做整数运算，或用 `big.js` / `decimal.js`。

---

## 4. 支付状态轮询

**场景**：用户跳到微信/支付宝支付完 → 回到 App → 怎么知道结果？

**本质**：第三方支付回调是给后端的（webhook），可能延迟 5-30s，前端不能干等。

**策略**：

```
用户支付完回来
  ↓
前端立即开始轮询: GET /api/order/{id}/status
  ├── 间隔策略：1s → 2s → 3s → 5s（递增，避免轰炸后端）
  ├── 最多轮询 60s
  └── 三种结果：
      ├── paid → 成功页
      ├── failed → 失败 + 重试按钮
      └── pending（超时） → "支付处理中，稍后查看订单"
```

**为什么不只靠回调**：回调给后端不给前端 + 可能延迟/丢失 + 前端不轮询用户看到的是未知状态。

---

## 5. 取消/超时兜底

| 场景 | 处理 |
|------|------|
| 请求超时（网络慢） | `AbortController` + 10s 超时 → 提示 + 轮询确认 |
| 用户主动取消 | abort 当前请求 + 调关单接口 |
| 倒计时到期（15min） | 展示超时 + 调关单接口 |
| 切后台回来 | 重新查询订单状态（可能已被后端关闭） |

**核心认知：请求超时 ≠ 支付失败**。前端 abort 只是放弃等响应，后端可能已扣款成功 → 超时后必须轮询确认状态，不能直接让用户重试支付。

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 10000);

try {
  const res = await fetch('/api/pay', { signal: controller.signal, method: 'POST', body });
  clearTimeout(timer);
} catch (e) {
  if (e.name === 'AbortError') {
    // 超时 → 不代表失败！轮询确认
    showToast('网络超时，正在确认状态...');
    pollOrderStatus(orderId);
  }
}
```

**AbortController 本质做了什么？**

abort() 不是"撤回已发出的请求"。TCP 包已经到服务器了，后端业务层完全感知不到前端的 abort — 该执行的逻辑照常执行。

abort() 实际做的事：告诉浏览器"我不要这个响应了" → 浏览器关闭底层 TCP 连接 → fetch 的 Promise reject 一个 AbortError。

| 请求所处阶段 | abort 的效果 |
|-------------|-------------|
| 还没发出（DNS/建连中） | ✅ 真的取消了，不发了 |
| 已发出，等响应中 | ❌ 后端该执行的已执行，只是浏览器不读响应了 |
| 响应正在下载（大文件/流） | ✅ 停止接收剩余数据，节省带宽 |

**所以**：abort 了但后端可能已经扣款成功了。前端 abort 是纯客户端行为，后端业务层无感知。这就是为什么 abort 之后必须**轮询确认**，绝不能直接展示"支付失败"或让用户重新支付。

---

## 6. Native 调用（RN 调支付 SDK）

**本质**：微信/支付宝 SDK 是 Native 的，RN 通过 NativeModule 桥接。

**流程**：

```
RN 层                      Native 层                  第三方
  │                           │                        │
  │─ 1. 请求后端下单          │                        │
  │   → 后端返回支付参数       │                        │
  │                           │                        │
  │─ 2. NativeModule.pay() ──→│                        │
  │                           │─ 3. 调 SDK ──────────→│ 拉起支付
  │                           │                        │ 用户确认
  │                           │←─ 4. SDK 回调 ─────────│
  │←─ 5. Promise resolve ────│                        │
  │                           │                        │
  │─ 6. 轮询确认              │                        │
```

**关键点**：
- 支付参数由**后端生成并签名**，前端只是搬运工
- SDK 返回成功 ≠ 实际到账（回调可能丢），必须轮询后端确认
- 社区方案：`react-native-wechat-lib`

**RN Native Plugin 安装机制**：

NativeModule / TurboModule 一般封装成 npm 包发布（如 `react-native-wechat-lib`）。一个包的结构：

```
react-native-wechat-lib/
├── package.json          ← 声明 react-native 字段（autolinking 入口）
├── src/                  ← JS/TS 层（暴露给 RN 调用的 API）
├── ios/                  ← iOS 原生代码（.m/.swift + .podspec）
├── android/              ← Android 原生代码（.java/.kt + build.gradle）
└── react-native-wechat-lib.podspec
```

安装时机：**原生构建时**，不是 npm install 时。

| 平台 | 何时生效 | 做了什么 |
|------|---------|---------|
| iOS | `pod install` | autolinking 扫描 node_modules → 找到 podspec → 写入 Podfile 依赖 → CocoaPods 编译原生代码 |
| Android | Gradle sync | autolinking 扫描 node_modules → 生成 `PackageList.java` → 注册 NativeModule → 依赖就位 |

`npm install` 只是下载源码到 node_modules；真正"装进原生工程"是 `pod install`（iOS）和 `gradle build`（Android）。

RN >= 0.60 后 autolinking 自动完成，不需要手动 `react-native link` 了。

---

## 7. 支付全链路（前端视角）

```
┌─ 收银台页面 ──────────────────────────────────────────┐
│                                                        │
│  1. 进入页面                                           │
│     ├─ 生成幂等 key（uuid）                            │
│     ├─ 请求订单详情（后端返回分，前端 /100 展示）       │
│     └─ 启动倒计时（15min 未支付自动关单）               │
│                                                        │
│  2. 用户确认支付                                       │
│     ├─ 按钮 disabled + loading                         │
│     ├─ 带幂等 key 提交                                 │
│     └─ 后端返回支付跳转参数                            │
│                                                        │
│  3. 跳转第三方 / 调 Native SDK                         │
│     ├─ H5：window.location → 支付宝页面                │
│     ├─ RN：NativeModule.pay(params)                    │
│     └─ 小程序：wx.requestPayment(params)               │
│                                                        │
│  4. 回来后                                             │
│     ├─ 轮询 GET /order/status（递增间隔，最长 60s）     │
│     ├─ paid → 成功页                                   │
│     └─ timeout → "处理中，请稍后查看"                   │
│                                                        │
│  5. 异常兜底                                           │
│     ├─ 网络超时 → AbortController + 轮询确认           │
│     ├─ 用户取消 → 关单接口                             │
│     └─ 倒计时到期 → 展示超时 + 关单                    │
└────────────────────────────────────────────────────────┘
```

**前端不做**：金额计算、折扣计算、签名生成、扣款、回调处理（webhook 后端收）。

---

## 8. 用户体验

→ 参考 [前端性能优化](../root/basic/frontend_performance_interview_basic.md)（性能感知部分）

体系化叙述框架：**感知性能 × 操作效率 × 容错设计 × 信息层级**

| 维度 | 本质 | 支付场景举例 |
|------|------|-------------|
| 感知性能 | 用户"觉得快" | 点支付后立即 loading + 进度，不是白屏 |
| 操作效率 | 减少操作步数 | 记住上次支付方式、默认选中、一键支付 |
| 容错设计 | 出错不慌 | 失败给明确原因 + 重试，不是"网络错误" |
| 信息层级 | 重要的最先看到 | 金额最大最醒目，🔒安全标识增强信任 |

（待补充具体 case）

---

## 9. 鉴权（前端视角 · JWT）

> **第一性原理**：鉴权解决"你是谁" + "你能干什么"。支付场景对鉴权要求最高。

### 9.1 鉴权发生在什么时候？

**每次接口调用都鉴权**。后端网关/中间件在请求到达业务逻辑之前就校验 token，不通过直接返回 401，请求不会到达业务层。

### 9.2 两个阶段：赋权 vs 鉴权

| 阶段 | 什么时候 | 谁做 | 做了什么 |
|------|---------|------|---------|
| **赋权（认证）** | 用户登录时（一次） | 后端 | 验证账号密码 → 签发 JWT token 给前端 |
| **鉴权（验证）** | 每次请求时 | 后端网关 | 验证 token 是否合法、是否过期 |

### 9.3 后端给前端什么凭证？

**JWT 本质**：一个防篡改的身份证 — 安全地把 userId 从客户端带到服务端，后端不用查数据库就能确认"这个请求是谁发的"。

JWT token — 一个字符串，三段用 `.` 连接：

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMiLCJleHAiOjE3MTk5fQ.s8Kx2Jv...
│── Header ──│──── Payload ────│──── Signature ────│
  算法声明      用户信息+过期时间    后端用 secret 签名
```

| 段 | 内容 | 作用 |
|----|------|------|
| Header | `{ "alg": "HS256" }` | 声明签名算法 |
| Payload | `{ "userId": "123", "exp": 1719900000 }` | 用户信息 + 过期时间（base64 编码，不是加密，任何人可解码） |
| Signature | `HMAC-SHA256(Header.Payload, secret)` | 防篡改的关键 |

**secret 是什么**：只存在后端的密钥字符串，永远不发给前端，不在网络上传输。是签名和验签的"钥匙"。

**签名防的是什么**：不是防中间人（HTTPS 已经防了），是**防用户自己篡改 payload 冒充他人**：

```
用户 A 登录 → 拿到 token，payload = { userId: "A" }
攻击：A 把 payload 改成 { userId: "B" } → 想冒充 B 操作 B 的余额
防御：改了 payload → 后端用 secret 重算签名 → 和 token 里的 Signature 对不上 → 401
原因：A 没有 secret，造不出合法签名
```

**后端怎么把 JWT 给前端**：

| 方式 | 怎么给 | 前端怎么拿 |
|------|--------|-----------|
| **Set-Cookie 响应头**（推荐） | 登录响应带 `Set-Cookie: token=xxx; HttpOnly; Secure` | 前端不用管，浏览器自动存 |
| 响应 body | 登录接口返回 `{ access_token: "xxx" }` | 前端手动存（内存/cookie） |

### 9.4 前端存在哪？为什么不会被盗用？

| 存储方式 | 能被 XSS 读取吗 | 能被 CSRF 利用吗 | 推荐 |
|---------|----------------|-----------------|------|
| `httpOnly cookie` | ❌ JS 读不到 | ⚠️ 能（需加 SameSite 防） | ✅ |
| 内存变量（闭包） | ❌ 刷新就没了 | ❌ | ✅（最安全但不持久） |
| localStorage | ✅ **危险** | ❌ | ❌ 支付场景禁用 |

**最佳实践**：`httpOnly + Secure + SameSite=Strict` cookie。XSS 拿不到 + HTTPS 加密传输 + 跨站不带 + 浏览器自动携带。refresh_token 同样放 httpOnly cookie，`path` 限制为 `/auth/refresh`（只有续期接口能读到）。

**为什么不会被拦截盗用（三层防护）**：
1. **HTTPS** → 中间人看不到 cookie 内容
2. **httpOnly** → XSS 注入的 JS 读不到
3. **SameSite=Strict** → 跨站请求不带 cookie

### 9.5 前端怎么带给后端？

- **Cookie 方式**：浏览器自动带（同域请求自动发 cookie，前端不用管）
- **Header 方式**：请求拦截器手动加 `Authorization: Bearer <token>`

### 9.6 后端拿到后怎么鉴权？不通过做什么？

```
后端收到请求
  ↓
从 cookie / header 取出 token
  ↓
用 secret 对 Header + Payload 重新算签名 → 和 token 里的 Signature 对比
  ├── 不一致 → 被篡改 → 返回 401 Unauthorized
  ├── 过期（exp < now）→ 返回 401
  └── 通过 → 从 Payload 取出 userId → 继续处理业务
```

**关键**：后端不需要查数据库（无状态），只需要 secret 就能验证。这是 JWT 比 Session 的核心优势。

### 9.7 支付接口为什么不只靠 token？

token 证明"你是用户 A"，但支付还需要：
- **支付密码 / 指纹 / FaceID** — 二次验证（防别人拿到你手机）
- **签名** — 请求参数 + 时间戳 + secret 做签名，防篡改
- **风控** — 异常设备/IP/金额 → 拦截

### 9.8 Cookie vs Header 携带 token

| | Cookie 方式 | Header 方式 |
|--|------------|-------------|
| 怎么带 | 浏览器自动带 | 前端手动加（请求拦截器） |
| XSS 能偷吗 | `HttpOnly` → 偷不了 | token 存 JS 可访问的地方 → 能偷 |
| CSRF 风险 | 有（cookie 跨站也自动带） | 无（header 不会自动带） |
| 跨域/跨端 | 受 SameSite/domain 限制 | 无限制（RN/小程序/API 都能用） |
| 适用场景 | 纯 Web 同域 | 跨端/跨域/API 开放平台 |

**为什么很多项目用 header**：RN / 小程序 / 跨域 API 没有 cookie 机制。即使 Web，前后端分离（不同域）时 cookie 限制太多。

**最安全组合**：access_token 存内存（XSS 拿不到闭包） + refresh_token 存 HttpOnly cookie + 请求用 header 带 access_token。

### 9.9 SSO 凭证存在哪？怎么携带？

**SSO（单点登录）本质**：多个子系统共享一个登录态。登录一次，所有系统都认。

**凭证存储和携带**：

```
用户访问 A 系统（未登录）
  → 重定向到 SSO 认证中心登录页
  → 用户登录成功
  → SSO 认证中心：
      1. 在 SSO 域名下种一个 cookie（session / token）← 凭证存这里
      2. 生成一次性 code → 重定向回 A 系统（URL 带 code）
  → A 系统后端拿 code 去 SSO 换 token → A 系统自己种 cookie / 下发 token

用户访问 B 系统（未登录）
  → 重定向到 SSO 认证中心
  → 浏览器自动带上 SSO 域名的 cookie → SSO 发现已登录
  → 直接签发 code → 重定向回 B（用户无感）
```

**凭证在哪**：

| 凭证 | 存在哪 | 携带方式 |
|------|--------|---------|
| SSO 全局 session | SSO 域名的 `HttpOnly cookie` | 浏览器访问 SSO 域名时自动带 |
| 子系统 token | 子系统自己的 cookie / header | 同普通鉴权 |
| 一次性 code | URL query 参数（`?code=xxx`） | 重定向时带，用完即失效 |

**关键**：SSO cookie 在 SSO 自己的域名下，子系统读不到（跨域）。子系统只通过 code → token 的后端交换来确认身份。

---
