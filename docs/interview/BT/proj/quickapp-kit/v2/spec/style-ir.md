# Style IR Contract

## 1. 结论

**Style IR 把联盟样式编译成平台无关的规范化样式事实，由 C++ Core Resolve，Platform 不重新解析源样式。**

## 2. 结构

```json
{
  "templateId": "pages/Demo/index",
  "rules": [
    {
      "selector": ".title",
      "declarations": {
        "fontSize": 40,
        "color": "#000000"
      },
      "source": { "file": "index.ux", "line": 12 }
    }
  ]
}
```

## 3. 规则

- 保留规则顺序、选择器和来源位置。
- 单位在 IR 中规范化，具体像素换算由 Core/Surface 配置完成。
- 动态样式通过 Binding Target 表达。
- Platform 只消费 MountTransaction 中的最终样式和布局结果。

