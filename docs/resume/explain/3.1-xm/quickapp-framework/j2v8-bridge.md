# J2V8 同步 Bridge（类 JSI）

J2V8 是 V8 引擎的 Java 绑定库。"同步 Bridge"指 JS 调用 Native 方法时，在同一个线程上同步执行，不需要跨线程消息传递。

```java
v8.registerJavaMethod(new JavaCallback() {
    public Object invoke(V8Object receiver, V8Array parameters) {
        // 这里是 Java 代码，但在 JS 线程上同步执行
        return nativeResult;
    }
}, "JsBridge");
```

JS 调用 `JsBridge.invoke()` → V8 通过 JNI 直接调用 Java 方法 → 同线程同步返回。和 RN 新架构的 JSI 是同一个思路。
