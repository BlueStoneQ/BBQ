# QuickApp 框架学习顺序

## 学习顺序

```text
1. Vela Runtime 本质
   libuv + Yoga + LVGL + QuickApp Runtime

2. 三大核心系统
   Bridge + Render Pipeline + Event System

3. JS 与 C++ 边界
   QuickJS + Runtime ABI + State/Binding/Transaction

4. C++ 与 LVGL 边界
   Runtime Tree + Mount + Host Tree + Input

5. 联盟 Android 对照
   hapjs Runtime + Framework + JNI + Android Host

6. Toolkit
   DSL -> JS Bundle/Page IR -> RPK

7. 能力、插件、生态治理
   作为后续扩展能力
```

## 当前聚焦

```text
Vela Runtime
+ Bridge
+ Render Pipeline
+ Event System
+ Toolkit 输入输出
+ Android 联盟实现对照
```
