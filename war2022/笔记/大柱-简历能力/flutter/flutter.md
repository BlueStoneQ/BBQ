
## 原理
- https://juejin.cn/post/6915377977765134344
Flutter 则是在吸取了 RN 的教训之后，不再去做 Native 的映射，而是自己用 Skia 渲染引擎来绘制页面，而 Skia 就是前面说过的 Chrome 底层的二维图形库，它是 C/C++ 实现的，调用 CPU 或者 GPU 来完成绘制。所以说 Flutter 像个游戏引擎。

## 适用范围
1. Flutter 没办法完成 Native 所有的功能，比如调用摄像头等，所以需要我们开发插件，而插件开发的基础还是 Flutter 和 Native 之间进行通信。
## 对比 React Native
Flutter 官方暂时不支持热更新，RN 有成熟的 Code Push 方案
Flutter 放弃了 Web 生态，RN 拥有 Web 成熟的生态体系，工具链更加强大。
Flutter 将 Dart 代码 AOT 编译为本地代码，通信接近原生。RN 不仅需要多次序列化，不同线程之间还需要通过 Bridge 来通信，效率低下（RN新版架构不会再使用json的序列化）