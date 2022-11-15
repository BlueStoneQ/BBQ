
# NET

## http

### get & post
- get: 
  - 请求头不需要设置 Content-Type 字段
  - 一般是幂等操作
  - 传递的数据类型没有post丰富
  - 各浏览器有长度限制

### 种常见的content-type
- [参考-4种常见的content-type](https://imququ.com/post/four-ways-to-post-data-in-http.html)
- application/x-www-form-url-encoded
  - <form>默认的提交方式，提交的数据按照 key1=val1&key2=val2 的方式进行编码，key 和 val 都进行了 URL 转码
- application/json
  - 常用，json型，可以方便的提交复杂的结构化数据，特别适合 RESTful 的接口
  - 服务器消息主体是序列化后的 JSON 字符串
- multipart/form-data
  - 用表单上传文件需要用的，多种数据格式的混合数据类型
- text/xml
  - xml也是一种结构化数据结构
- 其他：
  - text/plain形式就会在页面上原样显示这段代码，将文件设置为纯文本的形式，浏览器在获取到这种文件时并不会对其进行处理。
  - text/html的意思是将文件的content-type设置为text/html的形式，浏览器在获取到这种文件时会自动调用html的解析器对文件进行相应的处理。

### HTTP缓存
- 强缓存
  - response: cache-control: max-age: xxx(s)
  - response: expires: 过期时间点（受系统时间影响）
  - 注: 如果expires和cache-control同时存在，cache-control会覆盖expires，建议两个都写
- 协商缓存
  - response: etag: 文件hash
    + request: IF-None-Match
  - response: last-modified: 最后的修改时间
    + request: if-modified-since
  - 命中协商缓存：返回 304，告知浏览器使用原来的文件
- 浏览器映射：缓存的文件 ： hash值/最后修改时间
- 刷新：
  - F5 或者 点击刷新：- 浏览器越过强缓存检查，直接进行协商缓存检查
  - 强制刷新：浏览器刷新

### 重定向
- 重定向有两种：一种是302响应，称为临时重定向，一种是301响应，称为永久重定向。两者的区别是，如果服务器发送301永久重定向响应，浏览器会缓存/hi到/hello这个重定向的关联，下次请求/hi的时候，浏览器就直接发送/hello请求了。

- 重定向有什么作用？重定向的目的是当Web应用升级后，如果请求路径发生了变化，可以将原来的路径重定向到新路径，从而避免浏览器请求原路径找不到资源。

- 状态码304并不是一种错误，而是告诉客户端有缓存，直接使用缓存中的数据。返回页面的只有头部信息，是没有内容部分的，这样在一定程度上提高了网页的性能。

### 鉴权

#### cookie
0. 服务端设置coockie
  ```http
  Set-Cookie: name=value; expires=Mon, 22-Jan-07 07:10:24 GMT; domain=.wrox.com
  ```
  通过http.response-head.Set-Cookie
1. 客户端发送到服务端：cookie携带在http.request-head.Cookie字段中
  - (https://blog.csdn.net/weixin_44419984/article/details/108660747)
- coockie 不能跨域
##### cookie: sameSite
- 防止CSRF攻击:
- [cookie: sameSite](https://www.ruanyifeng.com/blog/2019/09/cookie-samesite.html)
- Strict
  - 最为严格，完全禁止第三方 Cookie，跨站点时，任何情况下都不会发送 Cookie。换言之，只有当前网页的 URL 与请求目标一致，才会带上 Cookie。
- Lax
  - 规则稍稍放宽，大多数情况也是不发送第三方 Cookie，但是导航到目标网址的 Get 请求除外。
- None:
  - Chrome 计划将Lax变为默认设置。这时，网站可以选择显式关闭SameSite属性，将其设为None。不过，前提是必须同时设置Secure属性（Cookie 只能通过 HTTPS 协议发送），否则无效。
  - Set-Cookie: widget_session=abc123; SameSite=None; Secure

##### cookie: 跨域方案
- CORS:方案：
  - server:
    - response.header
      - Access-Control-Allow-Credentials: true
      - Access-Control-Allow-Origin: [特定域名] // 不可以是*
  - Browser:
    - XMLHttpRequest发请求需要设置withCredentials=true，fetch 发请求需要设置 credentials = include

#### session
1. 最大的问题：集群之间不能共享 - 其实可以通过DB server来共享
2. 消耗服务器资源 

#### token:JWTT
   - 一般携带在 http.request-head.Athorization字段中
   - 一般存储在localStorage中
   - 组成：head.payload.signature
   - head中一般是一些元信息：例如加密算法等,一般是直接用其base64值作为head
    - head = base64({ type: xxx, alg: xxxx })
   - payload: 用户的登录信息 + 过期时间；所以 一般服务端难以主动让token失效
    - payload = base64({ username: xxx, expire: xxx }) // 不要再这里放密码，这个基本就是明文传输
   - signature: 由于token是服务端生成的 所以秘钥是在服务端的，别人拿不走，保证了安全性。signature的职能是保证token不被篡改。
    这个signature是服务端根据用户的登录信息 + 自己的秘钥生成的一个签名，以后从 请求的 http.request-head.Athorization 中拿到token字符串，会用自己的秘钥解析拿到用户信息进行鉴权，好处是自己不用维护session表，减轻了服务端的压力
    - 服务端验证：服务端接收到请求之后，从 Token 中拿出 header 和 payload ，然后通过HS256算法将 header 和 payload 和 “盐” 值 进行计算得出内容，让计算出的内容与Token中的第三部分，也就是Signature去比较，如果一致则验证通过，反之则失败。
      - signature = crypto(head, payload, privite_key);
    - token的缺陷：
      - 一般放在localstorage中，如果发生了XSS，被攻击者获取到了token，由于在expire前服务端无法使token失效，所以在失效前攻击者一直可以冒充用户
        - 解决方案：在DB中反向维护一个token的黑名单
      

#### 单点登录
- A网站
1. 单点登录的原理其实是：会有一个专门SSO的服务端，当用户访问网站A时，由于用户请求没有携带coockie 或者 token等有效信息，则会重定向到SSO服务器
2. SSO一看 用户的请求也没有认证的信息 就给用户弹出一个登录页面，用户登录后： 
  - SSO server 会给用户一个重定向的response， 在这个http包中给用户一个认证信息（可携带的session-id或者token，里面的值是TGC）
3. 浏览器又根据SSO的response重定向到了网站A，并携带者ST票据, A网站向SSO网站法请求 询问登录与否，SSO网站查验ST后确认已经登录，于是A网站构建用户的session（或者token给用户），以后请求就会按照token或者coockie-session机制了（也就是说用户的单点登录，A向SSO访问只在第一次用户没有登录或者登录信息失效，需要重新认证的时候）；
- B网站
4. 用户又访问了网站B, 用户没有携带B网站的token，于是B和A一样 重定向到SSO， 询问用户的登录状态，
5. 此时SSO之前已经给过用户浏览器自己的之前给的token或者coockie等，可以确认用户已经登录了，于是又通过callbackUrl (就是B网站的url) , 带着ST重定向到了网站B，B此时再向SSO发送下请求 确认了用户已经登录，就构建自己的session或者token机制，在token或者cookie失效之前，都不会再让用户登录了。
  


- 概念：
  - TGT (Ticket Grangting Ticket) :TGT 是 CAS 为用户签发的登录票据，拥有了 TGT，用户就可以证明自己在 CAS 成功登录过。TGT 封装了 Cookie 值以及此 Cookie 值对应的用户信息。
  - TGC(Ticket Granting Cookie) : CAS Server 生成TGT放入自己的 Session 中，而 TGC 就是这个 Session 的唯一标识（SessionId），以 Cookie 形式放到浏览器端。
  - ST(Service Ticket) : ST 是 CAS 为用户签发的访问某一 service 的票据。用户访问 service 时，service 发现用户没有 ST，则要求用户去 CAS 获取 ST。

### 常用head：按功能划分
1. 鉴权相关
2. 缓存相关
3. CORS相关
4. 数据meta信息：
5. 通信双方信息：
6. 其他


### 简单请求 与 复杂请求
- 某些请求不会触发 CORS 预检请求，这样的请求一般称为"简单请求",而会触发预检的请求则称为"复杂请求"。

## http2

#### 如何升级到http2
- 升级操作系统
- 或者 升级nginx之类的服务器
- nodejs专门有http2模块

#### http2的优势??
- 多路复用
  - 在 HTTP 1.x 中，如果想并发多个请求，必须使用多个 TCP 链接，且为了控制资源，有时候还会对单个域名有 6-8个的TCP链接请求限制。
    而在 HTTP/2 中，有了二进制分帧之后，不再依赖 TCP 链接去实现多流并行了，
    同域名下所有通信都在单个连接上完成。
    单个连接可以承载任意数量的双向数据流。
- server-push
- 头部压缩
- 二进制分帧
  - HTTP/2 采用二进制格式传输数据，而非 HTTP 1.x 的文本格式

## https

### https原理
- 画下图：描述下https的运作过程
  - [https原理-阮老师这个讲得比较清楚](https://www.ruanyifeng.com/blog/2014/09/illustration-ssl.html)
  - 其实整个https通信过程主要分为2部分：
    1. 生成相同的对话秘钥
      - 这里用的是非对称加密
      - 不是直接交换（避免被中间人截获），对话秘钥是在server和client 2端各自生成的
      - 具体过程：
        - client: 请求，带上：一个随机数client_num1 + 客户端支持的加密算法
        - server: 收到请求后，生成一个随机数server_num2 + 数字证书(+ public_key),并response给客户端
        - client: 收到证书后，验证下证书的合法性，
          - 不合法：会提醒用户
          - 合法：生成了一个新的随机数 client_num2, 并用服务端在证书中给的public_key加密这个随机数，发送加密后的随机数 crypto_client_num2 给后端
          - server: 收到crypto_client_num2，用自己的秘钥解密出client_num2
          - 此刻：client 和 server 用双方都拥有的3个随机数，生成一个对话秘钥comunacation_key
    2. 使用对话秘钥加密/解密通信包
      - 这里实用对称加密，因为秘钥两端都有，直接用对话秘钥加密后的数据包通信即可，各自拿到数据包后用已经生成的对话秘钥解密即可
- 主体流程：
- htts VS 中间人攻击:
  - 数字证书：- 为了解决中间人问题：
    ```
      中间⼈问题： 如果此时在客户端和服务器之间存在⼀个中间⼈,这个中间⼈只需要把原本双⽅通信互发的公钥,换成⾃⼰的公钥,这样中间⼈就可以轻松解密通信双⽅所发送的所有数据。
    ```
    - 证书 可以理解为能证明server合法身份的 由权威机构CA颁发和背书的身份证
    - server在通信开始 会发送证书 给client, client来判断证书是否合法
  - 数字签名 - 为了防止证书被中间人篡改：
    - 其实 我们也经常用生成摘要来确保文件有无修改
      - 生成：CA会对server+自己的很多信息进行hash生成一个摘要，然后用自己的private_key加密这个摘要，生成数字签名，这个签名 + 其他各种信息 = 数字证书，将这个证书颁发给server（因为hash是单向算法，一般只能由内容生成摘要，而不能通过摘要生成内容，这里用自己的私钥加密，就确保私钥不会在网络中传输，而证书中的public-Key只能解密，不能加密，也确保了证书不会被伪造）
    - 对比：
      - 用证书中的public_Key解密 传递过来的数字签名
      - 从原始信息 通过相同的hash算法生成一个签名 和签名解密出来的签名进行对比，来确定证书没有被篡改

### 什么是中间人攻击
```
核心目的：是为了在客户端不感知的情况下 冒充客户端向服务端获取到数据（主要是为了假冒客户端向服务端获取数据）
```
- [中间人攻击](https://juejin.cn/post/6844904065227292685)
  - 核心就是数据包的拦截 + 解密:
1. 本地请求被劫持（如DNS劫持等），所有请求均发送到中间人的服务器
2. 中间人服务器返回中间人自己的证书客户端创建随机数，通过中间人证书的公钥对随机数加密后传送给中间人，然后凭随机数构造对称加密对传输内容进行加密传输
3. 中间人因为拥有客户端的随机数，可以通过对称加密算法进行内容解密
4. 中间人以客户端的请求内容再向正规网站发起请求
5. 因为中间人与服务器的通信过程是合法的，正规网站通过建立的安全通道返回加密后的数据
6. 中间人凭借与正规网站建立的对称加密算法对内容进行解密
7. 中间人通过与客户端建立的对称加密算法对正规内容返回的数据进行加密传输
8. 客户端通过与中间人建立的对称加密算法对返回结果数据进行解密

由于缺少对证书的验证，所以客户端虽然发起的是 HTTPS 请求，但客户端完全不知道自己的网络已被拦截，传输内容被中间人全部窃取。

### 如何防范中间人攻击
- 其实 就是使用HTTPS
  - 然后 就是https如何防范中间人攻击
- 为了防止中间人供给,需要通信双方提供由一些公共机构办法的证书（AC），这样的话，非法的服务当然是无法获得合法证书的
- 为了防止证书被篡改，使用了对证书进行摘要算法，然后进行比对生成的摘要和传输过来的摘要，一致的话，就可以通信

## websocket

### 实时解决方案
- 轮询
- 长轮询 - comet
  - 无数据时，不会立刻返回无数据信息 而是会选择做一定等待：
    - 等到有数据时 进行response
    - 超时时-进行返回
  - 前端收到response-得知是超时还未获取到数据时 立马再发起一个请求给后端 后端继续comet

- 长链接 - SSE - server-sent-event
  - 描述：
    - H5
    - 单工：只能服务器给客户端发送数据
    - 服务器向客户端声明，接下来要发送的是流信息（streaming）。
    也就是说，发送的不是一次性的数据包，而是一个数据流，会连续不断地发送过来。这时，客户端不会关闭连接，会一直等着服务器发过来的新的数据流，视频播放就是这样的例子。本质上，这种通信就是以流信息的方式，完成一次用时很长的下载。SSE 就是利用这种机制，使用流信息向浏览器推送信息。它基于 HTTP 协议
    ```js
    // response
    "Connection":"keep-alive" // 告诉客户端 收到响应后 不要断开链接
    "Content-Type":"text/event-stream" // 发送的数据是stream类型 这样的话 客户端其实需要采用事件驱动 - 监听一个data事件不断获得后端的数据
    ```
  - 相关head
  - 实践落地
    - [SSE实践落地](https://juejin.cn/post/6844903955240058893)
    - 客户端：
      - eventSource
    - 服务端：
- websocket
  - 如何用http握手（建立链接），断开连接？
  - 实践落地
    - WebSocket要求全双工连接和一个新的WebSocket服务器去处理
      - 客户端 和 nodejs 
        1. 使用：ws模块,
          - 客户端也可使用原生webspcket:
            - const ws = new websocket('ws://localhost:8080');
        2. 或者 socket.io包 实现双工
    - 客户端：
    - 服务端：

## TCP/IP
- TCP 位于传输层，提供可靠的字节流服务。
所谓的字节流服务（Byte StreamService）是指，为了方便传输，将大块数据分割成以报文段（segment）为单位的数据包进行管理。而可靠的传输服务是指，能够把数据准确可靠地传给对方。一言以蔽之，TCP协议为了更容易传送大数据才把数据分割，而且 TCP 协议能够确认数据最终是否送达到对方。为了准确无误地将数据送达目标处，TCP 协议采用了三次握手（three-way handshaking）策略
- TCP如何保证传输的可靠性[??]
  - 3次握手
  - 重传机制

### 3次握手
- 其实本质上 是 2个连接：
  - 客户端 -> 服务端
  - 服务端 -> 客户端
- 本质上建立2个连接 也是需要4次握手的，但是 中间 服务端回复客户端的握手时，也向客户端发出了建立：服务端 -> 客户端 的请求
### 4次挥手
### 为什么需要4次挥手
- 前2次挥手：断开了客户端向服务端发送请求的链接，
- 但是 此时 服务端可能数据还未发送完，等到服务端将数据给客户端发送完后，服务端再主动向客户端挥手，断开 服务端到客户端的连接

## DNS

## 网络安全

### XSS
- cross site scripting: 跨站脚本注入
- [web安全](https://febook.hzfe.org/awesome-interview/book1/network-security)
- 与客户端比较相近
- 本质上 都是注入攻击：就是一段非法的js在客户端执行了

#### 类型

##### 反射型
    - 原理：攻击者通过在 URL 插入恶意代码，其他用户访问该恶意链接时，服务端在 URL 取出恶意代码后拼接至 HTML 中返回给用户浏览器。
    - 攻击脚本代码在url中
    - eg：
    ```md
      1. 攻击者诱导被害者打开链接 hzfe.org?name=<script src="http://a.com/attack.js"/>。
      2. 被攻击网站服务器收到请求后，未经处理直接将 URL 的 name 字段直接拼接至前端模板中，并返回数据。
      3. 被害者在不知情的情况下，执行了攻击者注入的脚本（可以通过这个获取对方的 Cookie 等）。
    ```
    
##### 存储型
    - 原理：攻击者将注入型脚本提交至被攻击网站数据库中，当其他用户浏览器请求数据时，注入脚本从服务器返回并执行。
    - 会存储到数据库：主要是表单中携带攻击代码，例如留言
    - eg:
    ```md
    1. 攻击者在目标网站留言板中提交了<script src="http://a.com/attack.js"/>。
    2. 目标网站服务端未经转义存储了恶意代码，前端请求到数据后直接通过 innerHTML 渲染到页面中。
    3. 其他用户在访问该留言板时，会自动执行攻击者注入脚本。
    ```

##### DOM-Based型
    - 原理：攻击者通过在 URL 插入恶意代码，客户端脚本取出 URL 中的恶意代码并执行。
    - 用户输入未过滤
      - 主要是客户端代码写得不够安全,服务端不参与
    - eg:
    ```md
    1. 攻击者诱导被害者打开链接 hzfe.org?name=<script src="http://a.com/attack.js"/>。
    2. 被攻击网站<前端>取出 URL 的 name 字段后未经转义直接通过 innerHTML 渲染到页面中。
    3. 被害者在不知情的情况下，执行了攻击者注入的脚本。
    ```

- 产生原因：在用户产生输入的地方（url 表单等），没有充分的过滤 + 编码
  - 黑客会对内容做各种编码绕过过滤

- 防御：客户端防御
  1. 输入过滤：- 对于外部传入的内容进行充分转义
    -  黑名单过滤：例如拦截< >
    - 白名单过滤: 例如
  1. 开启 CSP（Content Security Policy，内容安全策略），规定客户端哪些外部资源可以加载和执行，降低 XSS 风险。
  3. 输出过滤:表单提交时等需要对内容进行转义和过滤
  4. 设置cookie: http-only, 禁止 JavaScript 读取 Cookie 防止被窃取。
  ```js
  // Server
  response.setHeader('set-coockie', 'xxx;HTTPOnly');
  ```

### CSRF
- cross site request forgery ： 跨站请求伪造
- 原理：攻击者诱导受害者进入第三方网站，在第三方网站中向被攻击网站发送跨站请求。利用受害者在被攻击网站已经获取的身份凭证，达到冒充用户对被攻击的网站执行某项操作的目的。
  - 本质上只由于cookie机制引起的
- eg：
  ```md
  1. 受害者登录a.com，并保留了登录凭证（Cookie）。
  2. 攻击者引诱受害者访问了b.com。
  3. b.com 向 a.com 发送了一个请求：a.com/act=xx。浏览器会默认携带a.com的Cookie。(并不是b.com获取到了cookie，而是浏览器会携带cookie，b.com肯定是要符合cookie的domain要求的)
    - 如果设置 Domain=mozilla.org，则 Cookie 也包含在子域名中（如developer.mozilla.org）
  4. a.com接收到请求后，对请求进行验证，并确认是受害者的凭证，误以为是受害者自己发送的请求。
  5. a.com以受害者的名义执行了act=xx。
  6. 攻击完成，攻击者在受害者不知情的情况下，冒充受害者，让a.com执行了自己定义的操作。
  ```
- 类型：
  - get型
    - 在<img>中写一个get请求，打开页面自动发送
  - post型
    - 在iframe中写一个隐藏的表单，打开页面自定执行表单的提交，实现成本稍高
- 防御：
  - 服务端:
    1. 放弃cookie,使用 CSRF Token 验证用户身份 （可以理解为就是token）
      - 可以再加上验证码：确保行为来自用户本身 表单提交 加入验证码 - 确保表单提交是一个用户行为 而不是黑客行为
    2. Cookie有一个新的属性——SateSite。能够解决CSRF攻击的问题。
      - 它表示，只能当前域名的网站发出的http请求，携带这个Cookie
      - 当然，由于这是新的cookie属性，在兼容性上肯定会有问题。
    3. 检测request.head中的origin 和 Referer
      - Origin 指示了请求来自于哪个站点，只有服务器名，不包含路径信息，浏览器自动添加到http请求 Header 中，无需手动设置
      - Referer 指示了请求来自于哪个具体页面，包含服务器名和路径的详细URL，浏览器自动添加到http请求 Header 中，无需手动设置。
      - 当Origin和Referer头文件不存在时该怎么办？如果Origin和Referer都不存在，建议直接进行阻止，特别是如果您没有使用随机CSRF Token（参考下方）作为第二次检查。
      - 目前这种方案，使用的人比较少。可能存在的问题就是，如果连Referer字段都能伪造，怎么办？
    4. 双重 Cookie 验证
      - 原理：利用攻击者不能获取到 Cookie 的特点，在 URL 参数或者自定义请求头上带上 Cookie 数据，服务器再验证该数据是否与 Cookie 一致。
      - 优点：无需使用 Session，不会给服务器压力
    5. 尽量使用post
- 关于CSRF如何获取到cookie的？
  - [解答了疑惑-为什么B网站发送请求时可以携带a网站的cookie](https://www.helloworld.net/p/3721362286)
    1. 我们要注意上面我对cookie的定义，在发送一个http请求的时候，携带的cookie是这个http请求域的地址的cookie。也就是我在b网站，发送a网站的一个请求，携带的是a网站域名下的cookie！很多同学的误解，就是觉得cookie是跨域的，b网站发送任何一个请求，我只能携带b网站域名下的cookie。
    2. 当然，我们在b网站下，读取cookie的时候，只能读取b网站域名下的cookie，这是cookie的跨域限制。所以要记住，不要把http请求携带的cookie，和当前域名的访问权限的cookie混淆在一起。【获取资源】
    3. 还要理解一个点：CSRF攻击，仅仅是利用了http携带cookie的特性进行攻击的，但是攻击站点还是无法得到被攻击站点的cookie。这个和XSS不同，XSS是直接通过拿到Cookie等信息进行攻击的。

### 中间人攻击
[1.2.2. 什么是中间人攻击](#122-什么是中间人攻击)

## 网络模型
- 应用层
  - 应用层
    - HTTP FTP DNS SMTP websocket
    - 为用户提供数据接口
    - websocket:
      - 基于TCP 使用http进行握手
  - 表示层
    - 主要是加密解密 编码解码之类的工作
  - 会话层
    - 上面应用层这3个层 都是由系统上的应用程序控制的
    - 管理会话
- 传输层
  - 主要确定怎么传输：TCP UDP，端到端
- 网络层
  - IP，主要负责寻址，规划路线
- 数据链路层
  - 传输的线路，将bit包装成byte，再成为帧
- 物理层
  - 传输就是bit，就是高低电平

--- --- --- --- --- --- --- --- --- --- --- ---
--- --- --- --- --- --- --- --- --- --- --- ---

# Browser

## 浏览器安全

### XSS CSRF
- XSS：Cross-site scripting
  - 概念
    - 本质上是一种注入恶意代码 使恶意代码在浏览器上运行， 是因为网站对恶意代码没有过滤机制
  - 类型：
    - 存储型
      - 存储到server上 访问时 返回到浏览器并执行
    - 反射型
      - 诱导访问恶意url - 到达攻击服务器 - 返回恶意代码
    - DOM型
      - 通过修改页面DOM节点 形成XSS
  - 防御
    - 不使用服务端渲染
    - 对插入到html中的代码做好转义-不要具有可执行性
    - CSP： 白名单 告诉浏览器哪些外部资源可以加载和执行， 开启有如下2种方法:
      - http head: Content-Security-Policy
      - meat
    - 敏感信息进行保护：验证码 cookie使用http-only
- CSRF（跨站请求伪造攻击）：Cross-site request forgery
  - 概念：第三方网站 - 用户个人信息等 - 发向被攻击网站服务器，也就是用该用户信息冒充该用户在被攻击服务器上执行操作
  - 本质：是利用 cookie 会在同源请求中携带发送给服务器的特点，以此来实现用户的冒充。
  - 类型：
    - GET
      - 例如用img构建一个请求 打开这个网站 请求就会发送
    - POST
      - post: 构建一个表单 隐藏它 当用户进入页面时 自动提交这个表单
    - 链接类型
      - A标签构建一个请求 诱导用户点击这个A标签
  - 防御：
    - 避免cookie为单一认证 例如可以用：token
- 中间人攻击
- 网络劫持
  - DNS劫持：违法
  - http劫持
    -  (访问⾕歌但是⼀直有贪玩蓝⽉的⼴告),由于http明⽂传输,运营商会修改你的http响应内容(即加⼴告)
    - 防御：全站使用https 使得攻击者无法获取你的响应报文的明文 也就无法劫持你的内容

### 同源策略与跨域

### 跨域解决方案
- CORS
  - 服务端设置：Access-Control-Allow-Origin
    - 该字段是必须的。它的值要么是请求时Origin字段的值，要么是一个*，表示接受任意域名的请求。
  - 跨域不通过 这个错误无法通过状态码识别，因为返回的状态码可能是200。
  - 非简单请求的CORS请求，会在正式通信之前，增加一次HTTP查询请求，称为"预检"请求（preflight）。预检请求使用的方法：OPTIONS。会在req.header.Origin中携带自身的域名
  - OPTIONS请求次数过多就会损耗页面加载的性能，降低用户体验度。所以尽量要减少OPTIONS请求次数，可以后端在请求的返回头部添加：Access-Control-Max-Age：number。它表示预检请求的返回结果可以被缓存多久，单位是秒。该字段只对完全一样的URL的缓存设置生效，所以设置了缓存时间，在这个时间范围内，再次发送请求就不需要进行预检请求了。
  - 默认情况下在跨域请求，浏览器是不带 cookie 的。但是我们可以通过设置 withCredentials 来进行传递 cookie.
    - 后端 response.head：Access-Control-Allow-Credentials: true
    - 前端: 每个通信方案中都有开启携带cookie的方法：
      - xhr.withCredentials = true
      - axios.defaults.withCredentials = true
- nginx
  - 本质就是CORS，也可以做跳板机
  - 服务端之间是没有同源要求的：
    - 同源策略仅是针对浏览器的安全策略。服务器端调用HTTP接口只是使用HTTP协议，不需要同源策略，也就不存在跨域问题。实现思路：通过Nginx配置一个代理服务器域名与domain1相同，端口不同）做跳板机，反向代理访问domain2接口，并且可以顺便修改cookie中domain信息，方便当前域cookie写入，实现跨域访问。
  - 其实就是nginx充当了一个反向代理，代理了目标服务器，客户端利用CORS发消息到nginx，nginx转发给目标服务器
- jsonP
  - scrip标签没有跨域限制,但是仅支持get,且容易遭受XSS攻击（因为后端给的js代码需要前端在浏览器执行）
  ```js
  // 客户端
  // 定义处理函数
  const handleCallback = (...args) => { // 处理参数 业务逻辑 }
  // 设定url
  const url = 'http://www.domain2.com:8080/login?user=admin&callback=handleCallback';
  // 利用script发送请求
  const scrip = document.createElement('script);
  script.src = url;

  // 服务端
  // 服务端返回如下脚本 在浏览器端执行
  const fn = req.query.callback; // 取到函数名
  // 拼接返回后的执行脚本 - 就是callBack的一个调用 传入实参
  // jsonp返回设置
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  res.write(fn + '(' + JSON.stringify(params) + ')');
  res.end();
  ```
- img scrpt标签：jsonP原理
- postMessage
- iframe
- nodejs中间件跨域：类似于Nginx 本质上还是CORS
- ws跨域

## 架构-进程/线程

### 进程 线程
- 进程：本质上是一个包括cpu 内存在内的执行环境，一般对应一个正在运行的程序
  - 进程是对运行时程序的封装，是系统进行资源调度和分配的的基本单位，实现了操作系统的并发（多个程序的同时执行）；
- 线程：分配的cpu资源单位
  - 线程是进程的子任务，是CPU调度和分派的基本单位，用于保证程序的实时性，实现进程内部的并发（多个任务的同时执行）；线程是操作系统可识别的最小执行和调度单位
- 进程是资源分配的最小单位，线程是CPU调度的最小单位。
- chrome架构：
  -  插件进程 网络进程 浏览器主进程 GPU进程
  - 渲染进程
    - GUI渲染进程
    - js引擎进程
    - 事件触发线程
      - 当JS引擎执行代码块如setTimeOut时（也可是来自浏览器内核的其他线程,如鼠标点击、AJAX异步请求等），会将对应任务添加到事件触发线程中；当对应的事件符合触发条件被触发时，该线程会把事件添加到待处理队列的队尾，等待JS引擎的处理；
    - 定时器线程
    - 异步http请求线程
      - XMLHttpRequest连接后通过浏览器新开一个线程请求；
      - 检测到状态变更时，如果设置有回调函数，异步线程就产生状态变更事件，将回调函数放入事件队列中，等待JS引擎空闲后执行；
- 浏览器多个tab页之间通信
  - postMessage: 需要获取对应标签页的引用
  - 使用ws协议： tab1 -> server -ws> tab2
  - localStorage: 对localstorage的变化进行监听
  - shareWorker
- serviceWorker:
  - 独立线程 + Https

### 浏览器的进程架构
- 我们主要关注浏览器的渲染进程：
  - UI渲染线程
  - js引擎线程
  - 定时器线程
  - 事件触发线程
  - 异步http线程
    - 定时器 事件 异步http 都是执行完异步任务后，将回调加入任务队列（宏任务 微任务），js引擎会根据event-loop（任务调度机制），执行队列中的任务。

## 浏览器缓存

## 本地存储

## 渲染机制

### 渲染过程：
  html -> dom tree
                        -> render tree -> 布局 -> 绘制
  css  -> cssom tree

## 事件机制

## js运行机制

### Browser如何解析js html css
- 解析js:
  - html -> 遇到<script -> 调用js引擎解析执行
    - js-code-str -> tokens -> ast -> 字节码 -> 执行:
      - 执行上下文栈 
        - 变量的作用域提升：在代码执行前，在parser转成AST的过程中，会将全局定义的变量、函数等加入到GlobalObject中，但是并不会赋值；这个过程也称之为变量的作用域提升

### 比较系统地说说js运行机制
- [这一篇写的不错-js运行机制](https://zhuanlan.zhihu.com/p/136362944)
  - 执行：最终执行的是编译后的机器码，那么前面部分都是解释，根据一系列规则（event-loop就属于这一步）解释成机器码去交给cpu执行：
  - 其实js是边编译 边解释执行的：所以，就分成2部分：运行环境工作机制 + 执行过程：

### event-loop
- why：为什么需要eventLoop：
  - 因为js的运行是单线程（只有一个主线程），要做到非阻塞 - 用的就是event-loop
- 描述：
  - 在执行同步代码时，如果遇到异步事件，js 引擎并不会一直等待其返回结果，而是会将这个事件挂起，继续执行执行栈中的其他任务。当异步事件执行完毕后，再将异步事件对应的回调加入到一个任务队列中等待执行。任务队列可以分为宏任务队列和微任务队列，当当前执行栈中的事件执行完毕后，js 引擎首先会判断微任务队列中是否有任务可以执行，如果有就将微任务队首的事件压入栈中执行。当微任务队列中的任务都执行完成后再去执行宏任务队列中的任务。
- 浏览器端
  - 宏任务：
    - 同步js代码执行 setTimeout setinterval IO操作 异步渲染 绑定的各种事件
    - MessageChannel postMessage
  - 微任务：
    - promise.then mutationObserver
- nodejs：??
  - 宏任务：
    - setImmediate
  - 微任务：
    - process.nextTick
- 其他：
  - requestAnimationFramework
    - 不是宏任务或者微任务，并不是每一轮eventLoop都伴随着渲染
- vue.$nextTick
  - 优先微任务：promise 
  - 微任务不支持的话考虑宏任务：setImmediate - MessageChannel - setTimeOut
    - MessageChannel的使用：
    ```js
    const channel = new MessageChannel()
      const port = channel.port2
      channel.port1.onmessage = flushCallbacks
    ```

### 执行上下文？？
- 全局执行上下文
- 函数执行上下文
- eval执行上下文

### 执行栈
- f1(f2(f3()))
  - f1执行，f1的上下文入栈，
  - 遇到f2执行，f2的上下文入栈
  - 在f2执行时遇到f3执行，f3的上下文入栈
  - f3执行结束,出栈，执行f2
  - f2执行结束，出栈，执行f1
  - f1执行结束，出栈，执行结束

### 垃圾回收
- [垃圾回收-这一篇讲得比较清晰](https://developer.51cto.com/article/683431.html)
- [GC-bilibili](https://www.bilibili.com/video/BV1o44y1z7bQ?spm_id_from=333.337.search-card.all.click&vd_source=9365026f6347e9c46f07d250d20b5787)
- 目前来看，垃圾回收主要针对的是：堆内存
- 引用计数：
  - 当一个对象有一个引用指向它时，那么这个对象的引用就+1，当一个对象的引用为0时，这个对象就可以被销毁掉；这个算法有一个很大的弊端就是会产生循环引用
  - 其实就是堆内存的回收，当这块堆内存有1个及以上的引用指向时，该堆内存就不会被回收
- 标记清除：
  - 这个算法是设置一个根对象（root object），垃圾回收器会定期从这个根开始，找所有从根开始有引用到的对象，对于哪些没有引用到的对象，就认为是不可用的对象；这个算法可以很好的解决循环引用的问题。
  - JS引擎比较广泛的采用的就是标记清除算法，当然类似于V8引擎为了进行更好的优化，它在算法的实现细节上也会结合一些其他的算法。
- V8 - 准确式GC - 分代式：
  - 新生代
  - 老生代
- 内存泄露：
  - 其实就是申请的内存 即没有手动释放 垃圾回收机制也没有释放掉 就造成内存的无法被回收后重新分配 
  - 后果：会吃内存，在循环 递归中，也许会造成内存被吃掉 消耗殆尽，程序崩溃
- 造成内存泄露的操作:
  - 使用未声明的变量 意外创造了一个全局变量 会一直留在内存中无法被回收
    - 因为全局变量不会被垃圾回收机制回收
  - setInterval 忘记取消，callBack中有对外部变量引用，该变量就会一直被留在内存中
  - 获取了一个DOM的引用，该元素被删除，但我们一直保留了对这个元素的引用，所以 也无法被回收
  - 不合理使用闭包

### 常见内存泄露
- 一言蔽之：内存泄露本质就是这个变量（一般是这块堆内存空间）已经没有实际用处了，但是js引擎没有将其回收
- [关于内存泄露](https://segmentfault.com/a/1190000020231307#item-3)
- [关于-标记清除-讲得比较清](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Memory_Management)
- 概念：内存泄漏可以定义为程序不再使用或不需要的一块内存，但是由于某种原因没有被释放仍然被不必要的占有。（也就是本来是垃圾内存了，但是没有被回收掉）
- 原因：在代码中创建对象和变量会占用内存，但是javaScript是有自己的内存回收机制，可以确定那些变量不再需要，并将其清除。但是当你的代码存在逻辑缺陷的时候，你以为你已经不需要，但是程序中还存在着引用，导致程序运行完后并没有合适的回收所占用的空间，导致内存不断的占用，运行的时间越长占用的就越多，随之出现的是，性能不佳，高延迟，频繁崩溃。
- 根源：垃圾回收
  - 引用计数  
    - ES6 把引用有区分为强引用和弱引用，这个目前只有再 Set 和 Map 中才有。强引用才会有引用计数叠加，只有引用计数为 0 的对象的内存才会被回收，所以一般需要手动回收内存（手动回收的前提在于标记清除法还没执行，还处于当前执行环境）。而弱引用没有触发引用计数叠加，只要引用计数为 0，弱引用就会自动消失，无需手动回收内存。
  - 标记清除
    - 这个算法假定设置一个叫做根（root）的对象（在 Javascript 里，根是全局对象）。垃圾回收器将定期从根开始，找所有从根开始引用的对象，然后找这些对象引用的对象……从根开始，垃圾回收器将找到所有可以获得的对象和收集所有不能获得的对象。
    - 其实就是从root(window)开始给堆中的内存进行标记，没有被标记到的堆内存就会被清除掉
- 引起内存泄露的case:
  - 全局变量
    - 原因：全局变量是根据定义无法被垃圾回收机制收集（因为引用为wondow,始终存在）.需要特别注意用于临时存储和处理大量信息的全局变量。如果必须使用全局变量来存储数据，请确保将其指定为null或在完成后重新分配它。
    - 解决办法：严格模式
    ```js
    function foo（arg）{ 
      bar =“some text”; // bar将泄漏到全局.
    }
    ```
  - 被遗忘的定时器和回调函数
    - 定时器未被清除，定时器的回调中有对外部变量的引用
  - DOM引用
    ```js
    var refA = document.getElementById('refA');
    document.body.removeChild(refA); // dom删除了
    console.log(refA, "refA");  // 但是还存在引用能console出整个div 没有被回收
    ```
    - 原因：保留了DOM节点引用，导致GC没有回收
    - 解决方案：ref = null, 或者使用weakMap
  - 闭包
    - 局部变量本来应该在函数退出的时候被解除引用，但如果局部变量被封闭在闭包形成的环境中，那么这个局部变量就能一直生存下去。从这个意义上看，闭包的确会使一些数据无法被及时销毁。使用闭包的一部分原因是我们选择主动把一些变量封闭在闭包中，因为可能在以后还需要使用这些变量，把这些变量放在闭包中和放在全局作用域，对内存方面的影响是一致的，这里并不能说成是内存泄露。如果在将来需要回收这些变量，我们可以手动把这些变量设为 null。
    - 例如在一个内置函数中使用了一个闭包变量，但是这个函数没执行，也就证明这个闭包变量此刻其实是不需要的，但是因为闭包，该内存依旧被占据。

### 如何排查内存泄露