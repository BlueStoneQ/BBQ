# 四大组件
- activity
- 服务
- 广播
- 线程

# UI
- 位置：res/layout/xxx.xml
- width & height: match_parent、til l_parent 和wrap_content
    - match_parent 和 f i l l _ p a r e n t 的 意 义 相 同 ， 现 在 官 方 更 加 推 荐 使 用 ma t c h _ p a r e n \
    - 除了使用上述值，你也可以对控件的宽和高指定 一个固定的 大小，但是这样做有时会在不同手机屏幕的适配方面出现问题。
# res
## layout
- xml
- android_layout_weight ： 这里竞然将Edit Text 和Button 的宽度都指定成了odp，这样文本编辑框和按钮还 能显示出来吗?不用担心，由于我们使用了android:layout_weight 属性，此时控件的宽度就 不 应 该 再 由 a n d r o i d : l a y o u t _ w i d t h 来 决 定 ， 这 里 指 定 成 o d p 是 一种 比 较 规 范 的 写 法 
### 布局
- 线性布局
    - 只有LinearLayout 支持使用 l ayout wei ght 属性来实现按比例指定控件大小的功能，其他两种布局都不支持
    - wrap:
        - <LinearLayout>
        - android:orientation="horizontal"
    - item:
        - android:layout_gravity="top"/center_vertical/bottom
        - android:layout_weight="1" // 类似flex: shrink
            - 此时 一般规范写法 会将 android:layout_weight="0dp"
- 相对布局
    - wrap:
        - <RelativeLayout>
    - item: 
        - 相对于parent: 
            - android:layout_alignParentleft、
            - android:layout_alignParentTop
            - android:layout_alignparentRight 
            - android: layout_ alignParentBottom
            - android:layout_centerInParent
        - 相对于其他元素：
            - android: l a y o u tabove="aid/button3"
            - a n d r o i d : l a y o u tt o L e f t o f = " @ i d / b u t t o n 3 "
            - android:id="@+id/button4"
            - android:layout width="wrap content"
            - android:layout_height="wrap_content"
            - android:layout below="@id/button3"
            - android:layout toLeftof="aid/button3"
            - android:layout_alignleft 表示让一个控件的左边缘和另一个控件的左边缘对齐, 
            - android:layout_alignRight表示让一 个控件的右边缘和另一个控件的右边缘对齐。
            - android:layout_alignTop
            - android: layou t_al ignBot tom
- 帧布局
    - FrameLayout 由于定位方式的欠缺，导致它的应用场景也比较少
    - wrap:
        - <FrameLayout></FrameLayout>
- 百分比布局
    - 我们可以不再使用wr ap_ con t en t、mat ch_ par en t 等方式来指定控件的大小，而是允许直接指 定控件在布局中所占的百分比，这样的话就可以轻松实现平分布局甚至是任意比例分割布局的 效果了。
    - 比较新，考虑兼容
    - 不同于前了种布局，百分比布局属于新增布局，那么怎么才能做到让新增布局在所有Android 版本上都能使用呢?为此，Android 团队将百分比布局定义在了support 库当中，我们只需要在项 目的build.gradle 中添加百分比布局库的依赖，就能保证百分比布局在Android 所有系统版本上的 兼容性 了。
    - 打开app/build.gradle 文件，在dependencies 闭包中添加奶下内容: 
    ```js
    dependencies {
        compile
        fileTree (dir: 'libs', include: ['*.jar']) 
        compile 'com.android. support: appcompat-v7:24.2.1' compile 'com.android. support: percent:24.2.1'  // 新增
        testCompile 'junit:junit:4.12'
    }
    ```
    - 需 要 注 意 的 是 ， 每 当 修 改 了任 何 g r a d l e 文 件 时 ， A n d r o i d S t u d i o 都 会 弹 出 一 个 如 图 3. 2 5 所 示的提示。
    - gradl e 文件自上次同步之后又发生 了变化，需要再次同步才能使项目正 常工作。这里只需要点击Sync Now 就可以了，然后gradle 会开始进行同步，把我们新添加的百 分比布局库引人到项目当中。
    - 最 外 层 我 们 使 用 了 P e r c e n t F r a m e L a y o u t ，由 于 百 分 比 布 局 并 不 是 内 置 在 系 统 S D K 当 中 的 ， 所 以 需 要 把 完 整 的 包 路 径 写 出 来 。 然 后 还 必 须 定 义一 个 a p p 的 命 名 空 间 ，这 样 才 能 使 用 百 分 比 布 局 的自定 义属性。
    ```xml
    <android.support.percent. PercentFrameLayout
        xmlns: android="http: //schemas.android.com/apk/res/android" 
        xmlns: app="http: //schemas.android.com/apk/res-auto" android: layoutwidth="matchparent"
        a n d r o i d : l a y o u th e i g h t = " m a t c hp a r e n t " >
    </a n d r o i d . s u p p o r t . p e r c e n t . P e r c e n t F r a me L a y o u t >
    ```
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

## 一个下载案例的实现@最佳实现