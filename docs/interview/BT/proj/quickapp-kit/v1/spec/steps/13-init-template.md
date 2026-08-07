# Step 13：quickapp init 项目模板

## 目录

- [目标](#目标)
- [Step 13.1：模板要包含什么](#step-131模板要包含什么)
- [Step 13.2：模板文件内容](#step-132模板文件内容)
- [Step 13.3：实现模板渲染](#step-133实现模板渲染)
- [Step 13.4：实现 init 命令](#step-134实现-init-命令)
- [Step 13.5：单元测试](#step-135单元测试)
- [Step 13.6：逐层验证](#step-136逐层验证)
- [技术决策](#技术决策)
- [QA](#qa)
- [下一步](#下一步)

---

## 目标

**一条命令生成可直接 build 且能渲染的项目骨架。**

```bash
quickapp init my-app && cd my-app && quickapp build
```

**验收标准：**
- 生成的项目一次 `build` 成功，无 error 无 warning
- 产物在 Android Runtime 上渲染出可见内容（不是空白页）
- 包含两个页面并能通过 `router.push` 互相跳转 —— 覆盖 events 和 require 重写
- 目标目录已存在时提示冲突并要求确认
- 包名等可变部分按项目名生成，不留占位符

**本步不包含：**
- 多模板选择（`--template=xxx`）—— V1 只有一个默认模板
- 交互式向导（逐项询问包名、版本）—— 用命令行参数和默认值
- `npm install` 自动执行 —— 生成的项目不依赖 npm 包
- git 初始化

**模板的验收标准不是「文件齐全」，而是「生成出来就能跑通全链路」。** 一个 build 失败或渲染空白的模板比没有模板更糟——它会让新用户第一步就卡住，且分不清是自己的问题还是工具的问题。

---

## Step 13.1：模板要包含什么

### 覆盖面的取舍

模板有两个相互冲突的目标：**足够小**（新用户能读懂全部内容）和**足够全**（覆盖主要能力，让用户有可改的样例）。

取舍依据是「这个特性是否需要样例才能学会」：

| 特性 | 是否入模板 | 理由 |
|---|---|---|
| 单页面渲染 | 是 | 最基本，不可省 |
| 数据绑定 `{{}}` | 是 | 插值语法需要样例，且编译逻辑最复杂（Step 5） |
| 事件绑定 | 是 | `@click` 的写法和 VM 方法的对应关系需要样例 |
| 页面跳转 `router.push` | 是 | 涉及 `import` + manifest 路由注册两处，容易漏 |
| `showToast` | 是 | 展示第二个系统模块，说明 `$app_require$` 的通用模式 |
| 生命周期 `onInit` | 是 | 一行代码，展示钩子的存在 |
| 样式（Flex + 颜色 + 圆角） | 是 | 布局是必须的，且要展示 kebab→camel 的转换（Step 6） |
| 静态资源引用 | 是 | 展示 `assets/` 的用法和路径写法 |
| 多层嵌套模板 | 否 | 单层足够展示结构，嵌套增加阅读负担 |
| 多个 class | 否 | 单 class 够用，且 Runtime 当前只匹配单 class（风险 2） |
| 表单组件 | 否 | `input` 只支持 button 类型（V1 范围），没有输入场景 |

**两个页面是最小的有意义规模。** 单页面无法展示路由；三个页面不增加新信息。

### 目录结构

```text
my-app/
├── manifest.json
├── src/
│   ├── app.ux                    应用级：全局变量 + onCreate
│   ├── pages/
│   │   ├── Home/index.ux         首页：数据绑定 + 事件 + 跳转
│   │   └── About/index.ux        第二页：接收跳转 + showToast
│   └── assets/
│       └── images/
│           └── logo.png          静态资源样例
├── .gitignore
└── README.md
```

注意 `manifest.json` 在项目根而不是 `src/` 下——等一下，这与 Step 1 的 `scanProject` 冲突。

`scanProject` 的实现里 manifest 路径是 `path.join(srcDir, 'manifest.json')`：

```typescript
const manifestPath = path.join(srcDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  throw new ProjectError('缺少 manifest.json', manifestPath);
}
```

**所以 manifest.json 必须在 `src/` 下。** 修正结构：

```text
my-app/
├── src/
│   ├── manifest.json             ← 在 src/ 下
│   ├── app.ux
│   ├── pages/
│   │   ├── Home/index.ux
│   │   └── About/index.ux
│   └── assets/
│       └── images/
│           └── logo.png
├── .gitignore
└── README.md
```

这个位置与快应用官方约定一致（官方项目也是 `src/manifest.json`）。

### 需要按项目名替换的内容

```text
包名        com.example.<projectName>
应用名      <projectName>
README 标题 <projectName>
```

包名的生成规则需要处理非法字符——项目名可能含连字符（`my-app`），而包名的每一段必须是合法标识符。见 13.3。

---

## Step 13.2：模板文件内容

模板文件放在 `templates/default/`，用 `{{VAR}}` 占位。

### manifest.json

```text
@add quickapp-toolkit/templates/default/src/manifest.json（新建文件）
```

```json
{
  "package": "{{PACKAGE}}",
  "name": "{{NAME}}",
  "versionName": "1.0.0",
  "versionCode": 1,
  "minPlatformVersion": 1070,
  "icon": "/assets/images/logo.png",
  "features": [
    { "name": "system.router" },
    { "name": "system.prompt" }
  ],
  "permissions": [
    { "origin": "*" }
  ],
  "config": {
    "logLevel": "debug",
    "debug": true
  },
  "router": {
    "entry": "pages/Home",
    "pages": {
      "pages/Home": {
        "component": "index"
      },
      "pages/About": {
        "component": "index"
      }
    }
  },
  "display": {
    "titleBarBackgroundColor": "#f2f2f2",
    "titleBarTextColor": "#414141",
    "pages": {
      "pages/Home": {
        "titleBarText": "{{NAME}}"
      },
      "pages/About": {
        "titleBarText": "关于"
      }
    }
  }
}
```

`config` 字段写了值但会被 mode 注入覆盖（Step 3 决策 1）。保留它是为了让模板结构完整——用户能看到这个字段的存在和格式，即使值由 `--mode` 决定。

`features` 只声明实际用到的两个。多声明未使用的能力会让 Runtime 预加载无用模块。

### app.ux

```text
@add quickapp-toolkit/templates/default/src/app.ux（新建文件）
```

```html
<script>
  export default {
    // 应用级全局数据，页面中通过 this.$app.xxx 访问
    globalData: {
      appName: '{{NAME}}'
    },

    onCreate() {
      console.log('[app] onCreate');
    },

    onDestroy() {
      console.log('[app] onDestroy');
    }
  };
</script>
```

app.ux 只有 `<script>`——它没有界面。Step 8 的 `validateAppSFC` 会对 app.ux 里的 `<template>` 和 `<style>` 产生 warning，所以模板里不能有这两个区块（验收标准要求无 warning）。

`this.$app.xxx` 的访问方式依赖 framework.js 的实现（`quickapp-runtime-js` 项目）。当前 Android 侧用的最小 framework.js 可能未实现这个能力——模板里写了但页面中不使用，避免生成出来就跑不通。见 QA。

### 首页

```text
@add quickapp-toolkit/templates/default/src/pages/Home/index.ux（新建文件）
```

```html
<template>
  <div class="wrapper">
    <text class="title">{{title}}</text>
    <text class="subtitle">{{subtitle}}</text>
    <input class="btn" type="button" value="进入关于页" @click="goAbout" />
    <input class="btn-plain" type="button" value="显示提示" @click="showTip" />
  </div>
</template>

<style>
  .wrapper {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-top: 120px;
  }

  .title {
    font-size: 44px;
    color: #333333;
    text-align: center;
  }

  .subtitle {
    font-size: 28px;
    color: #888888;
    text-align: center;
    margin-top: 24px;
  }

  .btn {
    width: 480px;
    height: 88px;
    border-radius: 44px;
    background-color: #09ba07;
    color: #ffffff;
    font-size: 30px;
    margin-top: 80px;
  }

  .btn-plain {
    width: 480px;
    height: 88px;
    border-radius: 44px;
    background-color: #eeeeee;
    color: #333333;
    font-size: 30px;
    margin-top: 24px;
  }
</style>

<script>
  import router from '@app-module/system.router';
  import prompt from '@app-module/system.prompt';

  export default {
    private: {
      title: '{{NAME}}',
      subtitle: '快应用运行时示例'
    },

    onInit() {
      console.log('[Home] onInit, title =', this.title);
    },

    goAbout() {
      router.push({
        uri: '/pages/About',
        params: {
          from: 'Home'
        }
      });
    },

    showTip() {
      prompt.showToast({
        message: '这是一条提示'
      });
    }
  };
</script>
```

样式里刻意用了 kebab-case 的属性名（`flex-direction`、`background-color`、`margin-top`、`border-radius`）——它们会被编译为 camelCase（Step 6），用户改样式时能看到源码写法。

选择器全部是单 class（`.title` 而非 `.wrapper .title`）。理由是 Runtime 当前只匹配单 class（Step 11 的风险 2），用后代选择器会导致样式不生效——模板不该产出「看起来对但不生效」的代码。

### 第二页

```text
@add quickapp-toolkit/templates/default/src/pages/About/index.ux（新建文件）
```

```html
<template>
  <div class="wrapper">
    <text class="heading">关于</text>
    <text class="body">{{content}}</text>
    <text class="version">版本 {{version}}</text>
    <input class="btn-back" type="button" value="返回" @click="goBack" />
  </div>
</template>

<style>
  .wrapper {
    flex-direction: column;
    align-items: center;
    padding-top: 100px;
    padding-left: 40px;
    padding-right: 40px;
  }

  .heading {
    font-size: 40px;
    color: #333333;
  }

  .body {
    font-size: 28px;
    color: #666666;
    text-align: center;
    margin-top: 40px;
  }

  .version {
    font-size: 24px;
    color: #999999;
    margin-top: 32px;
  }

  .btn-back {
    width: 400px;
    height: 80px;
    border-radius: 40px;
    background-color: #eeeeee;
    color: #333333;
    font-size: 28px;
    margin-top: 80px;
  }
</style>

<script>
  import router from '@app-module/system.router';

  export default {
    private: {
      content: '这是一个由 quickapp init 生成的示例项目。',
      version: '1.0.0'
    },

    onInit() {
      console.log('[About] onInit');
    },

    goBack() {
      router.back();
    }
  };
</script>
```

第二页用了 `router.back()`——与首页的 `router.push` 配对，展示 Router 的两个方法。

### 静态资源

```text
@add quickapp-toolkit/templates/default/src/assets/images/logo.png（新建文件）
```

模板需要一个真实的 PNG 文件。用最小的有效 PNG（1x1 透明像素，67 字节）：

```text
生成方式（在 templates/default/src/assets/images/ 下执行）：

printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > logo.png
```

或者用任意现成的小图标。要求是：真实的 PNG（有正确的魔数），因为 Step 9 的打包会按扩展名用 STORE 方式存储，而 Step 11 的验收会检查 PNG 魔数。

### .gitignore 与 README

```text
@add quickapp-toolkit/templates/default/.gitignore（新建文件）
```

```text
dist/
node_modules/
.DS_Store
*.log
```

```text
@add quickapp-toolkit/templates/default/README.md（新建文件）
```

```markdown
# {{NAME}}

快应用项目，由 `quickapp init` 生成。

## 目录结构

```text
src/
├── manifest.json      应用配置：路由、显示、能力声明
├── app.ux             应用级逻辑与全局数据
├── pages/
│   ├── Home/index.ux  首页
│   └── About/index.ux 关于页
└── assets/            静态资源
```

## 常用命令

```bash
# 编译并打包为 RPK
quickapp build

# 生产模式（压缩）
quickapp build --mode=release

# 监听变更，增量编译
quickapp watch

# 把警告视为错误，用于 CI
quickapp build --strict
```

产物在 `dist/` 目录：`{{PACKAGE}}.debug.1.0.0.rpk`

## 新增页面

1. 在 `src/pages/` 下创建目录和 `index.ux`
2. 在 `src/manifest.json` 的 `router.pages` 中注册路径
3. 需要显示标题栏文字时，在 `display.pages` 中配置

两处都要改 —— 只建文件不注册路由的页面不会被编译。

## 说明

- 单文件组件是 `<template>` + `<style>` + `<script>` 三段式
- 样式选择器目前只支持单 class（`.title`），暂不支持后代选择器
- `<script>` 中通过 `import x from '@app-module/system.xxx'` 使用系统能力
- 开发时警告不阻塞构建；合入主干前用 `quickapp build --strict` 清零
```

README 里明确写了「只支持单 class」——把当前的能力边界告知用户，避免他们写了后代选择器发现不生效而困惑。

---

## Step 13.3：实现模板渲染

### 项目名到包名的转换

包名的每一段必须是合法标识符，而项目名可能含连字符、下划线、数字开头等情况。

```text
my-app        -> com.example.myapp
My_App        -> com.example.myapp
2048game      -> com.example.app2048game   （数字开头加前缀）
我的应用       -> com.example.app           （非 ASCII 全部过滤后为空，用兜底名）
```

```text
@add quickapp-toolkit/src/init/naming.ts（新建文件）
```

```typescript
/**
 * 项目名的合法字符：字母、数字、连字符、下划线、点。
 *
 * 这个限制来自文件系统和包名的交集 —— 大多数文件系统允许更多字符
 * （空格、中文），但包名不允许，且带空格的目录名在命令行里需要引号，
 * 增加使用摩擦。
 */
const VALID_PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 包名兜底后缀，当项目名过滤后为空时使用 */
const FALLBACK_SEGMENT = 'app';

/** 包名前缀 */
const PACKAGE_PREFIX = 'com.example';

/**
 * 校验项目名。
 *
 * @param name 用户输入的项目名
 * @returns 错误描述；合法时返回 null
 */
export function validateProjectName(name: string): string | null {
  if (name === '') {
    return '项目名不能为空';
  }
  if (name === '.' || name === '..') {
    return '项目名不能是 "." 或 ".."';
  }
  if (name.length > 64) {
    return '项目名过长（超过 64 字符）';
  }
  if (!VALID_PROJECT_NAME.test(name)) {
    return '项目名只能包含字母、数字、连字符、下划线和点，且必须以字母或数字开头';
  }
  return null;
}

/**
 * 从项目名生成包名。
 *
 * 转换规则：
 *   转小写 -> 过滤非字母数字 -> 数字开头时加 "app" 前缀 -> 空时用 "app"
 *
 * 过滤而非替换连字符：my-app 变成 myapp 而不是 my.app 或 my_app。
 * 包名段里的下划线合法但不常见，多一段（my.app）会改变包名层级。
 *
 * @param projectName 已通过 validateProjectName 校验的项目名
 * @returns 完整包名，如 "com.example.myapp"
 */
export function toPackageName(projectName: string): string {
  let segment = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (segment === '') {
    segment = FALLBACK_SEGMENT;
  } else if (/^[0-9]/.test(segment)) {
    // 包名段不能以数字开头
    segment = FALLBACK_SEGMENT + segment;
  }

  return `${PACKAGE_PREFIX}.${segment}`;
}
```

### 占位符替换

```text
@add quickapp-toolkit/src/init/render.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 模板变量表 */
export interface TemplateVars {
  /** 应用名，写入 manifest.name 和 README 标题 */
  NAME: string;
  /** 包名，写入 manifest.package */
  PACKAGE: string;
}

/**
 * 需要做占位符替换的文件扩展名。
 *
 * 二进制文件（图片）不能替换 —— 按 UTF-8 读写会损坏内容。
 * 用白名单而非黑名单：新增二进制类型时不会被误处理。
 */
const TEXT_EXTENSIONS = new Set(['.json', '.ux', '.md', '.js', '.txt']);

/** 无扩展名但需要替换的文件 */
const TEXT_FILENAMES = new Set(['.gitignore']);

/**
 * 判断文件是否需要占位符替换。
 * @param filePath 文件路径
 * @returns true 表示按文本处理
 */
function isTextFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (TEXT_FILENAMES.has(base)) return true;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * 替换文本中的 {{VAR}} 占位符。
 *
 * 未定义的占位符原样保留而非替换为空 —— 留在产物里能被发现，
 * 替换为空会静默产出错误内容（比如 manifest.package 变成空字符串，
 * 到 Step 3 校验时才报错，错误信息指向 manifest 而非模板）。
 *
 * @param content 模板内容
 * @param vars    变量表
 * @returns 替换后的内容
 */
export function renderTemplate(content: string, vars: TemplateVars): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    const value = (vars as unknown as Record<string, string>)[key];
    return value === undefined ? match : value;
  });
}

/**
 * 递归复制模板目录到目标位置，对文本文件做占位符替换。
 *
 * @param templateDir 模板源目录绝对路径
 * @param targetDir   目标目录绝对路径；不存在时创建
 * @param vars        变量表
 * @returns 创建的文件相对路径列表（相对 targetDir），按创建顺序
 * @throws Error 读写失败
 */
export function copyTemplate(
  templateDir: string,
  targetDir: string,
  vars: TemplateVars
): string[] {
  const created: string[] = [];

  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs.readdirSync(templateDir, { withFileTypes: true });
  // 排序保证创建顺序稳定，便于测试断言
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const src = path.join(templateDir, entry.name);
    const dst = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      const sub = copyTemplate(src, dst, vars);
      created.push(...sub.map((p) => path.join(entry.name, p)));
      continue;
    }

    if (isTextFile(src)) {
      const content = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dst, renderTemplate(content, vars), 'utf8');
    } else {
      // 二进制原样复制
      fs.copyFileSync(src, dst);
    }
    created.push(entry.name);
  }

  return created;
}

/**
 * 定位模板目录。
 *
 * 编译后的代码在 dist/init/ 下，模板在项目根的 templates/ 下，
 * 所以是 ../../templates。用 __dirname 而非 process.cwd() ——
 * 后者取决于用户在哪个目录执行命令。
 *
 * @param templateName 模板名，当前只有 "default"
 * @returns 模板目录绝对路径
 * @throws Error 模板目录不存在（通常是打包遗漏了 templates/）
 */
export function resolveTemplateDir(templateName = 'default'): string {
  const dir = path.resolve(__dirname, '..', '..', 'templates', templateName);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `模板目录不存在：${dir}。检查 npm 包是否包含 templates/ 目录（package.json 的 files 字段）。`
    );
  }
  return dir;
}
```

`resolveTemplateDir` 的错误信息提到 `package.json` 的 `files` 字段——这是一个容易踩的坑：`templates/` 不在 `src/` 或 `dist/` 下，如果 `files` 字段没列出它，`npm publish` 后用户装到的包里没有模板，`init` 命令直接失败。

相应地要更新 `package.json`：

```text
@update quickapp-toolkit/package.json — 在 types 字段之后增加 files 字段
```

```json
  "files": [
    "bin/",
    "dist/",
    "templates/"
  ],
```

`files` 字段决定 `npm publish` 打包哪些内容。不写的话默认包含全部（除了 `.gitignore` 里的），但显式列出更可控——避免把 `test/`、`src/` 也发出去。

---

## Step 13.4：实现 init 命令

### 目录冲突处理

三种情况：

```text
目标不存在        直接创建
目标存在但为空     直接使用（用户可能已经 mkdir 过）
目标存在且非空     报错，要求用户确认或换目录
```

第三种情况需要用户确认。V1 不做交互式提示——用 `--force` 参数显式覆盖。理由见技术决策。

```text
@add quickapp-toolkit/src/cli/cmd-init.ts（新建文件）
```

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateProjectName, toPackageName } from '../init/naming';
import { copyTemplate, resolveTemplateDir } from '../init/render';

export interface InitOptions {
  /** 项目名，同时作为目录名 */
  projectName: string;
  /** 父目录绝对路径，项目会创建在 <parentDir>/<projectName> */
  parentDir: string;
  /** true 时允许在非空目录中创建 */
  force: boolean;
}

/**
 * 检查目标目录状态。
 *
 * @param targetDir 目标目录绝对路径
 * @returns 'absent' 不存在 | 'empty' 存在且为空 | 'nonempty' 存在且有内容
 */
function checkTarget(targetDir: string): 'absent' | 'empty' | 'nonempty' {
  if (!fs.existsSync(targetDir)) return 'absent';

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) return 'nonempty';

  // 忽略点文件判断"空"：用户可能已经 git init 过
  const entries = fs.readdirSync(targetDir).filter((n) => !n.startsWith('.'));
  return entries.length === 0 ? 'empty' : 'nonempty';
}

/**
 * 执行 init 命令。
 *
 * @param options init 选项
 * @returns 进程退出码；0 成功，1 失败
 */
export function runInit(options: InitOptions): number {
  const { projectName, parentDir, force } = options;

  const nameError = validateProjectName(projectName);
  if (nameError !== null) {
    console.error(`项目名无效：${nameError}`);
    return 1;
  }

  const targetDir = path.join(parentDir, projectName);
  const state = checkTarget(targetDir);

  if (state === 'nonempty' && !force) {
    console.error(`目标目录已存在且非空：${targetDir}`);
    console.error('');
    console.error('可选做法：');
    console.error('  换一个项目名');
    console.error('  删除该目录后重试');
    console.error('  加 --force 在现有目录中创建（会覆盖同名文件）');
    return 1;
  }

  const packageName = toPackageName(projectName);

  let templateDir: string;
  try {
    templateDir = resolveTemplateDir();
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }

  let created: string[];
  try {
    created = copyTemplate(templateDir, targetDir, {
      NAME: projectName,
      PACKAGE: packageName,
    });
  } catch (e) {
    console.error(`创建项目失败：${(e as Error).message}`);
    return 1;
  }

  const rel = path.relative(process.cwd(), targetDir) || '.';

  console.log(`已创建项目：${rel}`);
  console.log(`包名：${packageName}`);
  console.log('');
  console.log(`文件（${created.length}）：`);
  for (const f of created) {
    console.log(`  ${f}`);
  }
  console.log('');
  console.log('下一步：');
  console.log(`  cd ${rel}`);
  console.log('  quickapp build');

  return 0;
}
```

### 接入 CLI

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 init 分支
```

```typescript
      case 'init': {
        const name = positional[0];
        if (name === undefined) {
          console.error('缺少项目名\n');
          console.error('用法：quickapp init <project-name> [--force]');
          return 1;
        }
        return runInit({
          projectName: name,
          parentDir: process.cwd(),
          force: flags.has('force'),
        });
      }
```

注意这里用了 `positional[0]`。`parseArgs` 返回的 `positional` 已经去掉了命令本身（`positional: positional.slice(1)`），所以 `positional[0]` 就是项目名。

```text
@add quickapp-toolkit/src/cli/index.ts — 在 import 段末尾追加
```

```typescript
import { runInit } from './cmd-init';
```

`main` 函数里 `init` 分支需要访问 `positional`，而当前 `main` 只解构了 `command` 和 `flags`：

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 main 函数开头的解构语句
```

```typescript
  const { command, positional, flags } = parseArgs(argv);
```

### 更新 USAGE

```text
@update quickapp-toolkit/src/cli/index.ts — 替换 USAGE 常量
```

```typescript
const USAGE = `
用法：quickapp <command> [options]

命令：
  init <name>        创建项目骨架
  build              编译项目并打包为 RPK
  watch              监听变更并增量编译

选项：
  --mode=<mode>      构建模式：debug（默认）| release
  --root=<path>      项目根目录，默认当前目录
  --force            init 时允许在非空目录中创建
  -h, --help         显示帮助
  -v, --version      显示版本
`.trim();
```

---

## Step 13.5：单元测试

```text
@add quickapp-toolkit/test/unit/init.test.js（新建文件）
```

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  validateProjectName,
  toPackageName,
} = require('../../dist/init/naming.js');
const {
  renderTemplate,
  copyTemplate,
  resolveTemplateDir,
} = require('../../dist/init/render.js');
const { runInit } = require('../../dist/cli/cmd-init.js');

/** 创建临时父目录 */
function makeParent() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qa-init-'));
}

// ---------- 项目名校验 ----------

test('接受合法项目名', () => {
  for (const name of ['app', 'my-app', 'my_app', 'App2', 'a.b', '2048']) {
    assert.strictEqual(validateProjectName(name), null, `应接受 ${name}`);
  }
});

test('拒绝空项目名', () => {
  assert.match(validateProjectName(''), /不能为空/);
});

test('拒绝 . 和 ..', () => {
  assert.match(validateProjectName('.'), /不能是/);
  assert.match(validateProjectName('..'), /不能是/);
});

test('拒绝含空格的项目名', () => {
  assert.ok(validateProjectName('my app') !== null);
});

test('拒绝含路径分隔符的项目名', () => {
  assert.ok(validateProjectName('a/b') !== null);
  assert.ok(validateProjectName('a\\b') !== null);
});

test('拒绝非 ASCII 项目名', () => {
  assert.ok(validateProjectName('我的应用') !== null);
});

test('拒绝以连字符开头', () => {
  assert.ok(validateProjectName('-app') !== null);
});

test('拒绝过长项目名', () => {
  assert.match(validateProjectName('a'.repeat(65)), /过长/);
});

// ---------- 包名生成 ----------

test('简单项目名生成包名', () => {
  assert.strictEqual(toPackageName('myapp'), 'com.example.myapp');
});

test('连字符被过滤而非替换', () => {
  assert.strictEqual(toPackageName('my-app'), 'com.example.myapp');
});

test('下划线被过滤', () => {
  assert.strictEqual(toPackageName('my_app'), 'com.example.myapp');
});

test('大写转小写', () => {
  assert.strictEqual(toPackageName('MyApp'), 'com.example.myapp');
});

test('数字开头加 app 前缀', () => {
  assert.strictEqual(toPackageName('2048'), 'com.example.app2048');
});

test('点被过滤', () => {
  assert.strictEqual(toPackageName('a.b.c'), 'com.example.abc');
});

test('生成的包名每段都是合法标识符', () => {
  for (const name of ['my-app', '2048', 'A_B', 'x.y']) {
    const pkg = toPackageName(name);
    for (const seg of pkg.split('.')) {
      assert.match(seg, /^[a-z][a-z0-9]*$/, `${pkg} 的段 ${seg} 不合法`);
    }
  }
});

// ---------- 占位符替换 ----------

test('替换已定义的占位符', () => {
  const out = renderTemplate('name={{NAME}} pkg={{PACKAGE}}', {
    NAME: 'demo',
    PACKAGE: 'com.example.demo',
  });
  assert.strictEqual(out, 'name=demo pkg=com.example.demo');
});

test('同一占位符多次出现全部替换', () => {
  const out = renderTemplate('{{NAME}}-{{NAME}}', { NAME: 'x', PACKAGE: 'p' });
  assert.strictEqual(out, 'x-x');
});

test('未定义的占位符原样保留', () => {
  const out = renderTemplate('{{NAME}} {{UNKNOWN}}', {
    NAME: 'x',
    PACKAGE: 'p',
  });
  // 保留而非替换为空：留在产物里能被发现
  assert.strictEqual(out, 'x {{UNKNOWN}}');
});

test('非大写的占位符不被处理', () => {
  const out = renderTemplate('{{name}}', { NAME: 'x', PACKAGE: 'p' });
  assert.strictEqual(out, '{{name}}');
});

test('无占位符的文本原样返回', () => {
  assert.strictEqual(renderTemplate('plain text', { NAME: 'x', PACKAGE: 'p' }), 'plain text');
});
```

```javascript
// ---------- 模板复制 ----------

test('模板目录存在', () => {
  const dir = resolveTemplateDir();
  assert.ok(fs.existsSync(dir), `模板目录不存在：${dir}`);
  assert.ok(fs.existsSync(path.join(dir, 'src', 'manifest.json')));
});

test('复制模板产出全部文件', () => {
  const parent = makeParent();
  const target = path.join(parent, 'proj');
  copyTemplate(resolveTemplateDir(), target, {
    NAME: 'proj',
    PACKAGE: 'com.example.proj',
  });

  const expected = [
    'src/manifest.json',
    'src/app.ux',
    'src/pages/Home/index.ux',
    'src/pages/About/index.ux',
    'src/assets/images/logo.png',
    '.gitignore',
    'README.md',
  ];
  for (const rel of expected) {
    assert.ok(fs.existsSync(path.join(target, rel)), `缺少 ${rel}`);
  }
});

test('文本文件的占位符被替换', () => {
  const parent = makeParent();
  const target = path.join(parent, 'proj');
  copyTemplate(resolveTemplateDir(), target, {
    NAME: 'my-demo',
    PACKAGE: 'com.example.mydemo',
  });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(target, 'src/manifest.json'), 'utf8')
  );
  assert.strictEqual(manifest.package, 'com.example.mydemo');
  assert.strictEqual(manifest.name, 'my-demo');
});

test('产出的文件中无残留占位符', () => {
  const parent = makeParent();
  const target = path.join(parent, 'proj');
  copyTemplate(resolveTemplateDir(), target, {
    NAME: 'proj',
    PACKAGE: 'com.example.proj',
  });

  /** 递归收集全部文本文件内容 */
  const check = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        check(full);
        continue;
      }
      if (path.extname(entry.name) === '.png') continue;
      const content = fs.readFileSync(full, 'utf8');
      assert.ok(
        !/\{\{[A-Z_]+\}\}/.test(content),
        `${full} 中有未替换的占位符`
      );
    }
  };
  check(target);
});

test('二进制文件原样复制', () => {
  const parent = makeParent();
  const target = path.join(parent, 'proj');
  const templateDir = resolveTemplateDir();
  copyTemplate(templateDir, target, { NAME: 'p', PACKAGE: 'com.example.p' });

  const src = fs.readFileSync(path.join(templateDir, 'src/assets/images/logo.png'));
  const dst = fs.readFileSync(path.join(target, 'src/assets/images/logo.png'));
  assert.ok(src.equals(dst), 'PNG 内容应完全一致');
});

test('复制后的 PNG 魔数正确', () => {
  const parent = makeParent();
  const target = path.join(parent, 'proj');
  copyTemplate(resolveTemplateDir(), target, { NAME: 'p', PACKAGE: 'com.example.p' });

  const png = fs.readFileSync(path.join(target, 'src/assets/images/logo.png'));
  assert.strictEqual(png[0], 0x89);
  assert.strictEqual(png.toString('ascii', 1, 4), 'PNG');
});

// ---------- init 命令 ----------

test('在空父目录中创建项目', () => {
  const parent = makeParent();
  const code = runInit({ projectName: 'myapp', parentDir: parent, force: false });

  assert.strictEqual(code, 0);
  assert.ok(fs.existsSync(path.join(parent, 'myapp/src/manifest.json')));
});

test('目标目录已存在且为空时可创建', () => {
  const parent = makeParent();
  fs.mkdirSync(path.join(parent, 'myapp'));

  const code = runInit({ projectName: 'myapp', parentDir: parent, force: false });
  assert.strictEqual(code, 0);
});

test('目标目录存在且非空时拒绝', () => {
  const parent = makeParent();
  const target = path.join(parent, 'myapp');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'existing.txt'), 'x');

  const code = runInit({ projectName: 'myapp', parentDir: parent, force: false });
  assert.strictEqual(code, 1);
});

test('force 允许在非空目录创建', () => {
  const parent = makeParent();
  const target = path.join(parent, 'myapp');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'existing.txt'), 'x');

  const code = runInit({ projectName: 'myapp', parentDir: parent, force: true });
  assert.strictEqual(code, 0);
  // 原有文件保留
  assert.ok(fs.existsSync(path.join(target, 'existing.txt')));
  // 模板文件也创建了
  assert.ok(fs.existsSync(path.join(target, 'src/manifest.json')));
});

test('仅有点文件的目录视为空', () => {
  const parent = makeParent();
  const target = path.join(parent, 'myapp');
  fs.mkdirSync(target);
  fs.mkdirSync(path.join(target, '.git'));

  const code = runInit({ projectName: 'myapp', parentDir: parent, force: false });
  assert.strictEqual(code, 0, '已 git init 的目录应可创建');
});

test('非法项目名返回 1', () => {
  const parent = makeParent();
  assert.strictEqual(
    runInit({ projectName: 'my app', parentDir: parent, force: false }),
    1
  );
  assert.strictEqual(
    runInit({ projectName: '', parentDir: parent, force: false }),
    1
  );
});

test('生成的 manifest 通过 Step 3 的校验', () => {
  const { processManifest } = require('../../dist/manifest/processor.js');
  const parent = makeParent();
  runInit({ projectName: 'validapp', parentDir: parent, force: false });

  const srcDir = path.join(parent, 'validapp', 'src');
  // 不抛错即通过校验（含页面文件存在性检查）
  const manifest = processManifest(srcDir, 'debug');

  assert.strictEqual(manifest.package, 'com.example.validapp');
  assert.strictEqual(manifest.router.entry, 'pages/Home');
  assert.strictEqual(manifest.config.debug, true);
});
```

最后一个用例是模板正确性的关键保障：**它用真实的 `processManifest` 校验生成的 manifest**，包括页面文件存在性检查。如果模板的 `router.pages` 与实际目录结构不一致（比如写了 `pages/Index` 但目录叫 `Home`），这个用例会失败。

**用例统计：** 29 个。累计 332 个。

---

## Step 13.6：逐层验证

### 13.6.1：编译与单测

```bash
cd quickapp-toolkit
npm run build && npm test
```

**预期：** 332 个用例通过（init 29 + 之前 303）。

**常见错误：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `模板目录不存在` | `templates/` 路径计算错误 | `resolveTemplateDir` 用 `__dirname/../..`，确认编译产物在 `dist/init/` |
| `缺少 src/manifest.json` | 模板文件未创建 | 逐个核对 13.2 列出的文件 |
| `产出的文件中有未替换的占位符` | 模板里用了 `TemplateVars` 未定义的变量 | 只有 `NAME` 和 `PACKAGE` 可用 |
| `生成的 manifest 通过 Step 3 校验` 失败 | 模板的 router.pages 与目录结构不一致 | 核对 `pages/Home` 和 `pages/About` |
| PNG 魔数错误 | logo.png 不是真实 PNG | 按 13.2 的方式重新生成 |

### 13.6.2：init 基本流程

```bash
cd /tmp
rm -rf my-app
quickapp init my-app
```

**预期输出：**

```text
已创建项目：my-app
包名：com.example.myapp

文件（7）：
  .gitignore
  README.md
  src/app.ux
  src/assets/images/logo.png
  src/manifest.json
  src/pages/About/index.ux
  src/pages/Home/index.ux

下一步：
  cd my-app
  quickapp build
```

**核对点：**
- 包名由项目名生成（`my-app` → `com.example.myapp`，连字符被过滤）
- 文件列表按路径排序（`copyTemplate` 里的 `entries.sort`）
- 提示的下一步命令可直接复制执行

```bash
find my-app -type f | sort
```

**预期：**

```text
my-app/.gitignore
my-app/README.md
my-app/src/app.ux
my-app/src/assets/images/logo.png
my-app/src/manifest.json
my-app/src/pages/About/index.ux
my-app/src/pages/Home/index.ux
```

### 13.6.3：核心验收 —— 生成即可 build

这是本步最重要的验证。

```bash
cd /tmp/my-app
quickapp build
echo "退出码：$?"
```

**预期输出：**

```text
模式：debug
源码：src/

应用：my-app (com.example.myapp) v1.0.0
入口：pages/Home
配置：debug=true, logLevel=debug
能力：system.router、system.prompt

待编译页面（2）：
  pages/Home  ->  pages/Home/index.js
  pages/About  ->  pages/About/index.js

编译：
  app.js  0.6 KB
  pages/Home/index.js  3.8 KB
  pages/About/index.js  3.2 KB

静态资源（1）：
  assets/images/logo.png

产物：
  dist/com.example.myapp.debug.1.0.0.rpk
  6.4 KB，6 个条目

退出码：0
```

**核对点（验收标准的逐条对应）：**

```text
[ ] 退出码 0
[ ] 无 ERROR 输出
[ ] 无 WARNING 输出        <- 这一项容易漏
[ ] 两个页面都编译成功
[ ] 产出 RPK
```

无 warning 这一项要特别注意。三个可能产生 warning 的地方：

```text
app.ux 含 <template> 或 <style>   -> Step 8 的 validateAppSFC 报 warning
样式里有厂商前缀属性               -> Step 6 报 warning
样式里有 @media                   -> Step 6 报 warning
```

模板设计时已经避开了这三种情况：app.ux 只有 `<script>`，样式只用标准属性，无 at-rule。

### 13.6.4：release 模式验证

```bash
cd /tmp/my-app
quickapp build --mode=release
```

**预期：** 编译成功，输出含压缩信息：

```text
压缩：7.6 KB -> 2.4 KB（减少 68.4%）

产物：
  dist/com.example.myapp.release.1.0.0.rpk
  4.1 KB，6 个条目
```

**核对点：** 压缩降幅超过 60%（Step 10 的验收标准），且 `verifyMinified` 未报错。

### 13.6.5：watch 模式验证

```bash
cd /tmp/my-app
quickapp watch &
WATCH_PID=$!
sleep 2

# 改首页标题
sed -i.bak "s/快应用运行时示例/改后的副标题/" src/pages/Home/index.ux
sleep 2

kill $WATCH_PID
```

**预期：** 增量重建 1 个 bundle（`pages/Home/index.js`）。

这验证了模板与 Step 12 的兼容——生成的项目结构能被 watcher 正确监听。

### 13.6.6：产物内容验证

确认编译产物里的关键内容正确。

```bash
cd /tmp/my-app
rm -rf verify && unzip -q dist/com.example.myapp.debug.1.0.0.rpk -d verify

# manifest 里的包名和路由
python3 -c "
import json
m = json.load(open('verify/manifest.json'))
print('package:', m['package'])
print('name:', m['name'])
print('entry:', m['router']['entry'])
print('pages:', list(m['router']['pages'].keys()))
print('features:', [f['name'] for f in m['features']])
"
```

**预期：**

```text
package: com.example.myapp
name: my-app
entry: pages/Home
pages: ['pages/Home', 'pages/About']
features: ['system.router', 'system.prompt']
```

用 Step 10 的工具执行 bundle，确认结构：

```bash
cd /Users/qiaoyang/code/my-github/quickapp-kit/quickapp-toolkit
node test/manual/run-bundle.js /tmp/my-app/verify/pages/Home/index.js
```

**预期输出：**

```text
bootstrap: @app-component/index {"packagerVersion":"1.0.0"}
define: @app-component/index
exports keys: goAbout,onInit,private,showTip,style,template
require: @app-module/system.router,@app-module/system.prompt
template: {"type":"div","classList":["wrapper"],"attr":{},"children":[...]}
style: {".wrapper":{"flexDirection":"column",...},...}
private: {"title":"my-app","subtitle":"快应用运行时示例"}
```

**核对点：**
- `exports keys` 含两个事件方法（`goAbout`、`showTip`）和 `onInit`
- `require` 列出两个系统模块
- `private.title` 是替换后的项目名（不是 `{{NAME}}`）
- `style` 的属性名是 camelCase（`flexDirection` 而非 `flex-direction`）

### 13.6.7：Runtime 渲染验收

模板的最终验收标准是「能渲染出可见内容」。这需要走 Step 11 的流程。

```bash
# 把模板项目的 RPK 放进 Android 工程
cp /tmp/my-app/dist/com.example.myapp.debug.1.0.0.rpk \
   quickapp-kit/quickapp-runtime-android/app/src/main/assets/

# 改 QuickAppRuntime.kt 里的 RPK 文件名常量，然后
cd quickapp-kit/quickapp-runtime-android
./gradlew :app:assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.quickappkit.runtime/.MainActivity
```

**预期渲染结果：**

```text
标题栏：my-app
页面内容：
  my-app                    <- 大号深灰文字（44px, #333333）
  快应用运行时示例             <- 小号浅灰文字（28px, #888888）
  [进入关于页]                <- 绿色圆角按钮
  [显示提示]                  <- 灰色圆角按钮
```

**交互验收：**

```text
[ ] 点击「进入关于页」-> 跳转到关于页，标题栏变为「关于」
[ ] 关于页点击「返回」-> 回到首页
[ ] 点击「显示提示」-> 底部弹出 Toast「这是一条提示」
```

**已知的预期偏差：** 样式可能不完全生效——Step 11 的风险 2 指出 Runtime 当前只匹配单 class 选择器。模板刻意全部使用单 class（`.title` 而非 `.wrapper .title`），所以样式**应该**生效。如果不生效，说明问题比风险 2 更严重，回到 Step 11 的验收 8 排查。

这一项依赖 Android Runtime 的推进进度。在 Runtime 完成到 Task 3.5 之前，可以只做到 13.6.6 的产物内容验证——那已经能确认模板产出的 bundle 结构正确。

---

## 技术决策

### 1. 模板的验收标准是「能跑通全链路」而非「文件齐全」

**为什么：** 一个 build 失败或渲染空白的模板比没有模板更糟。新用户的第一次体验决定他们是否继续——如果 `init` 后 `build` 就报错，他们无法判断是自己环境的问题还是工具的问题，也没有已知可用的基线来对照。

这条标准的具体落实是三个测试和两项验证：单测里的「生成的 manifest 通过 Step 3 校验」、13.6.3 的「生成即可 build 且无 warning」、13.6.7 的「Runtime 渲染出可见内容」。

**代价：** 模板要跟随编译器和 Runtime 的能力演进。样式选择器的限制（只支持单 class）现在写进了模板和 README，等 Runtime 补齐后要回来更新。

### 2. 两个页面，不是一个也不是三个

**为什么：** 单页面无法展示路由跳转，而 `router.push` 涉及两处配合——`import` 系统模块和 manifest 路由注册，这是新用户最容易漏的地方。三个页面不增加新信息。

**代价：** 模板文件数从 5 个变成 6 个，新用户要读的内容多一页。用 `router.back()` 让第二页也有实质内容（而非纯静态页），让这个成本有回报。

### 3. 样式只用单 class 选择器

**为什么：** Runtime 当前只匹配单 class（Step 11 风险 2），后代选择器（`.wrapper .title`）不生效。模板如果用了后代选择器，生成的项目会出现「样式写了但没效果」——用户会以为自己写错了。

**代价：** 模板没有展示后代选择器的用法，而那是 CSS 的常见写法。README 里明确写了这个限制来弥补。

等 Runtime 补齐后代匹配，模板可以改用嵌套结构展示更完整的 CSS 能力。

### 4. `--force` 而非交互式确认

**为什么：** 交互式提示（`readline` 问 y/n）在三个场景下有问题：CI 环境无 TTY 会挂住、脚本调用需要额外处理、管道场景（`quickapp init x | tee log`）行为不确定。

`--force` 是显式的、可脚本化的、无歧义的。

**代价：** 用户第一次撞上冲突时要重跑一次命令加参数。错误信息里列出了三种可选做法（换名、删目录、加 force），降低这个摩擦。

### 5. 点文件不计入「目录非空」判断

**为什么：** 常见流程是先 `mkdir my-app && cd my-app && git init`，然后才想到用 `quickapp init`。此时目录里有 `.git`，如果算作非空会拒绝创建，用户必须加 `--force`——但他们的意图明确就是在这个目录里创建。

**代价：** 目录里只有 `.env` 或 `.npmrc` 这类配置文件时也被视为空，模板文件会直接写入。这些文件不会被模板覆盖（模板里没有同名文件），所以无害。

### 6. 未定义的占位符原样保留

**为什么：** 替换为空会静默产出错误内容。比如模板里误写了 `{{PACKAGE_NAME}}`（正确的是 `{{PACKAGE}}`），替换为空后 `manifest.package` 变成空字符串——到 Step 3 校验时才报「字段 package 不能为空字符串」，错误信息指向 manifest 而非模板。

保留占位符时，生成的 manifest 里是 `"package": "{{PACKAGE_NAME}}"`，Step 3 会校验通过（非空字符串），但产物包名是这个字面量——问题会在 13.6.6 的产物验证或 Runtime 加载时暴露。

两种失败都不理想，但保留的版本有明确线索（产物里能搜到 `{{`），且单测「产出的文件中无残留占位符」直接拦住这类错误。

**代价：** 需要那条单测来兜底。没有它的话，保留占位符只是把问题推后。

### 7. 包名用过滤而非替换连字符

**为什么：** `my-app` 有三种转换方式：

```text
过滤：com.example.myapp     一段
替换为点：com.example.my.app 两段，改变了包名层级
替换为下划线：com.example.my_app 合法但不常见
```

包名层级有语义（通常对应组织结构），项目名里的连字符不该产生新层级。过滤是最保守的选择。

**代价：** `my-app` 和 `myapp` 生成相同的包名。实际冲突概率低，且用户可以手动改 manifest。

### 8. 模板放在 `templates/` 而非嵌入代码

**为什么：** 模板文件就是真实的 `.ux` 和 `.json` 文件，放在文件系统里可以直接用编辑器打开、语法高亮、甚至直接 build 测试（`quickapp build --root=templates/default` 的父目录）。

嵌入代码（作为字符串常量）会让模板内容失去语法高亮，且多层转义（`.ux` 里的引号、`{{}}` 与模板字符串冲突）容易出错。

**代价：** 需要在 `package.json` 的 `files` 字段里包含 `templates/`，否则 `npm publish` 后用户装到的包里没有模板。`resolveTemplateDir` 的错误信息专门提示了这一点。

---

## QA

**Q：模板里的 `app.ux` 写了 `globalData` 和 `this.$app.xxx`，但页面里没用，为什么？**

因为 `this.$app.xxx` 的访问能力依赖 framework.js 的实现，而 `quickapp-runtime-js` 项目尚未开始——Android 侧当前用的是一份约 40 行的最小 framework.js（见 Android design.md），可能未实现这个能力。

模板的验收标准是「生成出来就能跑通」。如果页面里用了 `this.$app.appName`，而 framework.js 没实现，渲染出来会是空文本——违反验收标准。

写在 app.ux 里但不使用，是折中：用户能看到这个字段的位置和格式，等 framework.js 实现后可以直接用。README 里没有介绍这个用法，避免误导。

`quickapp-runtime-js` 完成后，应该回来更新模板，在页面里加一处 `this.$app.appName` 的使用示例。

**Q：为什么不做多模板（`--template=blank/tabbar/list`）？**

V1 只有一个模板的理由是维护成本。每个模板都要满足「生成即可 build 且能渲染」的验收标准，意味着每个都要跟随编译器和 Runtime 的能力演进。三个模板就是三倍的维护量。

更实际的问题是：当前 V1 的能力范围（div/text/input、单 class 选择器、无 for/if 指令）撑不起有意义的模板差异。`tabbar` 需要多页面切换的容器组件，`list` 需要 `for` 指令——都不在 V1 范围内。

等能力补齐后再加模板，那时差异才有价值。

**Q：`init` 为什么不自动执行 `npm install`？**

生成的项目不依赖任何 npm 包。快应用项目的 `.ux` 文件由 toolkit 编译，运行时能力由 Runtime 注入，不需要 `node_modules`。

模板里甚至没有 `package.json`——如果加了，用户会以为需要 `npm install`。不加更清晰：这是一个源码项目，用全局安装的 `quickapp` 命令构建。

**Q：为什么模板项目里没有 `package.json`？**

三个理由。项目不依赖 npm 包（上一问）。`package.json` 会让 `npm` 相关工具（依赖检查、安全扫描）介入一个不需要它们的项目。最后是 `quickapp build` 不读 `package.json`——项目配置全在 `src/manifest.json` 里。

如果用户想加脚本快捷方式，自己创建 `package.json` 写 `scripts` 即可，但那是他们的选择。

**Q：`copyTemplate` 里的 `entries.sort` 只为测试服务吗？**

主要为测试，但也让输出可预测。`fs.readdirSync` 的返回顺序取决于文件系统实现——同一份模板在 ext4 和 APFS 上可能顺序不同。排序让 `init` 的文件列表输出在任何平台一致。

这也让「产出的文件列表」可以作为断言依据，而不是每次都要排序后比对。

**Q：项目名允许点（`a.b`），但包名生成会过滤掉，会不会有歧义？**

会有轻微歧义：`a.b` 和 `ab` 生成相同包名。允许点是因为它在项目名里常见（`my-app.v2`），而且目录名允许点。

不允许点会拒绝合理的项目名；允许但过滤是两害相权的选择。用户对包名有要求时可以直接改 manifest——`init` 生成的是起点，不是终态。

**Q：`checkTarget` 返回 `'nonempty'` 也包括「目标是文件而非目录」的情况，合理吗？**

合理但错误信息不够精确。如果 `my-app` 是一个文件，用户会看到「目标目录已存在且非空」——但它不是目录。

区分它需要多一个返回值和多一条错误分支。这个情况极少见（用户很少建一个叫 `my-app` 的文件然后想在同名位置建项目），且给出的三条可选做法（换名、删除、force）里前两条仍然适用。

如果要改，`checkTarget` 加一个 `'not-a-directory'` 返回值，错误信息改为「目标已存在且不是目录」。

**Q：`--force` 会覆盖同名文件，有没有数据丢失风险？**

有。`copyTemplate` 用 `fs.writeFileSync` 直接写，同名文件被覆盖，无备份。

风险可控的理由是：`--force` 是用户显式加的参数，且错误信息里写明了「会覆盖同名文件」。模板只有 7 个文件，路径都是标准的（`src/manifest.json` 等），撞上用户已有文件的概率低。

要更安全可以在覆盖前备份（`.bak` 后缀），或先列出将被覆盖的文件让用户确认。但那又回到交互式的问题（决策 4）。

**Q：模板项目的 `dist/` 在 `.gitignore` 里，但 `init` 时 `dist/` 还不存在，为什么要写？**

`.gitignore` 是给用户后续使用的。他们 `build` 之后 `dist/` 就出现了，此时如果没有 `.gitignore`，`git status` 会显示一堆产物文件。

预置常见的忽略项是模板的价值之一——用户不需要自己想「哪些该忽略」。

**Q：13.6.7 的 Runtime 渲染验收依赖 Android 进度，如果 Runtime 还没好，这一步算通过吗？**

不算通过，算「暂缓」。Step 13 的完整验收需要这一项。

在 Runtime 就绪前，可以确认的是到 13.6.6 的产物内容验证——那已经能验证 bundle 结构、manifest 内容、占位符替换、样式属性名转换。这些覆盖了 toolkit 侧的全部职责。

剩下的渲染验收本质上是 Step 11 契约验收的一个实例（用模板项目而非示例项目）。Step 11 通过后，这一项大概率也通过——除非模板用了示例项目没覆盖的语法。

从这个角度看，模板刻意与示例项目保持相似的语法覆盖面（都是 div/text/input、单 class、插值、事件、router），就是为了让 Step 11 的验收结论能迁移过来。

---

## 下一步

Step 14：诊断输出与错误定位（Task 4.4）。

Step 13 完成后，三条主要工作流都通了：

```text
quickapp init   从零创建
quickapp build  出包
quickapp watch  增量迭代
```

Step 14 收尾的是横切关注点——**错误信息的质量**。前十三步各自实现了错误处理，但格式和行号换算的正确性没有统一验证过。

具体要做三件事：统一各阶段的诊断输出格式（Step 1 已实现 `formatDiagnostic`，需要验证所有阶段都走它）、验证行号换算（区块相对行号 → 文件绝对行号，三个编译器各自换算，Step 2/5/6/7 都有这个逻辑）、错误汇总（一次 build 报出全部问题而非第一个）。

行号换算的验证是重点。它在 Step 5/6/7 各自有单测，但没有端到端验证——在真实的 `.ux` 文件里，`<script>` 区块第 3 行的语法错误是否报成文件第 22 行。这类错误如果行号偏了，开发者会看到无关的代码。
