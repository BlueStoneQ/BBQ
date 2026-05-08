# 设计稿还原自动化链路

## 流程

```
Figma MCP（读设计稿节点/样式/布局）
    → AI Agent（生成代码）
    → DevTools MCP（打开浏览器 → 截图 → 对比设计稿）
    → 发现差异 → AI 自动修复 → 再次验证
```

## Chrome DevTools MCP 提供的工具

navigate_page、take_screenshot、take_snapshot（DOM）、evaluate_script 等，让 AI 能"看到"渲染结果并自动修复。
