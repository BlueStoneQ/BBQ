# XRN 多 Bundle 构建

→ [XRN 总览](./README.md)

→ [资料库: RN 构建](../../../../RN/构建.md)

## 关键词
- 依赖去重
- DDD + menorepo

## 目录

- [构建过程](#构建过程)
- [bundle 构成](#bundle-构成)
- [分包策略](#分包策略)
- [metro 配置](#metro-配置)
- [静态文件怎么处理](#静态文件怎么处理)
- [QA](#qa)
  - [Q1: XRN 多 Bundle 构建怎么实现？](#qa-xrn-多-bundle-构建怎么实现)
  - [Q2: 独立仓库怎么去重？](#qa-独立仓库去重)
  - [Q3: 静态文件会自动上传 CDN 吗？](#q3-静态文件会自动上传-cdn-吗)

---

## 构建过程

- RN CLI 构建（单模块）:
    - Metro 打包 → .bundle（JS 明文）+ assets/（Metro 拷贝静态文件到产物目录）
    - Hermes AOT 编译 → .hbc（替代 .bundle）
    - 静态文件：Metro 拷贝到 assets/ 目录，和 .hbc 平级 [→ 详细](#静态文件怎么处理)

- XRN CLI 构建（多模块）:
    - 底层多次调用 RN CLI，每次用不同 entry [→ 详细方案](#qa-xrn-多-bundle-构建怎么实现)
    - 核心：去重（business bundle 排除 common 已有的 moduleId）[→ 独立仓库怎么去重](#qa-独立仓库去重)
    - 先构建 common → 记录 moduleId 集合 → 构建 business 时 filter 排除

## bundle 构成

- .hbc 里**只有 JS 字节码**（代码），不含静态文件。
- 静态资源（图片/字体）独立放在 assets 目录，和 .hbc 平级。
- Metro 同时负责两者：JS 打包（→ .bundle → hermesc → .hbc）+ 静态文件拷贝（→ assets/）
- "bundle"狭义 = .hbc 文件；广义 = .hbc + assets/（一起发布/下发）

```
home/
├── home.hbc        ← 纯 JS 字节码
└── assets/         ← 静态文件（图片/字体）
```

## 多 Bundle 分包设计 + metro 配置

- 去重公共依赖:是核心动作:
    - common 包含公共逻辑 + 公共依赖, 构建时候会产生一个记录依赖的module ID的json文件
    - 业务模块: 配置 processModuleFilter 来过滤掉common中已经有的module, 需要common 的 module依赖的json

- common
- 首页
- 一个tab一个bundle（≈ 一个业务域一个 bundle，和 DDD 划分结果一致）

| 文件 | 内容 |
|------|------|
| **common.hbc** | polyfill + react + react-native + 公共库 |
| **home.hbc** | home 模块业务代码（不含 common 中已有的） |
| **order.hbc** | order 模块业务代码 |

business bundle 只包含 diff 部分，不重复打包公共依赖。运行时先执行 common → 再追加 business，共享同一个 JS Context。

- common metro 配置：正常构建，额外输出 moduleId 记录文件: [common-modules.json](#注释common-modules-json)

```javascript
// metro.config.js（构建 common 时）
module.exports = {
  serializer: {
    createModuleIdFactory: () => (path) => hash(path),  // 稳定 moduleId
    // 构建完后把所有 moduleId 写入 common-modules.json
  },
}
```

- business bundle 配置：filter 掉 common 的模块

```javascript
// metro.config.js（构建 business 时，XRN CLI 动态注入）
const commonModules = require('./common-modules.json');
module.exports = {
  serializer: {
    createModuleIdFactory: () => (path) => hash(path),  // 同样的 hash 算法
    processModuleFilter: (module) => !commonModules.includes(module.id),  // 排除 common 模块
  },
}
```

---

## 静态文件怎么处理

RN 中的静态资源（图片/字体/JSON）：

| 类型 | 构建时 | 运行时 |
|------|--------|--------|
| `require('./icon.png')` | Metro 拷贝到 [assets 目录](#注释assets目录)，生成资源 ID 映射 | Native 通过路径读取本地文件 |
| 远程图片 `{uri: 'https://...'}` | 不处理 | 运行时网络加载 |

多 Bundle 场景：每个 business bundle 的静态资源打包到各自目录下：

```
builtin/
├── common/assets/     ← 公共资源（logo/字体）
├── home/assets/       ← home 模块的图片
└── order/assets/      ← order 模块的图片
```

Metro 配置中通过 `assetDest` 指定各 bundle 的资源输出目录。

**热更新下发时**：静态文件和 .hbc 打成 zip 一起下发，客户端解压到 `hot/` 目录。不上 CDN——跟着 bundle 走，一起发版一起回退。

```
热更新包（zip）：
├── home.hbc
└── assets/
    ├── icon.webp
    └── logo.webp
```

---

## metro 构建过程

Metro 内部三阶段：

1. **Resolution**：从 entry 出发，递归解析 `require/import` → 构建完整依赖图
2. **Transformation**：每个模块经过 Babel 转译（JSX → JS、TS → JS、polyfill 注入）
3. **Serialization**：依赖图序列化为一个 .bundle 文件（`define()` + `require()` 调用拼接）

多 Bundle 的 filter 发生在第 3 步（Serialization），前两步正常跑。

## hbc

Hermes Bytecode。Metro 产出 .bundle（JS 明文）后，`hermesc` 编译为 .hbc。

为什么用 Hermes 而不是 JSC：

| | Hermes（AOT） | JSC（JIT） |
|--|------|------|
| 启动 | 直接执行字节码，不需解析 | 先解析 JS 文本再执行 |
| 启动速度 | 快 30-50% | 慢 |
| 包体 | .hbc 比 .js 小（二进制压缩） | .js 明文 |
| 运行时峰值性能 | 略低（无 JIT 优化） | 高（JIT 热点优化） |
| 内存 | 低（mmap 加载，不全读入内存） | 高 |

RN 0.70+ 默认 Hermes。对移动端场景（启动快 + 内存低 > 运行时峰值性能），AOT 是更优选择。

## QA

<a id="qa-xrn-多-bundle-构建怎么实现"></a>
### Q1: XRN 多 Bundle 构建怎么实现？

**一份 xrn.config.js 声明所有模块，XRN CLI 循环调用 Metro bundle，动态注入 entry + filter。**

```javascript
// xrn.config.js（项目根目录，唯一一份）
module.exports = {
  common: { entry: './common/index.js' },
  modules: {
    home:  { entry: './modules/home/index.js' },
    order: { entry: './modules/order/index.js' },
  }
}
```

构建流程：

```
xrn build
  1. metro bundle --entry common/index.js → common.hbc
     → 记录 common 包含的所有 moduleId 集合

  2. metro bundle --entry home/index.js
     + processModuleFilter: 排除 common 的 moduleId
     → home.hbc（只含业务代码）

  3. 同理构建 order.hbc ...
```

去重原理：Metro 的 `serializer.processModuleFilter` 钩子，在序列化阶段过滤掉已属于 common 的模块，business bundle 只输出 diff。

---

<a id="qa-独立仓库去重"></a>
### Q2: 独立仓库（multi-repo）怎么去重？

**问题**：每个模块是独立项目，没有共同的 xrn.config.js，business 模块怎么拿到 common 的 moduleId 列表？

**方案**：XRN CLI 构建 business 时，从 common 仓库的构建产物中拉取 `common-modules.json`，用它做 filter。

```
common 仓库 CI：
  构建 → common.hbc + common-modules.json
  发布 → npm publish @xrn/common-manifest

business 仓库（独立项目）：
  package.json: "@xrn/common-manifest": "^1.0.0"
  xrn build home → CLI 自动读 node_modules/@xrn/common-manifest/modules.json → filter → home.hbc
```

| 仓库模式 | common manifest 怎么给 business |
|---------|------|
| Monorepo | 同仓库直接读构建产物 |
| Multi-repo | npm 包 / 内部 registry |

**业务开发者无感**：`xrn build home` 一条命令，CLI 内部自动拉取 manifest + filter + metro + hermesc。

---

### Q3: 静态文件会自动上传 CDN 吗？

不会。Metro / RN CLI 只负责拷贝到本地产物目录。上传是 `xrn publish`（或 CI）的事：

```
xrn build  → .hbc + assets/（本地）
xrn publish → 打 zip 上传 CDN + 注册版本到 Server
```

静态文件跟着 bundle 一起走（zip 内），不单独传图片 CDN。

---

# 注释

<a id="注释common-modules-json"></a>
### common-modules.json

包含 common bundle 中所有模块的 moduleId（common 入口 + 它的所有依赖：react/react-native/polyfill/工具库等）。

**moduleId 怎么来的？** `createModuleIdFactory` 中用文件路径的 hash 生成。同一个文件路径 → 同一个 hash → 同一个 ID。

**怎么保证一致性？** common 和 business 构建时用**同一个 hash 算法**（`createModuleIdFactory` 配置相同）。只要文件路径不变，产出的 ID 就一致。business 构建时遇到 `react/index.js` → hash 出来的 ID 和 common 里的一样 → 命中 filter → 排除。

```javascript
// 两边用同一个 factory
createModuleIdFactory: () => (path) => {
  // 用相对路径 hash，保证不同机器/目录也一致
  return md5(path.replace(projectRoot, ''));
}
```

<a id="注释assets目录"></a>
### assets 目录

Metro `--assets-dest` 指定输出到 Native 的资源目录，打包后 Native 层读取：

- **Android**：`app/src/main/assets/` → APK 内 `assets/`，用 `AssetManager` 读
- **iOS**：App Bundle 根目录 → Xcode 构建时 Copy Bundle Resources，用 `NSBundle.main` 读
