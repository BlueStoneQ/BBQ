# 资料
- 《第一行代码java版》
- 【资深开发专家带你从0开始学Android：Android 开发基础知识】 https://www.bilibili.com/video/BV1t84y1z7ss/?p=13&share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

# 开发3要素
- activity
- layout 
- manifest

# 页面结构
- Status Bar
- Tool Bar
- Content View
- Navigation Bar

# 四大组件
- activity
- 服务
- 广播
- 线程

# 工具效率
## Android Studio
- Layout Inspect
- Profiler
- APK Analyzer
## ADB
- Android调试桥
- 访问内置的cli工具：
    - 使用shell指令调用Android内置的命令行工具，ps 截屏 录屏 启动应用 清除数据，可以借助这一系列能力轻松完成应用的黑盒自动化
    - 启动应用: adb shell am start -D -n {包名}/{Activity名}
    - 清除数据: adb shell pm clear {包名}
    - 查看进程: adb shell ps -ef
    - 查看手淘启动过程: adb logcat -b events | grep com.taobao.taobao
    - 截屏： 
        - adb shell screencap /data/local/tmp/test.png
        - adb shell /data/local/tmp/test.png
    - 录屏：
        - adb shell screenrecord /data/local/tmp/test.mp4
        - adb pull /data/local/tmp/test.mp4

- 强大的Logcat
    - 只用来看crash日志有些浪费
    - 超多的应用运维能力等待探索，比如Crash(java/naitve), event等信息
        - 查看应用声明周期: adb logcat -b events | grep {包名}
    - 查看手机上最近的crash命令： adb logcat -b crash
## prefetto
- 性能分析
    - App性能的度量与分析
        - java native 内存分配 启动性能 线程活动 程序锁 电量
    - 结构化高度可订制
        - 借助 ui.prefettor.dev（在线网站） 可视化界面 可以自由定制trace组件
- System Profiling
- App Tracing 
- trace Analysis

## 调试技巧
- Waiting for debugger
    - 小app调试
        - Debug app
        - attach debugger to android process
        - $ adb shell am start -D -n {包名}/{Activity名}
    - 大型app调试：分布式构建，无法debug app, 上千个模块，依赖关系复杂
        - 在进行进程启动那一刻进行attach, 把我们的调试器附加上去
- 条件断点
    - 怀疑某个参数有问题时 可添加条件断点再单步
- 异常断点

# UI
- 位置：res/layout/xxx.xml
- width & height: match_parent、til l_parent 和wrap_content
    - match_parent 和 f i l l _ p a r e n t 的 意 义 相 同 ， 现 在 官 方 更 加 推 荐 使 用 ma t c h _ p a r e n \
    - 除了使用上述值，你也可以对控件的宽和高指定 一个固定的 大小，但是这样做有时会在不同手机屏幕的适配方面出现问题。
- UI操作
    - GUI系统是单线程模型
    - 消息循环
# 线程模型
## 结构
- Thread
    - 不会主动销毁
- Looper
    - 轮询MessageQueue中的消息 与Thread一对一
- Handler
    - 负责消息的接收和发送：与Looper多对一
## 三步走
- new Thread
    - 启动work thread
- new Runnable().run()
    - 在worker thread里完成耗时操作
- runOnUiThread()
    - 抛回主线程刷新Ui
## 线程2不要
- 不要在主线程上做耗时操作
    - 耗时操作 放在IO线程上
- 不要在非主线程上访问UI组件
# 数据持久化
- SharedPreference
    - android可以结构化增删改成数据

# 广播
- 

# res
## layout
- xml
- android_layout_weight ： 这里竞然将Edit Text 和Button 的宽度都指定成了odp，这样文本编辑框和按钮还 能显示出来吗?不用担心，由于我们使用了android:layout_weight 属性，此时控件的宽度就 不 应 该 再 由 a n d r o i d : l a y o u t _ w i d t h 来 决 定 ， 这 里 指 定 成 o d p 是 一种 比 较 规 范 的 写 法 
## 布局
- linearLayout
- RelativeLayout
- FrameLayout
### value
### drawble
- 更多的时 候美工只会提供给我们 一份图片，这时你就把所有图片都放在**drawable-xxhdpi** 文件夾下就好了，
- 图片通常都是放在以“drawable” 开头的目录下的。 目前我们的项目中有一个空的drawable 目录，不过由于这个目录没有指定具体的分辨率，所以一 般不使用它来放置图片。这里我们在res目录下新建 一个drawable-xhdpi目录
### menu
- xml
# activity
- 另外需要注意，如果你的应用程序中没有声明任何一个活动作为主活动， 这个程序仍然是可以正常安装的，只是你无法在启动器中看到或者打开这个程序。这种程序一般 都是作为第三方服务供其他应用在内部进行调用的，如支付宝快捷支付服务
# 服务 & 线程
- 服务中的代码默认运行在主线程中,若处理耗时任务，则容易阻塞主线程
    - 此时: 使用多线程技术
## 服务分类
### 前台服务
- 前台服务和普通服务最大的区别就在于，它会一直有 一个正在运行的图标在系统的 状态栏显示，下拉状态栏后可以看到更加详细的信息，非常类似于通知的效果
- 服务的系统优先 级还是比较低的，当系统出现内存不足的情况时，就有可能会回收掉正在后台运行的服务。如果 你希望服务可以 一直保持运行状态，而不会由于系统内存不足的原因导致被回收，就可以考虑使使用前台服务
### 普通服务
## 子线程操作UI
- 方案1：子线程: message -> 主线程：Handler -> 操作UI
- 方案2：AsyncTask
    - 底层还是用的异步消息机制处理

## 网络请求
- 请求接口
- 返回值处理
- 资源释放
    - 避免造成资源泄露

## 一个下载案例的实现@最佳实现

# 新技术应用与探索
## Kotlin
- Coroutines : 协程，以同步的方式写异步代码
- Jetpack Compose ：声明式UI 看齐Swift UI 和 Flutter
    - UI控件：布局 代码文件放在一起
    - 自适应布局：折叠屏
- KMM ： Kotlin Multiplatform Mobile (Android/IOS) ： 跨平台
    - SDK
    - 逻辑复用，一套代码，基础设施共享
        - shard code + native code

# 设计范式
- BaseActivity
    - 例如我们希望每个activity或者页面都拥有某个能力，我们不可能在每个页面都去写一个，这个时候，我们可以在activity的继承链中加入一个节点：BaseActivity
```java
public class BaseActivity extends AppCompatActivity {
    // 在这里进行我们的一些公用能力的定义
}

// 而其他的activity都不直接继承自AppCompatActivity， 而是继承自BaseActivity
public class Activity1 extends BaseActivity {};
```
