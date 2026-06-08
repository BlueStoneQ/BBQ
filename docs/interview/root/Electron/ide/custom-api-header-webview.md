# 02 - 暴露 API 与自定义 Webview 区域

> 核心问题: 如何为插件暴露一个新 API，在 IDE 顶部创建 Webview？ 从 API 设计到全栈实现。

## 目录

- [需求分析](#需求分析)
- [方案对比与选型](#方案对比与选型)
- [方案 A: 复用 ViewContainer 体系 (推荐)](#方案-a-复用-viewcontainer-体系-推荐)
  - [设计思路](#设计思路)
  - [插件侧用法 (零变化)](#插件侧用法-零变化)
  - [源码改动 (3 处)](#源码改动-3-处)
  - [为什么推荐](#为什么推荐)
- [方案 B: 从零新建 Part + API (全链路)](#方案-b-从零新建-part--api-全链路)
  - [API 设计](#api-设计)
  - [架构全景](#架构全景)
  - [实现: 7 步全链路](#实现-7-步全链路)
  - [数据流全景](#数据流全景)
- [安全设计](#安全设计)
- [设计决策与取舍](#设计决策与取舍)
- [文件清单](#文件清单)
- [小结](#小结)

---

## 需求分析

**用户故事**: 插件开发者希望在 IDE 顶部（TitleBar 下方、Editor 上方）展示一个 Webview 区域，用于显示公告、构建状态、自定义工具栏等。

**技术需求拆解**:
1. 在 Workbench Layout 中支持一个新的 Header 位置
2. 插件可以在该位置注册 Webview 内容
3. 安全隔离、生命周期管理、消息通信

---

## 方案对比与选型

| 维度 | 方案 A: 复用 ViewContainer | 方案 B: 新建 Part + API |
|------|--------------------------|----------------------|
| 改动文件 | 3~4 个 | 9+ 个 |
| 插件 API 变化 | 零 (标准 WebviewViewProvider) | 新增专有 API |
| 复用程度 | 安全/通信/生命周期全复用 | 重新实现 |
| 上游合并冲突 | 极小 | 中等 |
| 工作量 | 1~2 天 | 1~2 周 |
| 适用场景 | 满足大多数需求 | 需要完全自定义交互 |

**推荐**: 优先用方案 A。只有当 ViewContainer 机制无法满足（比如需要多个 Webview 堆叠、自定义拖拽等深度交互）时，才考虑方案 B。

---

## 方案 A: 复用 ViewContainer 体系 (推荐)

### 设计思路

**方案本质**: 不发明新 API，而是在 VSCode 已有的 ViewContainer 位置体系中加一个 `Header` 位置。插件侧继续用标准的 `WebviewViewProvider` 注册，安全/通信/生命周期机制全部复用——唯一的变化只是 Webview 渲染的物理位置从 SideBar/Panel 变成了 Editor 上方。

**插件开发者注册 Header WebView 的完整示例**：

```jsonc
// ===== package.json（声明位置）=====
{
  "contributes": {
    "viewsContainers": {
      "header": [                              // ← 唯一区别：key 从 "activitybar" 换成 "header"
        { "id": "buildStatus", "title": "Build", "icon": "media/build.svg" }
      ]
    },
    "views": {
      "buildStatus": [
        { "type": "webview", "id": "myExt.buildBanner", "name": "Build Status" }
      ]
    }
  }
}
```

```typescript
// ===== extension.ts（注册 Provider）=====
import * as vscode from 'vscode';

// 和注册 SideBar WebView 完全一样的代码，零区别
class BuildBannerProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(view: vscode.WebviewView) {
    view.webview.options = { enableScripts: true };
    view.webview.html = `
      <div style="display:flex;align-items:center;height:40px;padding:0 16px;">
        <span>🔨 Building project...</span>
        <progress value="60" max="100" style="margin-left:12px;"></progress>
      </div>
    `;
    // 接收 Webview 发来的消息
    view.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'cancel') { /* 取消构建 */ }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('myExt.buildBanner', new BuildBannerProvider())
  );
}
```

```
效果：IDE 顶部出现一个 40px 高的 Banner，显示构建进度。
插件开发者不需要学任何新 API——心智模型和注册 SideBar WebView 完全一致。
```

VSCode 已有完整的 ViewContainer 位置体系：

```
当前支持的位置:
┌─────────────────────────────────────────┐
│ TitleBar                                 │
├──────────┬──────────────────┬───────────┤
│ SideBar  │ Editor           │ Secondary │ ← ViewContainerLocation.Sidebar / AuxiliaryBar
│ (views)  │                  │ SideBar   │
├──────────┴──────────────────┴───────────┤
│ Panel (views)                            │ ← ViewContainerLocation.Panel
├─────────────────────────────────────────┤
│ StatusBar                                │
└─────────────────────────────────────────┘
```

我们只需**在枚举中加一个 `Header` 位置 + 在 Layout（Workbench 的 Grid 布局系统，负责 TitleBar/SideBar/Editor/Panel 等各区域的位置和尺寸分配）中为它分配 DOM 容器**，其余所有机制（WebviewViewProvider、package.json 声明、消息通信、安全沙箱）全部复用。

```
改造后:
┌─────────────────────────────────────────┐
│ TitleBar                                 │
├─────────────────────────────────────────┤
│ ★ Header (views)                         │ ← ViewContainerLocation.Header (新增)
├──────────┬──────────────────┬───────────┤
│ SideBar  │ Editor           │ Secondary │
│          │                  │ SideBar   │
├──────────┴──────────────────┴───────────┤
│ Panel                                    │
├─────────────────────────────────────────┤
│ StatusBar                                │
└─────────────────────────────────────────┘
```

### 插件侧用法 (零变化)

```json
// package.json — 和注册 SideBar Webview 一模一样，只是位置换成 "header"
{
  "contributes": {
    "viewsContainers": {
      "header": [
        { "id": "buildStatus", "title": "Build", "icon": "media/build.svg" }
      ]
    },
    "views": {
      "buildStatus": [
        { "type": "webview", "id": "myExt.buildBanner", "name": "Build Status" }
      ]
    }
  }
}
```

```typescript
// 插件代码 — 和现有 WebviewViewProvider 完全一样
class BuildBannerProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(view: vscode.WebviewView) {
    view.webview.options = { enableScripts: true };
    view.webview.html = `
      <div style="display:flex;align-items:center;height:40px;padding:0 16px;">
        <span>🔨 Building project...</span>
        <progress value="60" max="100" style="margin-left:12px;"></progress>
      </div>
    `;
    view.webview.onDidReceiveMessage(msg => { /* 处理消息 */ });
  }
}

// 注册
vscode.window.registerWebviewViewProvider('myExt.buildBanner', new BuildBannerProvider());
```

**插件开发者不需要学任何新 API**——和注册一个 SideBar Webview 一样的心智模型。

### 源码改动 (3 处)

#### 改动 1: ViewContainerLocation 枚举加值

```
文件: src/vs/workbench/common/views.ts
作用: 定义 VS Code 中所有"视图容器可以放在哪"的枚举。
      SideBar / Panel / AuxiliaryBar 等位置都在这里定义。
      插件 package.json 中写的 "activitybar" / "panel" 最终映射到这个枚举值。
```

```typescript
export const enum ViewContainerLocation {
  Sidebar,       // 左侧边栏
  Panel,         // 底部面板
  AuxiliaryBar,  // 右侧辅助栏
  Header,        // ← 新增：顶部区域（TitleBar 下方、Editor 上方）
}
```

#### 改动 2: Layout 中为 Header 分配 DOM

```
文件: src/vs/workbench/browser/layout.ts
作用: Workbench 的布局总控文件。负责把 TitleBar / SideBar / Editor / Panel / StatusBar
      等各个 Part 按 Grid 布局排列，决定谁在上谁在下、宽高怎么分配。
      相当于整个 IDE 界面的"骨架搭建"文件。
```

```typescript
// 在 Grid 布局中，titleBarPart 和 editorPart 之间插入:
this.headerPart = this.instantiationService.createInstance(
  PaneCompositePart,        // ← 复用已有的 PaneComposite 容器！
  'header',
  { hasTitle: false }       // 不显示标题栏
);

// Grid 顺序: titleBar → headerPart → [sideBar + editor + auxBar] → panel → statusBar
// headerPart 默认高度 0 (无内容时不占空间)
// 有 view 注册时自动展开，max-height 限制 (如 120px)
```

#### 改动 3: ViewDescriptorService 解析映射

```
文件: src/vs/workbench/services/views/ (ViewContainerRegistry 相关)
作用: 负责解析插件 package.json 中的 contributes.viewsContainers 字段，
      把插件声明的 "activitybar" / "panel" 等字符串 key 映射到 ViewContainerLocation 枚举值。
      系统根据这个映射决定把插件的 View 渲染到哪个位置。
```

在解析 `package.json` 的 `contributes.viewsContainers` 时，识别 `"header"` key 并映射到 `ViewContainerLocation.Header`：

```typescript
// 已有逻辑 (简化):
if (key === 'activitybar') → ViewContainerLocation.Sidebar
if (key === 'panel')       → ViewContainerLocation.Panel
// 新增:
if (key === 'header')      → ViewContainerLocation.Header
```

#### 额外: 高度限制

```typescript
// headerPart 的约束
maximumHeight = 120;  // 防止插件撑满整个窗口
minimumHeight = 0;    // 无内容时完全隐藏
```

### 为什么推荐

| 收益 | 说明 |
|------|------|
| 零新 API | 插件开发者无学习成本 |
| 全复用 | 安全沙箱、postMessage、lifecycle 都是已有的 |
| 改动小 | 3 个文件，合并冲突极小 |
| 向后兼容 | 不影响已有的 SideBar/Panel 逻辑 |
| 可渐进 | 先内部用，稳定后可提 PR 回上游 |

---

## 方案 B: 从零新建 Part + API (全链路)

> 以下方案适用于需要完全自定义交互（非标准 ViewContainer 行为）的场景。
> 架构理解价值高，但工程推荐度低于方案 A。

---

## 方案设计

### API 设计

> 以下为方案 B 的专有 API，当方案 A 无法满足需求时使用。

```typescript
// 插件侧使用方式
const banner = vscode.window.createTopBannerWebview('build-status', {
  height: 48,
  enableScripts: true,
  retainContextWhenHidden: true
});

// 设置内容
banner.webview.html = `
  <div style="display:flex;align-items:center;padding:8px 16px;">
    <span>🔨 Building...</span>
    <progress value="60" max="100"></progress>
  </div>
`;

// 监听来自 Webview 的消息
banner.webview.onDidReceiveMessage(msg => {
  if (msg.command === 'cancel') { cancelBuild(); }
});

// 向 Webview 发消息
banner.webview.postMessage({ progress: 80 });

// 隐藏/销毁
banner.visible = false;
banner.dispose();
```

### 架构全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VSCode IDE                                    │
│                                                                     │
│  Extension Host Process          │    Renderer Process               │
│  ┌───────────────────────┐      │    ┌────────────────────────────┐│
│  │ [插件代码]             │      │    │  MainThreadTopBanner       ││
│  │   ↓                   │      │    │    ↓                        ││
│  │ ExtHostTopBanner      │──RPC──→   │  ITopBannerService          ││
│  │   ↓                   │      │    │    ↓                        ││
│  │ 创建 Webview handle   │      │    │  TopBannerPart              ││
│  │ 设置 HTML/消息        │      │    │    ↓                        ││
│  └───────────────────────┘      │    │  <iframe> (隔离 Webview)    ││
│                                 │    └────────────────────────────┘│
│                                 │                                    │
│  ┌──────────────────────────────┼──────────────────────────────────┐│
│  │ Workbench Layout                                                 ││
│  │ ┌─────────────────────────────────────────────────────────────┐ ││
│  │ │ TitleBar                                                     │ ││
│  │ ├─────────────────────────────────────────────────────────────┤ ││
│  │ │ ★ TopBannerPart (height: 0~N px, 动态)                      │ ││
│  │ ├──────────┬──────────────────────────────┬───────────────────┤ ││
│  │ │ SideBar  │ EditorPart                   │ SecondaryBar      │ ││
│  │ ├──────────┴──────────────────────────────┴───────────────────┤ ││
│  │ │ PanelPart                                                    │ ││
│  │ ├─────────────────────────────────────────────────────────────┤ ││
│  │ │ StatusBar                                                    │ ││
│  │ └─────────────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 实现: 7 步全链路

### Step 1: 定义 RPC 协议接口

**文件**: `src/vs/workbench/api/common/extHost.protocol.ts`

```typescript
// === 协议形状定义 ===

export interface TopBannerOptions {
  height: number;
  enableScripts?: boolean;
  retainContextWhenHidden?: boolean;
}

// Extension Host → Renderer 方向
export interface MainThreadTopBannerShape {
  $create(handle: number, id: string, options: TopBannerOptions): void;
  $setHtml(handle: number, html: string): void;
  $setVisible(handle: number, visible: boolean): void;
  $postMessage(handle: number, message: any): Promise<boolean>;
  $dispose(handle: number): void;
}

// Renderer → Extension Host 方向
export interface ExtHostTopBannerShape {
  $onMessage(handle: number, message: any): void;
  $onDispose(handle: number): void;
}

// 注册标识符
export const MainContext = {
  // ...已有
  MainThreadTopBanner: createMainId<MainThreadTopBannerShape>('MainThreadTopBanner'),
};

export const ExtHostContext = {
  // ...已有
  ExtHostTopBanner: createExtId<ExtHostTopBannerShape>('ExtHostTopBanner'),
};
```

**为什么 `$` 前缀**: VSCode 约定，所有跨进程调用的方法用 `$` 标记，code review 一眼可见。

### Step 2: ExtHost 侧实现

**新建**: `src/vs/workbench/api/common/extHostTopBanner.ts`

```typescript
import { MainContext, MainThreadTopBannerShape, TopBannerOptions } from './extHost.protocol';
import { IRPCProtocol } from 'vs/workbench/services/extensions/common/rpcProtocol';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

export class ExtHostTopBanner implements ExtHostTopBannerShape {
  private _proxy: MainThreadTopBannerShape;
  private _handles = new Map<number, TopBannerWebviewImpl>();
  private _handleCounter = 0;

  constructor(rpc: IRPCProtocol) {
    this._proxy = rpc.getProxy(MainContext.MainThreadTopBanner);
  }

  // 给插件调的 API
  createTopBannerWebview(id: string, options: TopBannerOptions): TopBannerWebview {
    const handle = this._handleCounter++;
    this._proxy.$create(handle, id, options);
    
    const impl = new TopBannerWebviewImpl(handle, this._proxy);
    this._handles.set(handle, impl);
    return impl;
  }

  // Renderer 发来的消息
  $onMessage(handle: number, message: any): void {
    this._handles.get(handle)?._fireMessage(message);
  }

  $onDispose(handle: number): void {
    this._handles.get(handle)?._fireDispose();
    this._handles.delete(handle);
  }
}

class TopBannerWebviewImpl extends Disposable {
  private _onDidReceiveMessage = new Emitter<any>();
  readonly onDidReceiveMessage: Event<any> = this._onDidReceiveMessage.event;

  private _onDidDispose = new Emitter<void>();
  readonly onDidDispose: Event<void> = this._onDidDispose.event;

  constructor(
    private _handle: number,
    private _proxy: MainThreadTopBannerShape
  ) {
    super();
  }

  set html(value: string) {
    this._proxy.$setHtml(this._handle, value);
  }

  set visible(value: boolean) {
    this._proxy.$setVisible(this._handle, value);
  }

  postMessage(message: any): Promise<boolean> {
    return this._proxy.$postMessage(this._handle, message);
  }

  dispose(): void {
    this._proxy.$dispose(this._handle);
    super.dispose();
  }

  // 内部方法，供 ExtHostTopBanner 调用
  _fireMessage(msg: any) { this._onDidReceiveMessage.fire(msg); }
  _fireDispose() { this._onDidDispose.fire(); }
}
```

### Step 3: 注册到 Extension API

**文件**: `src/vs/workbench/api/common/extHost.api.impl.ts`

```typescript
// 在 createApiFactoryAndRegisterStores() 中:
const extHostTopBanner = rpcProtocol.set(ExtHostContext.ExtHostTopBanner, new ExtHostTopBanner(rpcProtocol));

// 在 window 命名空间下:
const window = {
  // ...已有 API
  createTopBannerWebview(id: string, options: TopBannerOptions) {
    return extHostTopBanner.createTopBannerWebview(id, options);
  }
};
```

### Step 4: MainThread 侧实现

**新建**: `src/vs/workbench/api/browser/mainThreadTopBanner.ts`

```typescript
import { MainThreadTopBannerShape, ExtHostTopBannerShape, ExtHostContext } from '../common/extHost.protocol';
import { ITopBannerService } from 'vs/workbench/services/topBanner/common/topBanner';
import { extHostCustomer, IExtHostContext } from '../common/extHostCustomers';

@extHostCustomer
export class MainThreadTopBanner implements MainThreadTopBannerShape {
  private _extHost: ExtHostTopBannerShape;

  constructor(
    extHostContext: IExtHostContext,
    @ITopBannerService private readonly _topBannerService: ITopBannerService
  ) {
    this._extHost = extHostContext.getProxy(ExtHostContext.ExtHostTopBanner);
  }

  $create(handle: number, id: string, options: TopBannerOptions): void {
    this._topBannerService.create(handle, id, options);
    // 注册 Webview 的消息回调
    this._topBannerService.onMessage(handle, msg => {
      this._extHost.$onMessage(handle, msg);
    });
  }

  $setHtml(handle: number, html: string): void {
    this._topBannerService.setHtml(handle, html);
  }

  $setVisible(handle: number, visible: boolean): void {
    this._topBannerService.setVisible(handle, visible);
  }

  $postMessage(handle: number, message: any): Promise<boolean> {
    return this._topBannerService.postMessage(handle, message);
  }

  $dispose(handle: number): void {
    this._topBannerService.dispose(handle);
  }
}
```

### Step 5: 定义 Workbench Service

```
src/vs/workbench/services/topBanner/
├── common/
│   └── topBanner.ts          ← 接口
└── browser/
    └── topBannerService.ts   ← 实现
```

```typescript
// common/topBanner.ts
export const ITopBannerService = createDecorator<ITopBannerService>('topBannerService');

export interface ITopBannerService {
  readonly _serviceBrand: undefined;
  create(handle: number, id: string, options: TopBannerOptions): void;
  setHtml(handle: number, html: string): void;
  setVisible(handle: number, visible: boolean): void;
  postMessage(handle: number, message: any): Promise<boolean>;
  onMessage(handle: number, callback: (msg: any) => void): void;
  dispose(handle: number): void;
}
```

### Step 6: 创建 TopBanner Part

**新建**: `src/vs/workbench/browser/parts/topBanner/topBannerPart.ts`

```typescript
export class TopBannerPart extends Part {
  private _webviewElement: HTMLIFrameElement | undefined;
  private _height: number = 0;

  // 创建 DOM
  protected override createContentArea(parent: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    container.style.overflow = 'hidden';
    parent.appendChild(container);
    return container;
  }

  show(options: TopBannerOptions): void {
    this._height = options.height;
    // 创建 iframe (使用 vscode-webview:// 协议)
    this._webviewElement = document.createElement('iframe');
    this._webviewElement.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    this._webviewElement.src = `vscode-webview://${uuid}/index.html`;
    this.getContentArea().appendChild(this._webviewElement);
    // 触发 Layout 重算
    this.layout(this._height);
  }

  hide(): void {
    this._height = 0;
    this._webviewElement?.remove();
    this.layout(0);
  }
}
```

### Step 7: 集成到 Layout

**文件**: `src/vs/workbench/browser/layout.ts`

在 Workbench Grid 中注册 TopBannerPart:

```typescript
// 在 Parts 创建时
this.topBannerPart = this.instantiationService.createInstance(TopBannerPart);

// 在 Grid 布局中，放在 TitleBar 下方、Editor 上方
// Grid 结构: [TitleBar] [TopBanner] [EditorArea + SideBars] [Panel] [StatusBar]
```

---

## 数据流全景

```
[插件代码] vscode.window.createTopBannerWebview('id', {height: 48})
    │
    ▼ (ExtHost 进程)
[ExtHostTopBanner] → proxy.$create(handle=0, 'id', {height:48})
    │
    ▼ (RPC: MessagePort)
    │
[MainThreadTopBanner] → topBannerService.create(0, 'id', {height:48})
    │
    ▼ (Renderer 进程)
[TopBannerService] → topBannerPart.show({height:48})
    │
    ▼
[TopBannerPart] → 创建 <iframe vscode-webview://uuid>
    │              → this.layout(48) → Grid 重算高度
    ▼
[Workbench Layout] → TopBanner 区域从 0px 展开到 48px
    │
    ▼
[用户看到顶部 Banner]


=== HTML 更新 ===

[插件] banner.webview.html = '<div>...</div>'
    │
    ▼
[ExtHost] → proxy.$setHtml(handle, html)
    │
    ▼ (RPC)
[MainThread] → service.setHtml(handle, html)
    │
    ▼
[TopBannerPart] → iframe.contentWindow.postMessage({type:'setHtml', html})
    │
    ▼
[Webview iframe] → document.body.innerHTML = html


=== Webview → 插件 消息 ===

[Webview iframe] window.parent.postMessage({command:'cancel'})
    │
    ▼
[TopBannerPart] → 监听 'message' 事件 → service.fireMessage(handle, msg)
    │
    ▼
[MainThreadTopBanner] → extHost.$onMessage(handle, msg)
    │
    ▼ (RPC)
[ExtHostTopBanner] → impl._fireMessage(msg)
    │
    ▼
[插件] banner.webview.onDidReceiveMessage → msg = {command:'cancel'}
```

---

## 安全设计

| 层面 | 措施 |
|------|------|
| 进程隔离 | 插件 (ExtHost) 不直接操作 DOM |
| Webview 沙箱 | iframe sandbox 属性限制能力 |
| CSP | 只允许加载 vscode-webview:// 资源 |
| 通信隔离 | Webview 只能 postMessage，不能 require/import |
| 资源控制 | nonce 机制防止 XSS 脚本注入 |
| 生命周期 | 插件卸载时自动 dispose，不留残余 |

---

## 设计决策与取舍

| 决策 | 为什么 |
|------|--------|
| 走 RPC 而非直接 DOM | 安全 + 架构一致性 — 和所有其他 API 同一模式 |
| 独立 Part 而非嵌入 TitleBar | TitleBar 是 native 控件(macOS)，嵌 webview 复杂 |
| 全量 HTML 传输 | 简单；后续可优化为差量更新 |
| 高度固定由插件指定 | 避免 Webview 内容撑开导致布局抖动 |
| Proposed API 先行 | 防止 API 设计错误后不可回退 |
| iframe 而非 webview 标签 | Electron webview 标签将被废弃，iframe 是未来 |

---

## 文件清单

```
新增/修改的文件:

src/vs/workbench/api/common/extHost.protocol.ts          ← 加协议定义
src/vs/workbench/api/common/extHostTopBanner.ts          ← 新建: ExtHost 侧
src/vs/workbench/api/common/extHost.api.impl.ts          ← 加 API 注册
src/vs/workbench/api/browser/mainThreadTopBanner.ts      ← 新建: MainThread 侧
src/vs/workbench/services/topBanner/common/topBanner.ts  ← 新建: Service 接口
src/vs/workbench/services/topBanner/browser/topBannerService.ts  ← 新建: 实现
src/vs/workbench/browser/parts/topBanner/topBannerPart.ts ← 新建: UI Part
src/vs/workbench/browser/layout.ts                        ← 改: 注册 Part 到 Grid
src/vs/workbench/workbench.desktop.main.ts               ← 改: import 注册
```

---

## 小结

| 维度 | 关键认知 |
|------|---------|
| API 暴露的本质 | ExtHost ←RPC→ MainThread ←DI→ Service ←DOM→ Part |
| 跨进程的代价 | 每个 API 调用都是异步的，不能阻塞 |
| 设计的完整链路 | 协议定义 → ExtHost → MainThread → Service → Part → DOM |
| 安全的边界 | 插件永远不碰 DOM，Webview 永远在 iframe 沙箱中 |
| 架构一致性 | 和 WebviewPanel/Terminal 等已有功能的模式完全一致 |
