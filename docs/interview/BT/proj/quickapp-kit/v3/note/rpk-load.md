## rpk结构
- manifest.json
- app.js
- pages
    - home
        - index.js
        - index.ir.json 
    - detail
        - index.js
        - index.ir.json
- assets
- shared
- META
    - runtime-meta.json
    - source-map

## load过程
- 容器准备
- 加载次序 + 职能：
    - 签名校验？
    - META/runtime-meta.json 校验runtime是否可以加载
    - 加载manifest？ 注册应用信息，建立路由表？
    - 加载app.js - 做什么？
    - 按照manifest中route字段，加载首页：home.ir.json 先建立静态模版树（内存中的IR映射）？
    - 加载home.js: 这个js做了什么？