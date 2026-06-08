# 03 - 内置插件自动安装方案

> 核心问题：IDE 首次启动时，如何自动从扩展商店安装一组预定义的功能插件？

---

## 目录

- [需求](#需求)
- [方案设计](#方案设计)
- [实现](#实现)
- [配置文件](#配置文件)
- [流程图](#流程图)
- [容错与体验](#容错与体验)

---

## 需求

```
用户安装 IDE 后首次启动：
  → 自动安装语言支持、调试、构建等功能插件
  → 不需要用户手动搜索/安装
  → 插件独立发布到商店，IDE 安装包不内嵌（保持轻量）
```

---

## 方案设计

```
方案对比：

  A. builtInExtensions（构建时内嵌）
     product.json → builtInExtensions 数组
     构建时从 CDN 下载 vsix 打入安装包
     缺点：安装包变大 + 插件更新必须发新版 IDE

  B. 首次启动时从商店拉取（我们的选择）✅
     IDE 维护一个推荐插件列表
     首次启动时检测 → 未安装的自动从商店下载安装
     优点：IDE 安装包轻量 + 插件独立迭代

  C. 混合模式
     核心插件内嵌（保证离线可用）+ 非核心首次启动拉取
```

---

## 实现

### 核心逻辑

```typescript
// src/vs/workbench/contrib/extensionRecommendations/builtinExtensionInstaller.ts

import { IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';

const INSTALLED_KEY = 'quickapp-ide.builtin-extensions-installed';

export class BuiltinExtensionInstaller {
  // 这是一个 Workbench Contribution：不被显式调用，
  // 通过 registerWorkbenchContribution2 注册后，
  // VS Code 生命周期系统在启动时自动实例化并注入依赖（DI）。
  constructor(
    @IExtensionManagementService private extensionService: IExtensionManagementService,
    @IStorageService private storageService: IStorageService,
  ) {
    this.installIfFirstLaunch();
  }

  private async installIfFirstLaunch(): Promise<void> {
    // 1. 检查是否已经执行过（用 StorageService 标记）
    const installed = this.storageService.getBoolean(INSTALLED_KEY, StorageScope.APPLICATION, false);
    if (installed) return;

    // 2. 读取内置插件列表
    const list = this.getBuiltinExtensionList();

    // 3. 获取已安装的插件 ID
    const existing = await this.extensionService.getInstalled();
    const existingIds = new Set(existing.map(e => e.identifier.id.toLowerCase()));

    // 4. 过滤出未安装的
    const toInstall = list.filter(id => !existingIds.has(id.toLowerCase()));

    // 5. 逐个从商店安装
    for (const extensionId of toInstall) {
      try {
        await this.extensionService.installFromGallery({ id: extensionId });
      } catch (e) {
        // 单个失败不阻塞其他插件安装
        console.warn(`Failed to install ${extensionId}:`, e);
      }
    }

    // 6. 标记完成（下次启动不再执行）
    this.storageService.store(INSTALLED_KEY, true, StorageScope.APPLICATION);
  }

  private getBuiltinExtensionList(): string[] {
    // 从 product.json 或独立配置文件读取
    return [
      'quickapp.language-support',
      'quickapp.debugger',
      'quickapp.build-tools',
      'quickapp.project-manager',
      'quickapp.analysis-tools',
    ];
  }
}
```

### 注册时机

```typescript
// src/vs/workbench/contrib/extensionRecommendations/builtinExtensionInstaller.ts
// 在文件底部直接注册（VS Code 的 contrib 模式：文件被 import 时自动执行注册）

import { registerWorkbenchContribution2, WorkbenchPhase } from 'vs/workbench/common/contributions';
import { BuiltinExtensionInstaller } from './builtinExtensionInstaller';

registerWorkbenchContribution2(
  'quickapp.builtinExtensionInstaller',  // ID：唯一标识符，自己起名，用于调试/日志/防重复
  BuiltinExtensionInstaller,              // 类引用：系统到了指定阶段会自动 new 这个类, 执行的是构造函数
  WorkbenchPhase.Eventually               // 阶段：IDE 完全启动后再执行，不阻塞首屏
);

// 然后在 workbench.desktop.main.ts 中 import 这个文件(顺便就执行了这个文件)：
// 路径：src/vs/workbench/workbench.desktop.main.ts
// 作用：渲染进程的总入口文件（相当于前端项目的 main.ts / index.ts）
//       里面几百行 import 语句，把所有 contrib 模块串起来。
//       IDE 启动时先执行这个文件 → 所有 import 触发 → 所有 contribution 注册完成。
//       要新增功能，就在这里加一行 import。要删功能，就去掉对应的 import。
//
// import './contrib/extensionRecommendations/builtinExtensionInstaller';
// → import 触发文件执行 → registerWorkbenchContribution2 被调用 → 注册完成
```

**关键概念说明**：

```
Q: Workbench 是什么？
A: VS Code 源码分三层：base（工具库）→ platform（服务层）→ workbench（IDE UI 层）。
   Workbench = VS Code 作为 IDE 的整个界面层（编辑器/侧边栏/面板/菜单/命令全在这里）。

Q: registerWorkbenchContribution2 是什么？谁的 API？
A: VS Code 自己的（不是 Electron 的）。
   作用 = 向 VS Code 生命周期系统注册一个"启动任务"。
   到了指定 Phase，系统自动 new 这个类（通过 DI 注入构造函数中的依赖）。

Q: 执行的是什么方法？
A: 构造函数（constructor）。系统 new 的时候执行 constructor → 里面调了 this.installIfFirstLaunch()。
   没有额外的 onInit / run 之类的方法，就是靠构造函数触发逻辑。

Q: 字符串 ID 是什么？
A: 唯一标识符，自己起名（约定 namespace.featureName），用于调试日志和防重复注册。

Q: 类名是固定的吗？
A: 不是。随便起，系统只认 registerWorkbenchContribution2 传入的类引用。

Q: registerWorkbenchContribution2 在哪？启动入口怎么找到这里？
A: 定义在 src/vs/workbench/common/contributions.ts。
   不需要 export 给谁，不需要被显式调用。机制如下：
   
   workbench.desktop.main.ts（渲染进程入口）
     → 里面几百行 import 语句，每行 import 一个 contrib 文件
     → import 触发文件顶层代码执行 → registerWorkbenchContribution2() 被调
     → 往全局注册表（数组）push 一条 { id, ctor, phase }
     → IDE 启动到对应 Phase 时，遍历注册表 → new ctor()（DI 注入）→ constructor 执行
   
   本质 = import 副作用 + 全局注册表 + 生命周期遍历。
   和 Webpack require.context 批量导入插件一个思路。

Q: LifecyclePhase / WorkbenchPhase 有哪些阶段？
A: Starting → Ready → Restored → Eventually
   Eventually = 最晚阶段，IDE 完全可用后才执行（不阻塞用户操作）。

类比其他框架：
  NestJS:  @Injectable() + @OnModuleInit() → 模块初始化时自动执行
  Android: ContentProvider.onCreate() → App 启动时系统自动调用
  Spring:  @PostConstruct → 容器创建 Bean 后自动执行
```

---

## 配置文件

插件列表可以放在 product.json 中：

```jsonc
// product.json
{
  "quickappBuiltinExtensions": [
    "quickapp.language-support",    // 语法高亮 + LSP
    "quickapp.debugger",            // 真机/模拟器调试
    "quickapp.build-tools",         // 构建/打包命令
    "quickapp.project-manager",     // 项目模板创建
    "quickapp.analysis-tools"       // 依赖分析 & 评分
  ]
}
```

---

## 流程图

```
IDE 首次启动
  │
  ▼
检查 StorageService 标记（是否已安装过）
  │
  ├─ 已标记 → 跳过（正常启动）
  │
  └─ 未标记 ↓
     读取 product.json 中的插件列表
       │
       ▼
     获取已安装插件 → 过滤出未安装的
       │
       ▼
     逐个调 extensionService.installFromGallery()
       │
       ▼
     全部完成 → StorageService 标记为 true
       │
       ▼
     提示用户 "Reload to activate extensions"（或自动 reload）
```

---

## 容错与体验

| 场景 | 处理 |
|------|------|
| 网络不可用 | 跳过安装，下次启动重试（不标记为完成） |
| 单个插件安装失败 | try-catch 跳过，不阻塞其他插件 |
| 商店不可达 | 超时后跳过，记录日志 |
| 插件已存在（用户手动装过） | 过滤掉，不重复安装 |
| 安装过程中用户关闭 IDE | 下次启动继续（未标记完成） |
| 安装完需要激活 | 安装完提示 reload，或注册 `onExtensionInstalled` 自动 reload |

---

## 与 builtInExtensions 的区别

| | builtInExtensions（内嵌） | 首次启动安装（我们的方案） |
|---|---|---|
| 打包时机 | 构建时下载打入安装包 | 用户首次启动时从商店拉取 |
| 安装包体积 | 大（含所有插件 vsix） | 小（只有 IDE 本体） |
| 插件更新 | 必须发新版 IDE | 插件独立更新 |
| 离线可用 | ✅ | ❌（首次需要网络） |
| 适用 | 核心运行时必须的插件 | 功能性插件 |
