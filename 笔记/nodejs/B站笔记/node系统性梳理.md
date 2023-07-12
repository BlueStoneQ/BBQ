# 资料
- https://www.bilibili.com/video/BV1gM411W7ex?p=168&vd_source=9365026f6347e9c46f07d250d20b5787
- https://zhuanlan.zhihu.com/p/129227994

## 会话控制
1. cookie
  - 保存在浏览器端, 一小块数据，按照域名（请求的服务器的域名）作为key存储
  - S -> B: 种cookie: response.header.Set-Cookie
    - 设置跨域携带: CORS: with-creditial
    - 安全: XSS: http-only
    - 安全: CSRF: same-site
  - B -> S: request.header.Cookie
2. session
3. token: JWT
  - header: base64
    - type
    - alg: 签名算法
  - payload: base64
    - 声明：
      - registered
        - 含一组建议使用的预定义声明，主要包括ISS签发人iss (issuer)签发人exp (expiration time)过期时间sub (subject)主题aud (audience)受众nbf (Not Before)生效时间iat (Issued At)签发时间jti (JWT ID)编号
      - public
        - 共的声明，可以添加任何的信息，一般添加用户的相关信息或其他业务需要的必要信息，但不建议添加敏感信息，因为该部分在客户端可解密。
      - private
        - 自定义声明，旨在在同意使用它们的各方之间共享信息，既不是注册声明也不是公共声明。
    - 实体：携带数据
  - signature
    - hash(base64(header), base64(payload), secret)
    - secret 秘钥 保存在服务器端，原理上服务器端种了JWT后，C端携带JWT到server, server每次都会用JWT中的alg签名算法 + 自己secret 按照上面的公式算一个 signature, 和 JWT中的signature进行比对，相同，则证明是合法用户，则可以取payload中携带的用户信息去系统中找到对应的用户数据

  ### 禁用cookie后如何使用session
  1. 如果禁用了 Cookies，服务器仍会将 sessionId 以 cookie 的方式发送给浏览器，但是，浏览器不再保存这个cookie (即sessionId) 了。
  2. 如果想要继续使用 session，需要采用 URL 重写 的方式来实现


