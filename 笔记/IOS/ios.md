# 资料
- 【资深开发专家带你从0开始学iOS：iOS App 是什么？】 https://www.bilibili.com/video/BV1S8411j7AB/?share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

- .app
# 工程文件类型
## config文件： info.pist
- App基本信息
  - 应用名称 ： CFBundleDisplayName
  - 唯一ID : CFBundleIdentifier
  - App版本号 : CFBundleShortVersionString
  - 二进制可执行文件 : CFBundleExectable
    - 我们的项目代码最终通过工具链打包成二进制文件，输出到这里配置的文件中
    - 最终编译二进制文件是Mach O文件: 需要用MachOView之类的工具查看
  - 应用图标 : CFBundleIcons
  - 冷启动欢迎页面 : UILaunchStoryBoardName
- App权限声明
  - 蓝牙 相机 地理位置等
- App其他配置
  - 外部唤起的 App URL schema配置 ： CFBundleURLTypes
  - 配置App支持打开的文档类型 ： CFBundleDocumentTyps
## Mach-O Binaries
## Resources

# App启动
- 点击应用图标 
- 系统根据info.pist 
- Launch Screen启动进程 
  - 加载二进制 
  - 加载动态库
  - main 
- DidFinishLaunching
- BecomeActive

# 项目结构
- AppDelegate
  - 代理App运行期间的生命周期任务：例如：app启动完成 通过URL打开 进入后台模式
- SceneDelegate
  - 场景代理，用于在多窗口场景下的场景生命周期处理任务
- ViewController
  - 默认窗口的默认视图控制器
- Main.storyboadrd
  - 默认的用户界面文件，在这里可以通过Interface Builder设计页面
- Assets
  - 结构化存放图片资源文件
- LauchScreen
  - 用于构建App冷启动时的界面
- main.m
  - 入口函数，启动了整个app的runLoop

# 架构
- MVC

# 编译流水线
- pre-Build section
- Custom script before source compiling
- concurrent compile source to Mach-O Object： 源码编译成Mach-O Object文件
- Link Objects and libraries into main executable： object -> 二进制文件
- custom scripts after source compiled: 编译后的自定义阶段
- compiling Resources
- copy file & code sign: 文件拷贝 + 签名

# 系统框架库
- cocoa touch

# 动画
- 属性动画
  - 通过视图属性的变化进行动画操作
- 逐帧动画
  - 存储并绘制逐帧图形实现，常见于GIF
- 矢量动画
  - loading 氛围
## 动画实现
- UIView : 基本动画封装
- Core Animation : 是IOS动画更底层的实现 可以实现更复杂和效率更高的动画效果
- Lottie : 例如用Lottie将设计师的复杂动画转化为IOS上可以运行的动画效果

# 事件机制
- UIControlEvents
  - 可以添加TargetEvent的方式实现事件捕获
  - 可以对控件点击事件作更精准的区分：例如： TouchUp TouchDown
- TouchEvents
  - 点击事件更底层的原子能力，自定义View中可以通过TouchEvent自定义实现更复杂的点击操作
# 手势交互
- Gestures
  - UIKit提供用于识别点击 拖拽 长按等一系列常用手势的封装

# 网络通讯
- webkit ： 封装了 http https websocket
- NSURL / NSURLSession 发起网络请求
- CFNetworks ： 更底层的方法
# 数据存储
- 结构化数据存储
  - DB
    - CoreData
    - SQLite
    - FMDB
    - ...
  - K-V data
    - NSUserDefaults
    - NSUbiquitousKeyValueStore
    - Keychain
    - ...
  - Object Mapping
    - NSCoding
    - NSKeyedUnarchiver
    - ...
- IOS上各个app之间的文件都是用沙盒隔离存储的
## app文件
- Bundle Container : 无法通过代码修改这里的数据
  - MyApp.app
  - NSBundle
  + mainBundle
- Data Container
  - Document : 存储app相关的用户数据和文件
  - Library : 存放用户设置或缓存的数据
  - Temp ：存储可iCloud同步的数据
- iCloud Container

# 模块化
- 优点：
  - 代码共享
  - 架构分层
  - 编译提效
    - 部分模块拆分后以静态库或者动态库的形式提供，不需要从源码进行编译
  - 版本管理
    - 具备版本，方便切换不同模块版本，满足不同需求
# 包管理
- cocoapods
- swift package Manager
- carthage 相比于coco主要是去中心化
# 调试诊断
- 汇编结构中 有WARF的调试信息
- 工具：instruments
  - 诊断内存泄露
  - 查找cpu耗时任务
  - 分析电量消耗任务
  - 帧率卡顿检查
  - 分析网络传输问题

## 闪退日志：
- 发生闪退时系统会保存的信息：
  - 进程信息
    - 时间 机型 系统版本 CPU类型 主二进制地址
  - 基本异常信息
    - 错误码 错误类型 异常线程
  - 调用栈信息
  - 寄存器信息
  - 二进制列表
- 真机的闪退日志中没有WARD调试信息 ，需要通过工具符号化
  - xcode可以自动根据UUID对闪退日志进行符号化
  - 有些特殊情况例如闪退日志信息不全或者不合规则时，可以通过Symbolication或者atoi等工具手动进行符号化操作

# Swift & Swift UI
- ARKit & 3D
- 机器视觉 & 端智能

# 生态
- watch OS
- TV OS
- home
- 汽车

