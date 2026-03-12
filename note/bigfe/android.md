# 结构
## 基础
- 四大组件：Activity、Service、BroadcastReceiver、ContentProvider
- Fragment 与 Activity 的关系
- 路由跳转：Intent
- view viewGroup
- 持久化：SharedPreferences、SQLite、Room、ContentProvider、File、网络存储
- 网络技术
- MVVM: ViewModel、LiveData、DataBinding, Jetpack
- 打包 发布 更新+
## 进阶
- AAR SO
- NDK
- 配置 Gradle
- KMMP：了解下即可
- 性能优化
## 高阶
- 跨端容器
- RN fluter MP-wraper
  - 多业务模块 热更新 容器层性能优化 


# 细分
## Activity + UI
- intent
- view model:保持状态，例如旋转后
 - 引入ViewModel依赖：lifecycle-extensions
 - 声明viewModel类: override 生命周期函数
 - 在activity中获取viewModel实例, 关联viewmodel与activity（两者生命周期同步，也就是说activity销毁，viewModel才会销毁）
 - viewModelProvider: 注册领用viewProvider的地方，当发生旋转之类的，通过viewModelProvider保证返回的是同一个viewModel
 - viewModel很像前端中的store，用于保存状态，会封装属性和对属性进行增删改查的方法
 - 用户体验至上，理论上，操作系统不会“杀死”带有可见activity的进程。如果真的出现这种情况，则说明设备出现了大故障（既然如此，用户应用被“杀死”的事已经不重要了）。
 但是，停止的activity被“杀死”是很正常的事，例如，用户按了主屏幕键，然后播放视频或玩起游戏。在这种情况下，你的应用进程可能会被销毁。
 - 在低内存状态下，Android会直接从内存清除整个应用进程，连带应用的所有activity。目前，Android还做不到只销毁单个activity。
 - 当操作系统销毁应用进程时，内存中的任何应用activity和ViewModel都会被清除。操作系统做起销毁的事毫不留情，不会去调用任何activity或ViewModel的生命周期回调函数。
 - 停止的activity会被标记为killable
 - extra数据：记得使用包名修饰extra数据信息，这样，可避免来自不同应用的extra间发生命名冲突。
 ```java
 private const val EXTRA_ANSWER_IS_TRUE =
        "com.bignerdranch.android.geoquiz.answer_is_true"
 ```
 - activity2回应activity1: Activity.startActivityForResult(Intent, Int)

- 保留实例状态
  - 只要在未结束使用的activity进入停止状态时（比如用户按了Home按钮，启动另一个应用时），操作系统都会调用Activity.onSaveInstanceState(Bundle)
  - Activity被暂存后，Activity对象将不再存在，但操作系统会将activity记录对象保存起来。这样，在需要恢复activity时，操作系统可以使用暂存的activity记录重新激活activity。
  - 当遇到进程消亡的场景，ViewModel就不好使了。这时候，该保留实例状态上场了。但保留实例状态也有其局限性。因为保留实例状态数据是要序列化到磁盘的，所以应避免用它保存任何大而复杂的对象。
  - lifecycle-viewmodel-savedstate这个新库，让ViewModel在进程消亡时也能保存状态数据
  - 保留实例状态和ViewModel都不是长期存储解决方案。如果应用需要长久存储数据，且完全不担心activity状态，那么请考虑使用持久化存储方案
  - 相比在ViewModel里硬编码，用数据库或Web服务器来保存题目数据应该更好

- 关于activity 和 activity栈
  - 在桌面启动器中点击GeoQuiz应用时，操作系统并没有启动应用，而只是启动了应用中的一个activity。确切地说，它启动了应用的launcher activity
  - activity.finish() // 当前activity出栈
  - ActivityManager维护着一个非特定应用独享的后退栈。所有应用的activity都共享该后退栈
## 调试
## SDK与兼容
- 如果minSdkVersion 和 compileSdkVersion 之间差距过大，那么，使用了高于minSDKVersion的特性，编译虽然能通过，但是在minSDKVersion的设备上运行时，就会出现异常
  - 实践：在AndroidManifest.xml中，为每个activity指定minSdkVersion
    - 为了确保应用能在旧设备上运行，应尽量避免使用高于compileSdkVersion的特性。如果必须使用，那么请考虑使用兼容库。
    - 或者 将高API级别代码置于检查Android设备版本的条件语句中
    - Jetpack库和AndroidX。除了提供新功能（比如ViewModel），Jetpack库还支持新功能向后兼容，尽量让新老设备保持一致的用户体验。即使不能完全解决，至少能做到让开发者少写一些API级别的条件判断代码。
    - Jetpack库还没有彻底解决兼容性问题。或者说，它并不拥有所有你想要的新功能。当然，Android团队目前做得还不错，一直全力在向Jetpack库中添加新API，但是你仍然会发现某些API不可用。如果不凑巧被你遇到了，那只好乖乖写点儿判断代码，等待Jetpack版本的新API加入了。
- 越早熟悉使用开发者文档越有利于开发。没人能记住Android SDK中的海量信息，更不要说定期发布的新版本系统了。因此，学会查阅SDK文档，不断学习新的知识尤显重要。
- Android开发者文档是优秀而丰富的信息来源。文档分为六大部分：平台、Android Studio、Google Play、Android Jetpack、参考文档和新闻。如果有机会，一定要仔细研读这些资料
## fragment
- 意义：灵活性：解绑acitivy 与 UI, 而是通过fragment来管理UI和viewModel, activity管理fragment
- 本质：一种控制器对象
- 实践1： 一个activity中通过多个fragment来控制多个视图，activity视图能预留位置供fragment视图插入
- 托管，activity在其视图层级里提供一个位置，用来放置fragment视图。fragment本身没有在屏幕上显示视图的能力。因此，只有将它的视图放置在activity的视图层级结构中，fragment视图才能显示在屏幕上。
- LayoutInflater：
把 XML 布局文件 转换成 真正的 View 对象，从而让 Fragment 拥有可显示的界面
- 为托管UI fragment，activity必须：
  - 在其布局中为fragment的视图安排位置：<FrameLayout/> 占位符
  - 管理fragment实例的生命周期。
- 部件：FragmentManager类
 - FragmentManager类具体管理的对象有fragment队列和fragment事务回退栈。它负责将fragment视图添加到activity的视图层级结构中
 - fragment事务被用来添加、移除、附加、分离或替换fragment队列中的fragment
 - activity的生命周期函数由操作系统负责调用，而fragment的生命周期函数由托管activity的FragmentManager负责调用
 - 托管activity的FragmentManager就会边接收操作系统的调用指令，边调用其他生命周期函数，让 fragment与activity保持步调一致。
 - 使用fragment的本意是封装关键部件以方便复用。这里所说的关键部件，是针对应用的整个屏幕来讲的。如果单屏就使用大量fragment，不仅应用代码充斥着fragment事务处理，模块的职责分工也会不清晰
 - 实践：
  - 经验表明，后期添加fragment就如同掉进泥坑：从一开始就使用fragment更容易，既不用返工，也不会出现厘不清哪个部分使用了哪种视图控制风格这种事了。
  - 对于稍复杂些的应用，不用多想，肯定要用fragment。这样既方便应用的未来扩展，也能让你获得足够多的开发体验。
- 单Acitivity + 多Fragment 架构：
  - 角色：activity负责管理fragment的生命周期，fragment负责管理UI
  - 占位符：
  - 总结：“单 Activity + 多 Fragment”已是 Google 官方主推的 UI 架构之一，配合 Navigation、ViewModel、Hilt 等 Jetpack 组件，能把导航、生命周期、依赖注入全部标准化。但项目团队需要统一栈管理规范、制定 Fragment 通信协议，并预留异常重建场景下的恢复方案，才能真正发挥它“高复用、低内存、易适配”的优势，否则容易陷入“回调地狱”和“重叠 Bug”的泥潭。
## 列表：RecyclerView
- 本质：一个视图容器，可以包含多个子视图，每个子视图都对应一个数据项。RecyclerView的子视图是通过Adapter来管理的，Adapter负责将数据映射到子视图上
- view - viewHolder(连接器) -> fragment <- adapter（连接器） - viewModel
- viewHolder：一个视图容器，用来展示数据项。RecyclerView会将ViewHolder添加到其子视图列表中，并使用它来展示数据项。ViewHolder的职责是展示数据项，而不是管理数据项
  - ViewHolder基类的一个名为itemView的属性就能引用列表项视图view了
  - 数据和视图的绑定工作都放在CrimeHolder里
  - 点击事件：在ViewHolder中定义一个方法onClick，用来处理点击事件(ViewHolder需要实现View.OnClickListener接口)
- Adapter：是一个控制器对象，其作为沟通的桥梁，从模型层获取数据，然后提供给RecyclerView显示。
- Adapter负责：
  - 创建必要的ViewHolder；
  - 绑定ViewHolder至模型层数据。
- RecyclerView负责：
  - 请Adapter创建ViewHolder；
  - 请Adapter绑定ViewHolder至具体的模型层数据。
## 布局layout
- ConstraintLayout：约束布局
 - 依赖：implementation ‘androidx.constraintlayout: constraintlayout: 1.1.3’。
 - 本质：约束布局是Android中的一种布局，它允许开发者通过设置视图之间的约束来定义视图的布局。与传统的线性布局和相对布局相比，约束布局更加灵活和强大，可以实现更复杂的布局效果。
 - 位置：想要在ConstraintLayout里布置视图，不用拖来拖去，给它们添加上约束就可以了
 - 大小：让部件自己决定（使用wrap_content）、手动调整、让部件充满约束布局
 - 使用Android Studio图形布局工具
  - 在部件树窗口中，右键单击根LinearLayout，然后选择Convert LinearLayout to ConstraintLayout菜单项
 - 优点：
  - 现在，没有嵌套布局，所有的部件都是ConstraintLayout的直接子部件。同样的布局，如果用LinearLayout，那只能互相嵌套了。之前说过，减少嵌套就能缩短布局绘制时间，大大提高应用的用户体验。
  - 凡是以layout_开头的属性都属于**布局参数**（layout parameter）：部件的布局参数是用来向其父部件做指示的，即用于告诉父布局如何安排自己
## 持久化
- 数据库：SQLite、Room
 - [Room总结笔记](https://juejin.cn/post/7571068689765564456)
 - 本质：ORM库
 - Room的后台数据库引擎是SQLite
 - 通过在Kotlin对象和SQLite数据库之间建立一个对象关系映射层，Room能让你轻松优雅地使用SQLite数据库。使用Room时，你不用了解或者关心如何使用SQLite
 - 部件：Room的注解：
  - @Entity：用于定义实体类，对应数据库中的一张表
  - @Dao：用于定义数据访问对象，用于定义对数据库进行增删改查的方法
  - @Database：用于定义数据库，用于定义数据库的版本和实体类
  - @ColumnInfo：用于定义实体类的字段，对应数据库表中的列
  - @PrimaryKey：用于定义实体类的主键，对应数据库表中的主键
  - @Ignore：用于忽略实体类的某个字段，不映射到数据库表中
 - 主线程：不允许访问数据库
- liveData：数据的观察者,数据持有类
  - 依赖：lifecycle-extensions
  - 生命周期感知组件
## 线程
- 线程是一个单一执行序列。单个线程中的代码会逐步执行。
 - 所有Android应用的运行都是从主线程开始的。然而，主线程并不是像线程那样的预定执行序列。相反，它处于一个无限循环的运行状态，等着用户或系统触发事件。一旦有事件触发，主线程便执行代码做出响应
 - Android不允许在主线程中执行耗时操作，否则会抛出异常。因此，耗时操作必须放在子线程中执行
  - 数据库访问如同致电分销商：相比其他任务，它更耗时。等待响应期间，UI毫无反应，这可能会导致应用无响应（application not responding，ANR）现象发生
 - 后台线程：处理耗时操作：
  - 给应用添加后台线程时，需要考虑以下两个重要原则。
    - 所有耗时任务都应该在后台线程上完成。这能够保证主线程有空处理UI相关的任务，以使UI及时响应用户操作。
    - UI只能在主线程上更新。试图从后台线程更新UI会让应用报错，因此，后台线程生成的UI更新数据都要确保发到主线程上执行。
## service
## broadcast
## contentProvider
## 国际化
## 网络 
- 请求 下载
## 动画
- 降低动画速率：过场动画一闪而过，快到可能看不出新旧变化。为了看出差异，可以调整设备来减慢其速度。打开设置应用，导航至开发者选项（System → Advanced → Developer options）。找到Transition animation scale设置项，将其值设置为Animation Scale 10x
### kotlin/java
- kotlin 与 java互相操作
## AAR
## NDK
- so jni c++/c
