# Runtime Value Contract

## 目录

- [结论](#结论)

## 结论

跨 JS/C++/Platform 的值只允许 JSON 可表达且可确定复制的 Runtime Value；不允许 `undefined`、NaN、Infinity、BigInt、函数、Symbol、循环引用或平台对象。

```text
RuntimeValue = null | boolean | finite number | UTF-8 string
             | RuntimeValue[] | { string: RuntimeValue }
```

整数必须位于 JavaScript safe integer 范围。缺失字段表示“未提供”，`null` 表示“显式空值”，二者语义不同。对象键使用 UTF-8 string；消息进入跨层队列前完成深拷贝或不可变所有权转移。
