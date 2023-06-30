- [RN原理](https://www.jianshu.com/p/a54c0bffc4e5)
- [React Native原理之跨端通信机制](https://zhuanlan.zhihu.com/p/473710695)

## 通信
- JSCore 可以让 C++ 拿到 JS 运行环境的 global 对象并能操作它的属性，而 JS 代码会在 global 对象中注入一些原生模块需要的 API，这是 JS 向 C++ 提供操作 API 的主要方式。
- https://juejin.cn/post/6915377977765134344
  由于受到 Flutter 的冲击，RN 团体提出了新的架构来解决这些问题。为了解决 Bridge 通信的问题，RN 团队在 JavaScriptCore 之上抽象了一层 JSI（JavaScript Interface），允许底层更换成不同的 JavaScript 引擎。
  除此之外，JS 还可以拿到 C++ 的引用，这样就可以直接和 Native 通信，不需要反复序列化对象，也节省了 Bridge 通信的开支。
  这里解释一下，为啥拿到 C++ 引用就可以和 Native 通信。
    1. IOS: 由于 OC 本身就是 C 语言的扩展，所以可以直接调用 C/C++ 的方法。
    2. Android: Java 虽然不能 C 语言扩展，但它可以通过 JNI 来调用。
  JNI 就是 Java Native Interface，它是 JVM 提供的一套能够使运行在 JVM 上的 Java 代码调用 C++ 程序、以及被 C++ 程序调用的编程框架。