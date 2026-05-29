# 快应用 IDE 插件系统实践

## 需求 1：扩展 TopBar / RightBar 插件 API

> **本质**：插件通过 package.json 声明式注册 UI 贡献点 → IDE 启动时解析注册表 → 渲染进程根据注册表动态创建容器 + Webview。底层就是"配置驱动的动态 UI 插槽"。

### 问题

VS Code 原生只提供 ActivityBar（左侧栏）和 Panel（底部栏）的 UI 贡献点。快应用 IDE 需要在**顶栏**和**右侧栏**放置自定义面板（如设备状态面板、性能监控面板），原生 API 不支持。

### 方案设计

参考 VS Code 的 `contributes.viewsContainers` 机制，新增两个 UI 贡献点：

```json
// 插件的 package.json（声明式注册）
{
  "contributes": {
    "viewsContainers": {
      "topBar": [
        {
          "id": "device-status",
          "title": "设备状态",
          "icon": "resources/device.svg"
        }
      ],
      "rightBar": [
        {
          "id": "perf-monitor",
          "title": "性能监控",
          "icon": "resources/perf.svg"
        }
      ]
    },
    "views": {
      "device-status": [
        { "id": "device-status.panel", "name": "连接状态" }
      ],
      "perf-monitor": [
        { "id": "perf-monitor.panel", "name": "实时帧率" }
      ]
    }
  }
}
```

### 实现架构

**核心流程**：插件声明位置 → IDE 框架创建容器 → 回调插件填充内容。插件不自己创建 Webview，只负责"给内容"。

**底层逻辑**：

- **DOM 容器是什么？** 就是一个 `<div>`。IDE Workbench 本身是 DOM 渲染的，TopBar/RightBar 是布局中的 `<div>` 插槽，里面嵌入 `<webview>` 标签（Electron 的 webview = 隔离的 iframe）。
- **什么时候创建？** **IDE 每次启动时**（不是插件安装时）。因为安装时 IDE 可能没在运行。每次启动重新解析所有插件的 package.json 构建注册表。
- **为什么是懒填充？** 容器创建后初始为空，用户点击/容器可见时才触发 `resolveWebviewView()` 回调让插件填充内容——避免启动时加载所有插件 UI。

```
IDE 启动（Workbench 渲染进程）
  │
  ▼ 扫描所有已安装插件的 package.json
  │  解析 contributes.viewsContainers（收集谁注册了 topBar/rightBar）
  │
  ▼ Workbench 布局渲染
  │  根据注册表在对应位置创建 <div> 容器（空的 DOM 插槽）
  │
  ▼ 容器可见时（用户点击 Tab / 面板展开）
  │  IDE 调用插件注册的 WebviewViewProvider.resolveWebviewView()
  │
  ▼ 插件在回调中设置 webview.html（填充内容）
  │  IDE 在 <div> 容器内创建 <webview> 标签，加载插件提供的 HTML
  │
  ▼ 用户看到面板内容
```

类比：就像 React 中 `{visible && <div ref={containerRef} />}` —— 容器是框架渲染的，内容是回调填充的。

**核心 API**：

```typescript
// 插件代码（activate 函数中注册 Provider）
export function activate(context: vscode.ExtensionContext) {
  // registerWebviewViewProvider：告诉 IDE "当需要渲染这个 view 时，调我"
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'device-status.panel',  // ← 和 package.json 中 views 的 id 对应
      new DeviceStatusProvider(context)
    )
  );
}

// Provider 实现：IDE 创建好容器后回调这个方法，你只需要填充内容
class DeviceStatusProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = `
      <html>
        <body>
          <div id="root"></div>
          <script src="${this.getScriptUri(webviewView)}"></script>
        </body>
      </html>
    `;

    // Webview ↔ 插件通信（和 Electron IPC 同一模式）
    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'refresh') this.updateDeviceStatus(webviewView);
    });
  }
}
```

**关键区分**：
- `createWebviewPanel`：插件主动创建独立面板（弹出式，类似新窗口）
- `registerWebviewViewProvider`：插件注册到 IDE 的固定位置（TopBar/RightBar/Sidebar），由 IDE 框架控制何时创建和显示

### 核心实现

```typescript
// 1. 注册表（Main Process）
interface ViewContainerRegistry {
  topBar: ViewContainerDescriptor[];
  rightBar: ViewContainerDescriptor[];
}

interface ViewContainerDescriptor {
  id: string;
  title: string;
  icon: string;
  extensionId: string;
  views: ViewDescriptor[];
}

// 2. 解析插件贡献点（Extension Host 启动时）
function parseContributions(extension: Extension): void {
  const containers = extension.packageJSON.contributes?.viewsContainers;
  if (containers?.topBar) {
    containers.topBar.forEach(container => {
      registry.topBar.push({
        ...container,
        extensionId: extension.id,
        views: getViewsForContainer(extension, container.id),
      });
    });
  }
  // rightBar 同理
}

// 3. 渲染进程动态布局（React 组件）
function TopBar() {
  const containers = useTopBarContainers();  // 从注册表读取
  return (
    <div className="top-bar">
      {containers.map(c => (
        <TopBarItem key={c.id} icon={c.icon} title={c.title}>
          <WebviewPanel extensionId={c.extensionId} viewId={c.views[0].id} />
        </TopBarItem>
      ))}
    </div>
  );
}
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 声明式 vs 命令式 | 声明式（package.json） | 和 VS Code 一致，插件不需要执行代码就能注册 UI |
| 插件 UI 渲染 | Webview（每个面板独立） | 隔离插件崩溃，不影响主 UI |
| 注册时机 | IDE 启动时解析 | 不需要等插件激活，UI 立即可见 |

---

## 需求 2：内置插件自动安装

> **本质**：IDE 安装时（首次启动），根据内置插件名单，通过 VS Code Marketplace API 从官方商店下载最新版 .vsix → 解压到 extensions 目录。插件本身发布在官方商店，IDE 只是预装了一份"必装名单"自动拉取。

### 问题

IDE 安装后需要一组"开箱即用"的插件（语法高亮、调试器、模板生成器等），但不想把插件打进安装包（增大包体 + 无法独立更新）。

### 方案设计

```
IDE 首次启动
  │
  ▼ 读取内置插件名单（bundled-extensions.json）
  │
  ▼ 对比本地已安装列表
  │  有缺失或版本过旧？
  │
  ▼ 从插件商店 API 拉取最新版本
  │  GET /api/extensions/{id}/latest
  │
  ▼ 下载 .vsix 文件（插件包）
  │
  ▼ 静默安装（解压到 extensions 目录）
  │
  ▼ 重新加载 Extension Host（激活新插件）
```

### 核心实现

```typescript
// bundled-extensions.json（内置插件名单，随 IDE 发布）
{
  "extensions": [
    { "id": "quickapp.language-support", "minVersion": "2.1.0" },
    { "id": "quickapp.debugger", "minVersion": "1.5.0" },
    { "id": "quickapp.template-generator", "minVersion": "1.0.0" },
    { "id": "quickapp.perf-analyzer", "minVersion": "1.2.0" }
  ]
}

// Main Process: 启动时检查并安装
class BundledExtensionManager {
  private manifest: BundledExtension[];
  private extensionDir: string;  // ~/.quickapp-ide/extensions/

  async ensureInstalled(): Promise<void> {
    this.manifest = JSON.parse(
      fs.readFileSync(path.join(app.getAppPath(), 'bundled-extensions.json'), 'utf-8')
    ).extensions;

    const installed = this.getInstalledExtensions();

    for (const ext of this.manifest) {
      const local = installed.find(e => e.id === ext.id);
      
      if (!local || semver.lt(local.version, ext.minVersion)) {
        // 缺失或版本过旧 → 从商店下载安装
        await this.installFromMarketplace(ext.id);
      }
    }
  }

  private async installFromMarketplace(extensionId: string): Promise<void> {
    // 1. 查询商店获取最新版本下载地址
    const metadata = await fetch(
      `${MARKETPLACE_API}/extensions/${extensionId}/latest`
    ).then(r => r.json());

    // 2. 下载 .vsix 文件
    const vsixPath = path.join(os.tmpdir(), `${extensionId}.vsix`);
    await downloadFile(metadata.downloadUrl, vsixPath);

    // 3. 解压到 extensions 目录（.vsix 本质是 zip）
    await extract(vsixPath, {
      dir: path.join(this.extensionDir, extensionId),
    });

    // 4. 清理临时文件
    fs.unlinkSync(vsixPath);

    console.log(`Installed bundled extension: ${extensionId}@${metadata.version}`);
  }

  private getInstalledExtensions(): { id: string; version: string }[] {
    // 扫描 extensions 目录，读取每个插件的 package.json
    return fs.readdirSync(this.extensionDir)
      .map(dir => {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(this.extensionDir, dir, 'package.json'), 'utf-8')
        );
        return { id: `${pkg.publisher}.${pkg.name}`, version: pkg.version };
      });
  }
}

// 在 app.whenReady() 中调用
app.whenReady().then(async () => {
  const bundledManager = new BundledExtensionManager();
  await bundledManager.ensureInstalled();  // 静默安装，不阻塞 UI
  createMainWindow();
});
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 名单存放 | 随 IDE 安装包分发（bundled-extensions.json） | IDE 版本和插件版本绑定，保证兼容性 |
| 安装时机 | 首次启动 + 每次启动检查更新 | 保证始终最新，但不阻塞 UI |
| 安装方式 | 静默（后台下载解压，不弹窗） | 用户无感知，开箱即用 |
| 失败处理 | 跳过失败的插件，下次启动重试 | 不影响 IDE 正常使用 |
| 版本策略 | minVersion 约束（只升不降） | 防止降级导致不兼容 |

### 面试话术

> "IDE 的内置插件我们没有打进安装包——那样包体太大且无法独立更新。方案是维护一个 bundled-extensions.json 名单，IDE 首次启动时从插件商店自动拉取最新版本静默安装。核心是版本对比 + 增量下载 + 解压到 extensions 目录。这样用户装完 IDE 就能直接用，同时插件可以独立迭代不用跟 IDE 一起发版。"
