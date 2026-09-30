## resume menu钩子
3.快应用 IDE（桌面端Electron应用）
为快应用开发者提供覆盖开发全链路的集成开发环境
- 基于VS Code（Electron）二次开发, 支持 macOS / Linux / Windows
- 覆盖项目创建 → 语法高亮 → 调试预览 → 构建编译(toolkit) → 打包发布
- 快应用检测评分框架: 基于自研依赖分析引擎(可扩展, 基于依赖图谱遍历器+访问器),包含静态扫描和动态监测
- 模拟器调试 / 真机调试（CDP 协议）

## 调试系统（前后端）
- docs/interview/BT/velaQuickapp/专项-核心部件/调试系统.md —— Vela 侧:QuickJS 无现成 inspector、DevTools 全域从零自研 CDP、debugger 注入断点方案。

- docs/interview/BT/hap/专项-核心部件/调试系统.md —— hap 侧:V8 inspector 白嫖 JS 域 + DOM/CSS 域自实现、WS 统一出口 + CDP 域分发器、断点注入实现细节。
## 评分框架+依赖分析引擎

## 冰山1：桌面开发：electron
## 冰山2: vscode二开