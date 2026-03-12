# 前端工程化面试知识梳理

> 基于 BBQ 项目中的工程化学习笔记整理，从面试角度系统梳理前端工程化核心知识点

## 目录

- [一、工程化概述](#一工程化概述)
- [二、Webpack 构建工具](#二webpack-构建工具)
- [三、Babel 编译工具](#三babel-编译工具)
- [四、代码质量保障](#四代码质量保障)
- [五、Git 版本管理](#五git-版本管理)
- [六、CI/CD 持续集成](#六cicd-持续集成)
- [七、性能优化](#七性能优化)
- [八、高频面试题](#八高频面试题)

---

## 一、工程化概述 ⭐⭐⭐ 🔥

### 1.1 什么是前端工程化 ⭐⭐⭐ 🔥

**考点**：工程化的定义和目标

**核心目标**：
- **提效**：提升开发效率
- **提质**：保证代码质量
- **规范**：统一开发流程

**工程化体系**：
```
┌─────────────────────────────────────────┐
│           前端工程化体系                  │
├─────────────────────────────────────────┤
│  开发阶段                                │
│  ├─ 脚手架（项目初始化）                 │
│  ├─ 本地开发（热更新、实时预览）         │
│  └─ 代码规范（ESLint、Prettier）         │
├─────────────────────────────────────────┤
│  构建阶段                                │
│  ├─ 编译转换（Babel、TypeScript）        │
│  ├─ 模块打包（Webpack、Vite）            │
│  ├─ 代码压缩（UglifyJS、Terser）         │
│  └─ 资源优化（图片压缩、Tree-shaking）   │
├─────────────────────────────────────────┤
│  测试阶段                                │
│  ├─ 单元测试（Jest、Vitest）             │
│  ├─ E2E 测试（Cypress、Playwright）      │
│  └─ 覆盖率检查                           │
├─────────────────────────────────────────┤
│  部署阶段                                │
│  ├─ CI/CD 流水线                         │
│  ├─ 自动化部署                           │
│  └─ 版本管理                             │
└─────────────────────────────────────────┘
```

### 1.2 工程化的价值 ⭐⭐ 🔥

**考点**：为什么需要工程化

**解决的问题**：
1. **开发效率低**：手动配置环境、重复劳动
2. **代码质量差**：缺乏规范、难以维护
3. **协作困难**：代码风格不统一、冲突频繁
4. **部署复杂**：手动打包、容易出错
5. **性能问题**：资源未优化、加载慢

**带来的收益**：
- 开发效率提升 30%+
- Bug 率降低 50%+
- 部署时间缩短 80%+
- 代码可维护性大幅提升



---

## 二、Webpack 构建工具 ⭐⭐⭐ 🔥🔥🔥

### 2.1 Webpack 核心概念 ⭐⭐⭐ 🔥🔥

**考点**：Webpack 的基本概念

**核心概念**：
- **Entry**：入口，指示 Webpack 从哪个文件开始构建
- **Output**：输出，指示 Webpack 打包后的文件输出位置
- **Loader**：转换器，将非 JS 文件转换为 Webpack 可处理的模块
- **Plugin**：插件，扩展 Webpack 功能，执行更广泛的任务
- **Mode**：模式，development / production / none

**Module、Chunk、Bundle 的区别**：
```
Module（模块）
    ↓ Webpack 处理
Chunk（代码块）
    ↓ 生成文件
Bundle（打包产物）
```

- **Module**：开发中的源代码文件
- **Chunk**：Webpack 处理时的代码块（可能包含多个 module）
- **Bundle**：最终输出的文件（浏览器可直接运行）

### 2.2 Webpack 工作原理 ⭐⭐⭐ 🔥🔥🔥

**考点**：Webpack 的打包流程

**核心流程**：

```
1. 初始化阶段
   ├─ 读取配置参数（webpack.config.js + CLI 参数）
   ├─ 创建 Compiler 对象
   ├─ 加载插件（调用 plugin.apply()）
   └─ 确定入口文件（entry）

2. 编译阶段
   ├─ 从 entry 开始递归解析依赖
   ├─ 调用 Loader 转换模块内容
   ├─ 使用 Babel 解析为 AST
   ├─ 分析 AST 找出依赖关系
   └─ 递归处理所有依赖模块

3. 生成阶段
   ├─ 根据依赖关系组装 Chunk
   ├─ 每个 Chunk 转换为单独文件
   ├─ 输出到文件系统
   └─ 完成构建
```

**依赖分析**：
```javascript
// 使用 Babel 分析依赖
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

function analyzeDependencies(code) {
  const ast = babel.parse(code, {
    sourceType: 'module'
  });
  
  const dependencies = [];
  
  traverse(ast, {
    ImportDeclaration(path) {
      // 收集 import 语句的依赖
      dependencies.push(path.node.source.value);
    }
  });
  
  return dependencies;
}
```

**依赖关系图**：
```javascript
// 文件依赖图结构
{
  'src/index.js': {
    dependencies: ['./utils.js', 'lodash'],
    code: '...'
  },
  'src/utils.js': {
    dependencies: [],
    code: '...'
  }
}
```

### 2.3 Loader 机制 ⭐⭐⭐ 🔥🔥

**考点**：Loader 的作用和原理

**Loader 本质**：
- 本质是一个函数，接收源代码，返回转换后的代码
- 将所有类型的文件转换为 Webpack 可处理的模块

**执行顺序**：
```javascript
// 从右到左，从下到上执行
module: {
  rules: [{
    test: /\.css$/,
    use: [
      'style-loader',  // 3. 将 CSS 插入到 DOM
      'css-loader',    // 2. 解析 CSS 文件
      'postcss-loader', // 1. 处理 CSS 兼容性
      'sass-loader'    // 0. 将 Sass 转为 CSS
    ]
  }]
}
```

**常用 Loader**：
- **babel-loader**：转换 ES6+ 代码
- **ts-loader**：转换 TypeScript
- **css-loader**：处理 CSS 文件
- **style-loader**：将 CSS 插入到 DOM
- **sass-loader / less-loader**：处理预处理器
- **file-loader**：处理文件资源
- **url-loader**：小文件转 base64

**Loader 开发**：
```javascript
// 简单的 Loader 示例
module.exports = function(source) {
  // source 是源代码字符串
  const result = source.replace(/console\.log/g, '');
  
  // 返回转换后的代码
  return result;
};
```

### 2.4 Plugin 机制 ⭐⭐⭐ 🔥🔥

**考点**：Plugin 的作用和原理

**Plugin 本质**：
- 基于事件流的插件系统
- 在 Webpack 生命周期的特定时机执行任务
- 通过 Tapable 实现钩子机制

**Plugin 开发**：
```javascript
class HelloWorldPlugin {
  apply(compiler) {
    // 在 done 钩子上注册监听
    compiler.hooks.done.tap('HelloWorldPlugin', (stats) => {
      console.log('Webpack 构建完成！');
    });
  }
}

module.exports = HelloWorldPlugin;
```

**常用 Plugin**：
- **HtmlWebpackPlugin**：生成 HTML 文件
- **MiniCssExtractPlugin**：提取 CSS 到单独文件
- **CleanWebpackPlugin**：清理输出目录
- **DefinePlugin**：定义环境变量
- **UglifyJsPlugin / TerserPlugin**：压缩 JS
- **OptimizeCssAssetsPlugin**：压缩 CSS

### 2.5 Hash、ChunkHash、ContentHash ⭐⭐⭐ 🔥🔥

**考点**：文件指纹的区别和使用场景

| 类型 | 计算范围 | 使用场景 |
|-----|---------|---------|
| **hash** | 整个项目 | 任何文件变化都会改变 |
| **chunkhash** | 同一 Chunk | 同一入口的文件变化才改变 |
| **contenthash** | 文件内容 | 只有文件自身变化才改变 |

**使用建议**：
```javascript
// 开发环境：不需要 hash
output: {
  filename: '[name].js'
}

// 生产环境：使用 contenthash
output: {
  filename: '[name].[contenthash:8].js'
},
plugins: [
  new MiniCssExtractPlugin({
    filename: 'css/[name].[contenthash:8].css'
  })
]
```

**为什么用 contenthash**：
- 只修改 JS，CSS 的 hash 不变，可以继续使用缓存
- 只修改 CSS，JS 的 hash 不变，可以继续使用缓存
- 最大化利用浏览器缓存



### 2.6 Webpack 优化策略 ⭐⭐⭐ 🔥🔥🔥

**考点**：如何优化 Webpack 构建

#### 2.6.1 构建速度优化

**1. 缩小文件搜索范围**
```javascript
module.exports = {
  resolve: {
    // 指定第三方模块的绝对路径
    modules: [path.resolve(__dirname, 'node_modules')],
    
    // 减少文件后缀尝试
    extensions: ['.js', '.json'],
    
    // 指定入口文件
    mainFields: ['main']
  },
  
  module: {
    rules: [{
      test: /\.js$/,
      // 只处理 src 目录
      include: path.resolve(__dirname, 'src'),
      // 排除 node_modules
      exclude: /node_modules/,
      use: 'babel-loader'
    }]
  }
};
```

**2. 使用 cache-loader**
```javascript
module: {
  rules: [{
    test: /\.js$/,
    use: [
      'cache-loader',  // 缓存编译结果
      'babel-loader'
    ]
  }]
}
```

**3. 使用 thread-loader（多进程）**
```javascript
module: {
  rules: [{
    test: /\.js$/,
    use: [
      'thread-loader',  // 开启多进程
      'babel-loader'
    ]
  }]
}
```

**4. DLL 预编译（已过时）**
- Webpack 4+ 不推荐使用
- 维护成本高，收益低

#### 2.6.2 打包体积优化

**1. Tree Shaking（内置）**
```javascript
// 生产模式自动开启
mode: 'production'

// package.json 标记副作用
{
  "sideEffects": false  // 所有文件都可以 tree-shake
}
```

**2. Code Splitting（代码分割）**
```javascript
optimization: {
  splitChunks: {
    chunks: 'all',  // 对所有类型的 chunk 进行分割
    cacheGroups: {
      // 第三方库
      vendor: {
        name: 'vendor',
        test: /node_modules/,
        priority: 2,
        minSize: 5 * 1024,
        minChunks: 1
      },
      // 公共代码
      common: {
        name: 'common',
        priority: 1,
        minSize: 5 * 1024,
        minChunks: 2
      }
    }
  }
}
```

**3. 按需加载（懒加载）**
```javascript
// 动态 import
import(/* webpackChunkName: "lodash" */ 'lodash').then((_) => {
  console.log(_.join(['Hello', 'Webpack'], ' '));
});

// Vue 路由懒加载
const Home = () => import(/* webpackChunkName: "home" */ './Home.vue');

// React 路由懒加载
const Home = React.lazy(() => import('./Home'));
```

**4. 压缩代码**
```javascript
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      parallel: true,  // 多进程压缩
      terserOptions: {
        compress: {
          drop_console: true  // 删除 console
        }
      }
    }),
    new CssMinimizerPlugin()
  ]
}
```

**5. 提取 CSS**
```javascript
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module: {
  rules: [{
    test: /\.css$/,
    use: [
      MiniCssExtractPlugin.loader,  // 替代 style-loader
      'css-loader'
    ]
  }]
},
plugins: [
  new MiniCssExtractPlugin({
    filename: 'css/[name].[contenthash:8].css'
  })
]
```

**6. 图片优化**
```javascript
module: {
  rules: [{
    test: /\.(png|jpg|gif)$/,
    type: 'asset',
    parser: {
      dataUrlCondition: {
        maxSize: 8 * 1024  // 8KB 以下转 base64
      }
    }
  }]
}
```

### 2.7 Source Map ⭐⭐⭐ 🔥🔥

**考点**：Source Map 的作用和配置

**作用**：
- 将压缩/编译后的代码映射回源代码
- 方便调试和定位问题

**类型选择**：
```javascript
// 开发环境：快速重建，定位到行和列
devtool: 'eval-cheap-module-source-map'

// 生产环境：
// 方案 1：不生成（安全但难调试）
devtool: false

// 方案 2：生成但不内联（上传到错误监控平台）
devtool: 'hidden-source-map'

// 方案 3：生成完整 map + 白名单访问
devtool: 'source-map'
```

**性能对比**：
| 类型 | 构建速度 | 重建速度 | 质量 | 生产环境 |
|-----|---------|---------|------|---------|
| eval | 最快 | 最快 | 低 | ❌ |
| cheap-source-map | 快 | 较快 | 中 | ✅ |
| source-map | 慢 | 慢 | 高 | ✅ |

### 2.8 Dev Server ⭐⭐⭐ 🔥

**考点**：开发服务器的配置

**基本配置**：
```javascript
devServer: {
  port: 3000,
  hot: true,  // 热更新
  open: true,  // 自动打开浏览器
  
  // 代理配置
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/api': ''
      }
    }
  },
  
  // 解决 History 路由 404
  historyApiFallback: true
}
```

**HMR（热模块替换）原理**：
```
1. Webpack 监听文件变化
   ↓
2. 重新编译变化的模块
   ↓
3. 通过 WebSocket 通知浏览器
   ↓
4. 浏览器请求更新的模块
   ↓
5. 替换旧模块，执行更新逻辑
```

---

## 三、Babel 编译工具 ⭐⭐⭐ 🔥🔥

### 3.1 Babel 工作原理 ⭐⭐⭐ 🔥🔥

**考点**：Babel 的编译流程

**核心流程**：
```
源代码（ES6+）
    ↓ Parser
AST（抽象语法树）
    ↓ Transform
新 AST
    ↓ Generator
目标代码（ES5）
```

**核心模块**：
- **@babel/core**：核心 API
- **@babel/parser**：解析器（babylon）
- **@babel/traverse**：遍历和修改 AST
- **@babel/generator**：生成代码
- **@babel/types**：构造和验证 AST 节点

### 3.2 Babel 配置 ⭐⭐⭐ 🔥

**考点**：如何配置 Babel

**基本配置**：
```javascript
// .babelrc 或 babel.config.js
{
  "presets": [
    ["@babel/preset-env", {
      "targets": "> 0.25%, not dead",  // 目标浏览器
      "useBuiltIns": "usage",  // 按需引入 polyfill
      "corejs": 3
    }],
    "@babel/preset-react",  // 支持 JSX
    "@babel/preset-typescript"  // 支持 TS
  ],
  "plugins": [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-transform-runtime"
  ]
}
```

**@babel/preset-env 参数**：
- **targets**：目标环境
- **modules**：模块化方案（false 保留 ES6 模块，利于 tree-shaking）
- **useBuiltIns**：
  - `false`：不引入 polyfill
  - `entry`：根据 targets 引入所有 polyfill
  - `usage`：按需引入（推荐）

### 3.3 Babel Plugin 开发 ⭐⭐ 🔥🔥

**考点**：如何开发 Babel 插件

**基本结构**：
```javascript
module.exports = function({ types: t }) {
  return {
    visitor: {
      // 访问 Identifier 节点
      Identifier(path, state) {
        // 修改节点
        if (path.node.name === 'oldName') {
          path.node.name = 'newName';
        }
      },
      
      // 访问函数声明
      FunctionDeclaration(path) {
        // 删除节点
        if (path.node.params.length > 3) {
          path.remove();
        }
      }
    }
  };
};
```

**辅助库**：
- **@babel/parser**：解析代码为 AST
- **@babel/traverse**：遍历 AST
- **@babel/generator**：生成代码
- **@babel/types**：操作 AST 节点
- **@babel/template**：模板化生成 AST



---

## 四、代码质量保障 ⭐⭐⭐ 🔥🔥

### 4.1 ESLint 代码检查 ⭐⭐⭐ 🔥🔥

**考点**：ESLint 的作用和配置

**ESLint 原理**：
- 使用 Espree 解析器将代码解析为 AST
- 遍历 AST，应用规则进行检查
- 报告问题并提供修复建议

**基本配置**：
```javascript
// .eslintrc.js
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  rules: {
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'no-console': 'warn'
  }
};
```

**规则级别**：
- `"off"` 或 `0`：关闭规则
- `"warn"` 或 `1`：警告（不影响退出码）
- `"error"` 或 `2`：错误（退出码为 1）

### 4.2 自定义 ESLint 规则 ⭐⭐ 🔥🔥

**考点**：如何开发自定义规则

**规则开发**：
```javascript
// eslint-plugin-custom/rules/max-params.js
module.exports = {
  meta: {
    docs: {
      description: "限制函数参数数量",
    },
  },
  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.params.length > 3) {
          context.report({
            node,
            message: "函数参数不能超过 3 个",
          });
        }
      }
    };
  },
};
```

**使用自定义规则**：
```javascript
// .eslintrc.js
{
  "plugins": [
    "custom"  // eslint-plugin-custom
  ],
  "rules": {
    "custom/max-params": "error"
  }
}
```

### 4.3 Prettier 代码格式化 ⭐⭐⭐ 🔥

**考点**：Prettier 的作用和配置

**Prettier vs ESLint**：
- **ESLint**：代码质量检查（逻辑错误、最佳实践）
- **Prettier**：代码风格格式化（缩进、引号、分号）

**配置**：
```javascript
// .prettierrc.js
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'avoid'
};
```

**与 ESLint 集成**：
```javascript
// .eslintrc.js
{
  "extends": [
    "eslint:recommended",
    "plugin:prettier/recommended"  // 必须放在最后
  ]
}
```

### 4.4 Git Hooks 卡控 ⭐⭐⭐ 🔥🔥

**考点**：如何在提交时进行代码检查

**Husky + lint-staged**：
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "src/**/*.{css,scss}": [
      "stylelint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

**为什么使用 Husky**：
- Git Hooks 在 `.git/hooks` 目录，不会被提交
- Husky 将 hooks 配置化，可以提交到仓库
- 团队成员安装依赖后自动生效

**为什么使用 lint-staged**：
- 只检查暂存区的文件（git add 的文件）
- 避免检查整个项目，提升速度
- 渐进式改进，不影响历史代码

### 4.5 StyleLint 样式检查 ⭐⭐ 🔥

**考点**：CSS 代码检查

**配置**：
```javascript
// .stylelintrc.js
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-prettier'
  ],
  rules: {
    'color-hex-case': 'lower',
    'color-hex-length': 'short',
    'selector-class-pattern': '^[a-z][a-zA-Z0-9]+$'
  }
};
```

---

## 五、Git 版本管理 ⭐⭐⭐ 🔥🔥

### 5.1 Git 工作原理 ⭐⭐⭐ 🔥🔥

**考点**：Git 的核心概念

**三个区域**：
```
工作区（Working Directory）
    ↓ git add
暂存区（Staging Area / Index）
    ↓ git commit
本地仓库（Repository）
    ↓ git push
远程仓库（Remote Repository）
```

**文件状态**：
- **Untracked**：未跟踪
- **Unmodified**：未修改
- **Modified**：已修改
- **Staged**：已暂存

### 5.2 常用命令 ⭐⭐⭐ 🔥

**考点**：Git 的基本操作

**基础操作**：
```bash
# 初始化仓库
git init

# 克隆仓库
git clone <url>

# 查看状态
git status

# 添加到暂存区
git add <file>
git add .

# 提交
git commit -m "message"

# 推送
git push origin main

# 拉取
git pull origin main
```

**分支操作**：
```bash
# 创建分支
git branch <branch-name>

# 切换分支
git checkout <branch-name>

# 创建并切换
git checkout -b <branch-name>

# 合并分支
git merge <branch-name>

# 删除分支
git branch -d <branch-name>
```

**撤销操作**：
```bash
# 撤销工作区修改
git checkout -- <file>

# 撤销暂存区
git reset HEAD <file>

# 撤销提交（保留修改）
git reset --soft HEAD^

# 撤销提交（不保留修改）
git reset --hard HEAD^
```

### 5.3 Merge vs Rebase ⭐⭐⭐ 🔥🔥

**考点**：两种合并方式的区别

**Merge（合并）**：
```bash
git checkout main
git merge feature

# 结果：保留完整的提交历史，产生合并提交
```

**特点**：
- 保留完整的提交历史
- 产生一个新的合并提交
- 分支图清晰，但可能复杂

**Rebase（变基）**：
```bash
git checkout feature
git rebase main

# 结果：将 feature 的提交移到 main 之后，线性历史
```

**特点**：
- 线性的提交历史
- 不产生合并提交
- 历史更清晰，但会改写历史

**使用建议**：
- **公共分支**：使用 merge（不改写历史）
- **个人分支**：使用 rebase（保持历史清晰）
- **已推送的提交**：不要 rebase（会导致冲突）

### 5.4 Git Flow 工作流 ⭐⭐ 🔥

**考点**：团队协作的分支管理策略

**分支类型**：
```
master（main）
  ├─ develop
  │   ├─ feature/xxx
  │   ├─ feature/yyy
  │   └─ ...
  ├─ release/v1.0
  └─ hotfix/xxx
```

- **master**：生产环境，只接受合并
- **develop**：开发主分支
- **feature**：功能分支，从 develop 创建
- **release**：发布分支，从 develop 创建
- **hotfix**：紧急修复，从 master 创建

**工作流程**：
```
1. 从 develop 创建 feature 分支
2. 开发完成后合并回 develop
3. 从 develop 创建 release 分支
4. 测试通过后合并到 master 和 develop
5. 紧急修复从 master 创建 hotfix
6. 修复完成后合并到 master 和 develop
```

### 5.5 Commit 规范 ⭐⭐⭐ 🔥

**考点**：提交信息的规范

**Conventional Commits**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：
- **feat**：新功能
- **fix**：修复 bug
- **docs**：文档变更
- **style**：代码格式（不影响代码运行）
- **refactor**：重构
- **perf**：性能优化
- **test**：测试相关
- **chore**：构建过程或辅助工具的变动

**示例**：
```bash
feat(user): 添加用户登录功能

- 实现用户名密码登录
- 添加记住密码功能
- 集成第三方登录

Closes #123
```

**Commitlint 检查**：
```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'revert'
    ]],
    'subject-max-length': [2, 'always', 72]
  }
};
```



---

## 六、CI/CD 持续集成 ⭐⭐⭐ 🔥🔥

### 6.1 CI/CD 概念 ⭐⭐⭐ 🔥

**考点**：持续集成和持续部署的概念

**CI（Continuous Integration）持续集成**：
- 频繁地将代码集成到主干
- 每次集成都通过自动化测试验证
- 快速发现和定位问题

**CD（Continuous Delivery/Deployment）持续交付/部署**：
- **持续交付**：代码随时可以部署到生产环境
- **持续部署**：代码自动部署到生产环境

**CI/CD 流程**：
```
代码提交
    ↓
Lint 检查
    ↓
单元测试
    ↓
构建打包
    ↓
集成测试
    ↓
部署到测试环境
    ↓
人工审批
    ↓
部署到生产环境
```

### 6.2 GitLab CI/CD ⭐⭐⭐ 🔥🔥

**考点**：GitLab CI 的配置

**基本配置**：
```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy

# Lint 阶段
lint:
  stage: lint
  script:
    - npm install
    - npm run lint
  only:
    - merge_requests
    - main

# 测试阶段
test:
  stage: test
  script:
    - npm install
    - npm run test
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# 构建阶段
build:
  stage: build
  script:
    - npm install
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  only:
    - main

# 部署阶段
deploy:
  stage: deploy
  script:
    - npm install
    - npm run build
    - scp -r dist/* user@server:/var/www/html
  only:
    - main
  when: manual  # 手动触发
```

**常用配置**：
- **stages**：定义流水线阶段
- **script**：执行的命令
- **only/except**：触发条件
- **artifacts**：产物保存
- **cache**：缓存依赖
- **when**：执行时机（on_success、on_failure、manual）

### 6.3 GitHub Actions ⭐⭐⭐ 🔥

**考点**：GitHub Actions 的配置

**基本配置**：
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run test
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: dist
      - name: Deploy to Server
        run: |
          scp -r dist/* ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/var/www/html
```

### 6.4 Jenkins ⭐⭐ 🔥

**考点**：Jenkins 的基本概念

**核心概念**：
- **Job**：构建任务
- **Pipeline**：流水线
- **Node**：执行节点
- **Stage**：阶段
- **Step**：步骤

**Pipeline 示例**：
```groovy
pipeline {
  agent any
  
  stages {
    stage('Checkout') {
      steps {
        git 'https://github.com/user/repo.git'
      }
    }
    
    stage('Install') {
      steps {
        sh 'npm install'
      }
    }
    
    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }
    
    stage('Test') {
      steps {
        sh 'npm run test'
      }
    }
    
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    
    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        sh 'npm run deploy'
      }
    }
  }
  
  post {
    success {
      echo 'Pipeline succeeded!'
    }
    failure {
      echo 'Pipeline failed!'
    }
  }
}
```

### 6.5 质量门禁 ⭐⭐⭐ 🔥🔥

**考点**：如何保证代码质量

**门禁卡点**：
```
1. 代码规范检查
   ├─ ESLint 检查
   ├─ StyleLint 检查
   └─ Prettier 格式化

2. 单元测试
   ├─ 测试通过率 100%
   ├─ 代码覆盖率 ≥ 80%
   └─ 分支覆盖率 ≥ 70%

3. 安全检查
   ├─ 依赖漏洞扫描（npm audit）
   ├─ SonarQube 代码扫描
   └─ 敏感信息检测

4. 构建检查
   ├─ 构建成功
   ├─ 产物大小检查
   └─ 性能指标检查

5. 人工审批
   ├─ Code Review
   ├─ TL 审批
   └─ 测试验收
```

**实现方式**：
```yaml
# .gitlab-ci.yml
quality-gate:
  stage: test
  script:
    # 代码规范
    - npm run lint
    
    # 单元测试
    - npm run test
    
    # 覆盖率检查
    - |
      COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
      if (( $(echo "$COVERAGE < 80" | bc -l) )); then
        echo "Coverage $COVERAGE% is below 80%"
        exit 1
      fi
    
    # 安全检查
    - npm audit --audit-level=high
    
    # 构建检查
    - npm run build
    - |
      SIZE=$(du -sh dist | cut -f1)
      echo "Bundle size: $SIZE"
  only:
    - merge_requests
```

---

## 七、性能优化 ⭐⭐⭐ 🔥🔥

### 7.1 构建性能优化 ⭐⭐⭐ 🔥🔥

**考点**：如何提升构建速度

**优化策略**：

1. **缩小搜索范围**
   - 配置 `include/exclude`
   - 指定 `resolve.modules`
   - 减少 `resolve.extensions`

2. **使用缓存**
   - `cache-loader`
   - `babel-loader` 的 `cacheDirectory`
   - Webpack 5 的持久化缓存

3. **多进程构建**
   - `thread-loader`
   - `HappyPack`（已过时）

4. **减少 Loader 处理**
   - 只对必要的文件使用 Loader
   - 使用 `noParse` 跳过解析

5. **优化 resolve**
   - 减少 `resolve.extensions` 数量
   - 使用 `resolve.alias` 别名

### 7.2 产物体积优化 ⭐⭐⭐ 🔥🔥

**考点**：如何减小打包体积

**优化策略**：

1. **Tree Shaking**
   - 使用 ES6 模块
   - 配置 `sideEffects`
   - 生产模式自动开启

2. **Code Splitting**
   - 配置 `splitChunks`
   - 提取公共代码
   - 提取第三方库

3. **按需加载**
   - 动态 `import()`
   - 路由懒加载
   - 组件懒加载

4. **压缩代码**
   - JS 压缩（Terser）
   - CSS 压缩（CssMinimizerPlugin）
   - HTML 压缩（HtmlWebpackPlugin）

5. **图片优化**
   - 小图片转 base64
   - 图片压缩
   - 使用 WebP 格式

6. **CDN 加速**
   - 第三方库使用 CDN
   - 配置 `externals`
   - 静态资源上传 CDN

### 7.3 运行时性能优化 ⭐⭐ 🔥

**考点**：如何提升运行时性能

**优化策略**：

1. **资源加载优化**
   - 使用 HTTP/2
   - 开启 Gzip 压缩
   - 使用浏览器缓存

2. **首屏优化**
   - 关键 CSS 内联
   - 预加载关键资源
   - 骨架屏

3. **懒加载**
   - 图片懒加载
   - 路由懒加载
   - 组件懒加载

4. **预加载**
   - `<link rel="preload">`
   - `<link rel="prefetch">`
   - Service Worker

### 7.4 性能监控 ⭐⭐ 🔥

**考点**：如何监控性能

**监控指标**：
- **FCP**（First Contentful Paint）：首次内容绘制
- **LCP**（Largest Contentful Paint）：最大内容绘制
- **FID**（First Input Delay）：首次输入延迟
- **CLS**（Cumulative Layout Shift）：累积布局偏移
- **TTFB**（Time to First Byte）：首字节时间

**监控工具**：
- **Lighthouse**：性能审计
- **WebPageTest**：性能测试
- **Chrome DevTools**：性能分析
- **Sentry**：错误监控
- **Google Analytics**：用户行为分析



---

## 八、高频面试题 ⭐⭐⭐

### Q1: 说说 Webpack 的打包流程 🔥🔥🔥

**答**：
Webpack 打包分为三个阶段：

1. **初始化阶段**：
   - 读取配置参数
   - 创建 Compiler 对象
   - 加载插件
   - 确定入口文件

2. **编译阶段**：
   - 从 entry 开始递归解析依赖
   - 调用 Loader 转换模块
   - 使用 Babel 解析为 AST
   - 分析依赖关系
   - 递归处理所有模块

3. **生成阶段**：
   - 根据依赖关系组装 Chunk
   - 每个 Chunk 转换为文件
   - 输出到文件系统

### Q2: Loader 和 Plugin 的区别？🔥🔥🔥

**答**：
- **Loader**：
  - 本质是函数，转换文件内容
  - 在模块加载时执行
  - 从右到左、从下到上执行
  - 只能处理单个文件

- **Plugin**：
  - 本质是类，扩展 Webpack 功能
  - 在 Webpack 生命周期的特定时机执行
  - 通过 Tapable 钩子机制实现
  - 可以访问整个编译过程

### Q3: 如何优化 Webpack 构建速度？🔥🔥🔥

**答**：
1. **缩小搜索范围**：配置 include/exclude、resolve.modules
2. **使用缓存**：cache-loader、babel-loader 的 cacheDirectory
3. **多进程构建**：thread-loader
4. **减少 Loader 处理**：只对必要文件使用 Loader
5. **优化 resolve**：减少 extensions、使用 alias

### Q4: 如何优化 Webpack 打包体积？🔥🔥🔥

**答**：
1. **Tree Shaking**：删除未使用的代码
2. **Code Splitting**：代码分割，提取公共代码
3. **按需加载**：动态 import、路由懒加载
4. **压缩代码**：JS/CSS/HTML 压缩
5. **图片优化**：小图转 base64、图片压缩
6. **CDN**：第三方库使用 CDN

### Q5: Source Map 有哪些类型？如何选择？🔥🔥

**答**：
- **开发环境**：`eval-cheap-module-source-map`
  - 快速重建，定位到行和列
  
- **生产环境**：
  - 不生成：`false`（安全但难调试）
  - 生成但不内联：`hidden-source-map`（上传到监控平台）
  - 生成完整 map：`source-map`（配合白名单）

### Q6: Babel 的工作原理是什么？🔥🔥

**答**：
Babel 编译分为三个阶段：

1. **解析（Parse）**：使用 @babel/parser 将代码解析为 AST
2. **转换（Transform）**：使用 @babel/traverse 遍历和修改 AST
3. **生成（Generate）**：使用 @babel/generator 将 AST 生成代码

核心模块：@babel/core、@babel/parser、@babel/traverse、@babel/generator

### Q7: 如何配置 ESLint？🔥🔥

**答**：
```javascript
// .eslintrc.js
module.exports = {
  env: { browser: true, es2021: true },
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    'semi': ['error', 'always'],
    'quotes': ['error', 'single']
  }
};
```

配合 Husky + lint-staged 在提交时自动检查。

### Q8: Git Merge 和 Rebase 的区别？🔥🔥

**答**：
- **Merge**：
  - 保留完整提交历史
  - 产生合并提交
  - 适合公共分支

- **Rebase**：
  - 线性提交历史
  - 不产生合并提交
  - 适合个人分支
  - 会改写历史，不要对已推送的提交 rebase

### Q9: CI/CD 的流程是什么？🔥🔥

**答**：
```
代码提交 → Lint 检查 → 单元测试 → 构建打包 → 
集成测试 → 部署测试环境 → 人工审批 → 部署生产环境
```

关键卡点：
- Lint 检查：代码规范
- 单元测试：覆盖率 ≥ 80%
- 安全检查：依赖漏洞扫描
- 人工审批：Code Review + TL 审批

### Q10: 如何实现代码质量卡控？🔥🔥

**答**：
1. **本地卡控**：
   - Husky + lint-staged
   - 提交前自动 Lint 和格式化

2. **CI 卡控**：
   - Lint 检查
   - 单元测试 + 覆盖率检查
   - 安全扫描

3. **Code Review**：
   - 人工审查代码质量
   - 检查设计和实现

4. **发布审批**：
   - TL 审批
   - 测试验收

### Q11: 什么是 Tree Shaking？如何配置？🔥🔥

**答**：
Tree Shaking 是删除未使用代码的优化技术。

**配置**：
1. 使用 ES6 模块（import/export）
2. 生产模式自动开启
3. package.json 配置 `sideEffects`

```json
{
  "sideEffects": false  // 所有文件都可以 tree-shake
}
```

### Q12: 什么是 Code Splitting？如何实现？🔥🔥

**答**：
Code Splitting 是将代码分割成多个 bundle，按需加载。

**实现方式**：
1. **入口分割**：配置多个 entry
2. **动态导入**：使用 `import()`
3. **SplitChunks**：提取公共代码

```javascript
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /node_modules/,
        name: 'vendor',
        priority: 2
      }
    }
  }
}
```

### Q13: HMR（热模块替换）的原理是什么？🔥🔥

**答**：
1. Webpack 监听文件变化
2. 重新编译变化的模块
3. 通过 WebSocket 通知浏览器
4. 浏览器请求更新的模块
5. 替换旧模块，执行更新逻辑

不会刷新整个页面，保留应用状态。

### Q14: 如何配置多页应用？🔥

**答**：
```javascript
module.exports = {
  entry: {
    index: './src/index.js',
    about: './src/about.js'
  },
  output: {
    filename: '[name].[contenthash:8].js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      chunks: ['index']
    }),
    new HtmlWebpackPlugin({
      template: './src/about.html',
      filename: 'about.html',
      chunks: ['about']
    })
  ]
};
```

### Q15: 如何处理 CSS？🔥

**答**：
```javascript
module: {
  rules: [{
    test: /\.css$/,
    use: [
      // 开发环境
      'style-loader',
      // 生产环境
      MiniCssExtractPlugin.loader,
      'css-loader',
      'postcss-loader'
    ]
  }]
}
```

- **style-loader**：将 CSS 插入到 DOM
- **css-loader**：解析 CSS 文件
- **postcss-loader**：处理兼容性（autoprefixer）
- **MiniCssExtractPlugin**：提取 CSS 到单独文件

---

## 九、实战技巧 ⭐⭐

### 9.1 脚手架开发

**核心功能**：
- 项目模板管理
- 交互式命令行
- 文件生成
- 依赖安装

**技术栈**：
- **Commander.js**：命令行解析
- **Inquirer.js**：交互式问答
- **download-git-repo**：下载模板
- **handlebars**：模板引擎

### 9.2 Monorepo 管理

**工具选择**：
- **Lerna**：多包管理
- **pnpm workspace**：依赖管理
- **Nx**：构建系统

**优势**：
- 代码复用
- 统一版本管理
- 简化依赖管理
- 统一构建流程

### 9.3 CSS 预处理器选择

**Sass vs Less vs PostCSS**：

| 特性 | Sass | Less | PostCSS |
|-----|------|------|---------|
| **编译环境** | Ruby/Dart | JavaScript | JavaScript |
| **功能** | 强大 | 中等 | 插件化 |
| **学习成本** | 高 | 低 | 中 |
| **生态** | 丰富 | 一般 | 丰富 |

**推荐**：
- 新项目：PostCSS（灵活、现代）
- 大型项目：Sass（功能强大）
- 简单项目：Less（易上手）

---

## 十、参考资料

- [Webpack 官方文档](https://webpack.js.org/)
- [Babel 官方文档](https://babeljs.io/)
- [ESLint 官方文档](https://eslint.org/)
- [深入浅出 Webpack](https://webpack.wuhaolin.cn/)
- [Webpack 打包原理](https://segmentfault.com/a/1190000021494964)
- [政采云 - ESLint 自定义规则](https://www.zoo.team/article/eslint-rules)
- [政采云 - HMR 原理](https://www.zoo.team/article/webpack)

---

**文档说明**：
- ⭐⭐⭐ 高频考点，必须掌握
- ⭐⭐ 中频考点，建议掌握
- ⭐ 低频考点，了解即可
- 🔥🔥🔥 高难度，需要深入理解
- 🔥🔥 中等难度，需要理解原理
- 🔥 基础难度，理解概念即可
