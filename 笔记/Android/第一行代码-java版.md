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

# 广播Boradcast
## 类型
- 标准广播
- 有序广播：类似pipeLine
## 系统广播
- 动态接收
- 静态注册接收
    - eg: 开机启动
    - IDE: 右击com.example.broadcasttest 包-I ew-rOther BroadcastReceiver
    - 定义boradcast
    - 在AndroidManifest.xml中配置
        - < a p p l i c a t i o n > 标 签 内 出 现 了一 个 新 的 标 签 < r e c e i v e r > ， 所 有 静 态 的 广 播 接 收 器都是在这里进行注册的。它的用法其实和<act ivity>标签非常相似，也是通过android:name 来 指 定 具 体 注 册 哪 一个 广 播 接 收 器 ，而 e n a b l e d 和 e x p o r t e d 属 性 则 是 根 据 我 们 刚 才 勾 选 的 状 态 自动生成的。
## 自定义广播
- 发送
- 接收
## 本地广播
- 发送
- 接收
## 广播近况
- 今天了解了Android的静态注册和动态注册，Android在8.0以后，为了提高效率，删除了静态注册，防止关闭App后广播还在，造成内存泄漏。现在静态注册的广播需要指定包名，而动态注册就没有这个问题。并且，无论是静态注册广播还是动态注册广播，在接收广播的时候都不能拦截广播，否则会报错。
    - 谷歌官网的原文是：应用无法使用其清单注册大部分隐式广播。不过，是不能对大部分的广播进行注册，但还是有些广播可以进行静态注册的，比如对接收Android开机的广播通过静态注册还是能够正常接收的。

# 持久化
## 文件存储
- 简单的文本数据或者 二进制数据
- 写
    - FileOutputStream out = Context.openFileOutput(文件名, 文件操作模式)
        - Context.MODE_PRIVATE
        - Context.MODE_APPEND
    - BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(out))
    - writer.write('要写入的数据')
    - 查看数据是否已经保存到文件中：
        - Android Device Monitor:
            - Android Studio 导航栏 - Tools - Android - File Explorer - 找到 /data/data/包名/files -> 右键，导出到电脑上 打开查看
- 读
    - FileInputStream in = Context.openFileIutput(要读取的文件名)
    - BufferedReader reader = new BufferedReader(new inputStreamReader(in))
    ```java
    StringBuilder content = new StringBuilder();

    while ((line = reader.readLine()) !== null) {
        content.append(line)
    }
    ```
## SharedPreference
- 简单键值对
- SharedPreferences 文件是使用xML格式来对数据进行管理
- 创建SharedPreference
    1. Context 类中的getSharedPreferences()方法
        - 参数
            - preference文件名称
                - 指定的文件不存在，则会创建一个
                - 存放在：/data/data/<package.name>/shared_prefs/
            - 操作模式
                - 目前只有默认的操作模式：MODE_PRIVATE, 表示只有当前这个程序才能对这个SharedPreference进行读写
    2. Activity类中的getPreferences方法
        - 参数：操作模式
        - 因为使用该方法会自动将当前活动的类名作为sharedPreference的文件名
    3. PreferenceManager 类中的getDefaultSharedPreferences()方法
        - 静态方法
            - 接收 一个context 参数，并自动使用当前应用程序的包名作为前缀 来命名  SharedPreferences 文件
        - 获取Editor: 
            - preference = PreferenceManager.getDefaultSharedPreferences(context)
            - editor = preference.edit()
        - 添加数据: push
            - editor.pushBoolean()
            - editor.pushString()
        - 提交数据：editor.apply
```java
SharedPreferences.Editor editor = getSharedPreferences('data', MODE_PRIVATE).edit();

editor.putString ("name", "Tom");
editor.putInt ("age", 28);
editor.putBoolean ("married", false);

editor.apply ();
```
- 写
- 读
    -  每 种 g e t 方 法 都 对 应 了 S h a r e d - Preferences.Editor中的一种put方法
    - 这些get 方法都接收两个参数，第 一个参数是键， 传人存储数据时使用的键就可以得到相应的值了;第 二个参数是默认值，即表示当传人的键找不 到对应的值时会以什么样的默认值进行返回。
    - 不过这些get方法不是挂载在editor上的 而是直接挂载在preference上的
    - 索引preference凭的是存储preference的文件名
```java
SharedPreferences pref = getSharedPreferences('data', MODE_PRIVATE)

int age = pref.getInt("age", 0);
boolean married = pref.getBoolean("married", 0);
```

## SQLite、
- 复杂的关系型数据
- 创建数据库
    - SQLiteOpenHelper 帮助类，抽象类（必须创建一个自己的帮助类继承该抽象类）
    - 在自己的帮助类里必须重写：onCreate() 和 onUpgrade()，
        - 在里面分别实现创建和升级数据库的逻辑
    - 实例方法：
        - 这2个方法都可以创建或者打开一个现有数据库，并返回有一个可对数据库进行读写操作的对象
        - getReadableDatabase()
            - 当数据库补课写入的时候（如磁盘空间已满）
                - 返回的对象将以只读的方式打开DB
        - getWritableDatabase()
                - 则会出现异常
    - 构造方法 * 2：
        - 一般选用参数少一点的那个构造方法即可
        - 参数：
            - context
            - 数据库名
            - 自定义的cursor：一般传入null
            - 当前数据库版本号，用于对数据库升级操作
    - 构建出SQLiteOpenHelper 的实例之后， 再 调 用 它 的 g e t R e a d a b l e D a t a b a s e ( ) 或 g e t w r i t a b l e D a t a b a s e ( )方 法 就 能 够 创 建 数 据 库 了 ， 数据库文件会存放在/data/data/-packagename-/databases/ 目录下
    - 此时，重写的oncreat e()方法 也会得到执行，所以通常会在这里去处理 一些创建表的逻辑
    - 创建数据库：
        - 将创建表的SQL语句拼成一个字符串常量，然后在onCreate(数据库创建成功的hook)中调用SQLiteDatabase的execSQL()去执行该建表语句
- 检查数据库是否创建成功：adb shell
    - adb放在platform-tools下 命令行中使用，先要把这个工具配置到环境变量中
```shell
adb shell # 进入设备控制台
cd /data/data/com.example.databasetest/databases/
ls
# 这个目录下出现了两个数据库文件， 一个正是我们创建的BookStore.db，而另一个BookStore. db-journal 则是为了让数据库能够支持事务而产生的临时日志文件，通常情况下这个文件的大小 都是0字节。
sqlite3 数据库名 # 用sqlite命令 打开数据库
.table # 查看目前数据库中有哪些表
# 此时数据库中有两张表, android met adata 表是每个数据库中都会自动生成的， 不用管它，而另外 一张Book 表就是我们在MyDatabaseHfelper 中创建的了
.schema # 查看它们的建表语句
.exit # 或者 .quit退出数据库编辑
exit # 退出设备控制台
```
- SQLite: 数据类型：
    - integer
    - real 浮点
    - text
    - blob
- 升级数据库
    - onUpgrade()
    - 很重要，因为onCreate只在数据库创建成功的时候执行一次
    - 除非卸载掉app（此时原来的SQLite数据库也会被清除），再重新安装app，才会执行onCreate
    - 所以 我们在onUpgrade()中执行创建表的SQL语句
    - 触发onUpgrade执行：更新下数据库的版本号
```java
public class MainActivity extends AppCompatActivity {
    private MyDatabaseHelper dbHelper;
    @Override
    protected void onCreate (Bundle savedInstanceState) {
        s u p e r . o n C r e a t es a v e d I n s t a n c e S t a t e ) ;
        setContentView(R. layout.activitymain);
        // 在这里更新版本
        dbHelper = new MyDatabaseHelper(this, "BookStore.db", null, 2);
    }
```
- 调用SQLiteOpenHelper的getReadableDatabase()或getwri table- Database()，这两个方法还都会返回 一个 SQLiteDatabase对象，借助这个对象就可以对数据进行CRUD 操作 了
- 添加数据
    - insert(表名, 为空的列自动赋值NULL(一般用不到这个功能，直接传入null)，ContentValues对象 )
    ```java
    soLiteDatabase db = dbHelper.getWritableDatabase () ; ContentValues values = new ContentValues);
    // 开始组装 第一条数据
    values.put ("name" "The Da Vinci Code"); 
    values.put("author", "Dan Brown"); 
    values.put("pages", 454);
    values.put("price", 16.96);
    db.insert("Book", null, values);  // 插入第一条数据
    values.clear();
    // 开始组装第二条数据
    values.put("name", "The Lost Symboi"); 
    values.put ("author" "Dan Brown")
    values.put("pages", 510);
    values.put ("price", 19.95);
    db. insert(“Book", null, values); // 插入第二条数据
    ```
- 更新数据
    - update(表名, ContentValues对象, 3 4参数都是用来约束更新某一行或者几行中的数据，不指定就是默认更新所有行)
    ```java
    ContentValues values = new ContentValues();
    values.put("price", 10.99);
    db.update("Book", values, "name = ?", new String[] { "The bighead" });
    // 第三个参数对应SQL中的where部分，表示更新所有name = ?的行，？是一个占位符，第四个字符串数组为第三个参数中每个占位符指定相应的内容，因此上面语句是将 The bighead这本书的价格改成10.99
    ```
- 删除数据
    - delete(表名, 2 3参数，用来约束删除某一行或者某几行，不指定的话就是删除所有行)
    ```java
    SQLiteDatabase db = dbHelper.getWritableDatabase();
    // 仅删除那些页数超过500 页的书
    db.delete ("Book", "pages > ?", new String[] { "500" }); 
    ```
- 查询数据 
    - query() // 最短的一个重载参数有7个，其实就是把SQL查询语句用一个方法表示出来
    - 调用query()会返回一个Cursor对象，查询到的数据都将从这个对象中取出
    ```java
    SQLiteDatabase db = dbHelper.getWritableDatabase () ;
    // 查询Book 表中所有的数据
    Cursor cursor = db.query ("Book", null, null, null, null, null, null); if (cursor.moveToFirst()) {
        do{
            // 適历Cursor 对象，取出数据并打印
            String name = cursor.getstring(cursor.getColumnIndex("'name"));
            String author = cursor.getString(cursor.getColumnIndex
            ("author"));
            int pages = cursor.getInt (cursor.getColumnIndex("pages"));
            double price = cursor.getDouble(cursor.getColumnIndex ("price"));
        } while (cursor.moveToNext ());
    }

    cursor.close();
    ```
- 使用SQL操作DB(我的选择)：
    - 增删改
        - 增：db.execSQL("insert into Book (name, author, pages, price) values(?, ?, ?, ?)", new String[] { "The bighead", "dan", "454", "19.69" })
        - 删: db.execSQL("delete from Book where pages > ?", new String[] { "500" }) 
        - 改: db.execSQL("update Book set price = ? where name = ?", new String[] {"10.10", "The bighead"})
    - 查
        - db.rawQuery("select * from Book", null)
## 使用LitePal操作DB
- 开源库, andorid数据库框架，ORM
- 配置LitePal
    - 那么怎样才能在项目中使用开源库呢?过去的方式比较复杂，通常需要下载开源库的 Jar 包 或者源码，然后再集成到我们的项目当中。而现在就简单得多了，大多数的开源项目都会将版本 提交到jcenter 上，我们只需要在app/build.gradle 文件中声明该开源库的引用就可以了。
    ```Groovy
    // 编辑app/build.gradle
    dependencies {
        compile fileTree(dir: 'libs', include: ['*.jar'])
        compile 'com.android.support: appcompat-V7:23.2.0'
        testCompile 'junit:junit:4.12'
        compile 'org.litepal.android:core: 1.3.2'
    }
    ```
    - 创建litepal.xml
    ```xml
    <litepal>
        <dbname value= "BookStore" ></dbname>
        <version value="2" ></version>
        <list>
            <mapping class="com.example. l i t e p a l t e s t . Book"></mapping> 
            <mapping class="com.example. l i t e p a l t e s t . Category"></mapping>
        </list>
    </litepal>
    ```
    - 配置AndroidManifest.xml
    ```xml
    <application
        android: name="org. litepal.LitePalApplication"
    ></application>
    ```
- 创建和升级DB
    - 表的元操作：创建 删除 列的更改 增加 删除 都需要update db version
- 使用LitePal添加数据
- 使用LitePal更新数据
- 使用LitePal删除数据
- 使用LitePal查询数据
```java
List<Book> books = DataSupport.findAll (Book.class); for (Book book: books) {
    Log.d("MainActivity",, "bookname is " + book.getName()); 
    Log.d("MainActivity" "bookauthor i s " + book.getAuthor ( )); 
}

List<Book> books = Datasupport.select("name", "author", "pages")
                                .where("pages > ?", "400")
                                .order ("pages")
                                .limit (10)
                                .offset (10)
                                .find (Book.class);
// 这段代码就表示，查询Book表中第11~20 条满足页数大于400这个条件的name、author 和pages 这了列数据，并将查询结果按照页数升序排列。
```
# 内容提供器：跨程序共享数据
- 运行时权限
- 如果一个应用程序通过内容提供器对其数据提供了外部访问接又，那么任何其他的应用程序 就都可以对这部分数据进行访问
## 访问其他程序的数据（读取/操作）
- ContentResolver
- Context.getContextResolver()
- 操作不接受表名，接收一个内容URI
    - com.example.app.provider/table1
    - com.example.app.provider/table2
    - 解析URI字符串为URI对象：Uri uri = Uri.parse("com.example.app.provider/table1")
- 增 insert()
- 删 delete()
- 改 update()
- 查 query()
    - 查询结构还是Cursor
## 创建自己的内容提供器
- 内容提供器只是一个容器型的东西，而里面真正的数据提供者一般是：内存/文件/SharedPreference/SQLite等数据管理者
- 通过内容提供器，为当前应用的数据提供外部访问接口
- 新建一个类继承ContentProvider
    - ContentProvider 类中有6个抽象方法，我们在使用子类继承它的时候，需要将这6 个方法全 部重写
- uriMatcher
    - addURI: 建立某个URI和case码之间的映射关系
    - match: match(uri) => case码
- onCreate
- query => Cursor：保存和内存格式化记录被查到数据
- insert => Uri: 表示该新纪录的Uri
- update => int: 受影响的行数
- delete => int: 被删除的行数
    - 思路：先 获 取 到 S Q L i t e D a t a b a s e 的 实 例 ，然 后 根 据 传 人 的 U r i 参 数 判 断 出 用 户 想 要 删除哪张表里的数据，再调用SQLiteDatabase的delete()方法进行删除就好了，被删除的行数 将作为返回值返回。
- getType => String
    - 所有的内容提供器都必须 提供的一个方法，用于获取Uri 对象所对应的MIME类型。一个内容URI 所对应的MIME宇符 串主要由了部分组成，Android 对这了个部分做 了如下格式规定。
        - 必须以vnd 开头。
        - 如果内容URI以路径结尾，则后接android.cursor.di rl，
        - 如果内容URI以id结尾， 则后接android. cursor.item/。
        - 最后接上vnd.<sauthority>.<spath>
- URI:  
    - <content://<包名>/table1/<id>>
    - 通配符：
        - *:表示匹配任意长度的任意字符。 
        - #:表示匹配任意长度的数宇。
    - 所以， 一个能够匹配任意表的内容URI格式就可以写成:
        - content://com.example.app.provider/*
    - 而一个能够匹配table1 表中任意一行数据的内容URI 格式就可以写成: 
        - content://com.example.app.provider/table1/#
- AndroidMenifest.xml
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.databasetest">
    <application
        android:allowBackup="true" android:icon="Amipmap/iclauncher" android:label="@string/app_name" android: supportsRtl="true"
        android: theme="@style/AppTheme">
        <provider
        android: name=" .DatabaseProvider" android:authorities="com.example.databasetest.provider" android:enabled="true"
        android: exported="true">
        </provider> 
    </application>
</manifest>
```
- URI要使用，先用Uri.parse(URIString)解析成Uri对象
- ContentValues用来组织：键值对参数
- cursor用来访问和遍历查询到的数据

# 服务&线程
## 概览
    - 服务并不是运行在 一个独立的进程当中的，而是依赖于创建服务时所在 的应用程序进程。当某个应用程序进程被杀掉时，所有依赖于该进程的服务也会停止运行。
    - 也不要被服务的后台概念所迷惑， 实际 上服务并不会自动开启线程，所有的代码都是 默认运行在主线程当中的。也就是说，我们需要在服务的内部 手动创建子线程，并在这里执行具 体的任务，否则就有可能出现主线程被阻寨住的情记
## 多线程模型
    - 方式1：继承（耦合）
        - 定义：
            - 定义一个线程只需要新建一个类继承自Thread，然后重写父类的run() 方法，并在里面编写耗 时逻辑即可，例如网络请求
        - 启动线程
            - new MyThread().start();
    - 方式2: implements Runnable
        - 定义
        ```java
        class MyThread implements Runnable {
            Override
            public void run() {
                // 处理具体的逻辑 
            }
        }
        ```
        - 启动线程
        ```java
        MyThread myThread = new MyThread(); 
        new Thread (myThread).start();
        ```
    - 方式2-2: 匿名类
    ```java
    new Thread (new Runnable() {
        @Override
        public void run() {
            // 处理具𠇲的逻辑
        }
    }).start);
    ```
- 在子线程中更新UI
    - UI是线程不安全的，必须在主线程中更新
    - 异步消息机制，解决子线程中更新UI操作：
        - 子线程中: 只管通过Message将消息发给主线程中的消息接收器Handler
            - void handler.handleMessage(Message msg)
- 解析异步消息处理机制
    - Message
        - message.what
        - message.arg1 arg2 携带整形数据
        - message.obj 携带Object对象
    - Handler
        - 发送消息 handler.sendMessage()
        - 接收消息 handler.handleMessage()
    - MessageQueue
        - 存放所有通过handler发送的消息
    - Looper
        - 每个线程中的MessageQueue的管家，每个线程只有一个
        - Looper.loop 会无限循环, 轮询MessageQueue中有消息，就会取出，传递到handler.handleMessage()
- 使用AsyncTask
    - 异步消息机制的封装，提升易用度
    - AsyncTask是一个抽象类，3个泛型参数
```java
// 该class执行在主线程中
class DowloadTask extends AsyncTask<Void, Integer, Boolean> {
    @Overload
    protected void onPreExecute() {}

    @Overload
    protected Boolean doInBackground(Void... params) {
        // 执行在子线程
        try {
            // 底层：通过Message发送消息
            publishProgress("当前子线程要传递的信息")
        } catch(Exception e) {
            return false;
        }

        return true;
    }

    @Overload
    protected void onProgressUpdate(Integer... values) {
        // publishProgress 会触发，并通过参数接收传递过来的信息
    }

    @Overload
    protected void onPostExecute(Boolean result) {
        // 入参result是doInBackground的返回值，该class的第三个泛型约束该值类型
        // 后台任务执行结束 return后会执行
        // 我们可以利用返回的一些数据来做一些UI操作
    }
}

// 启动DowloadTask
new DowloadTask().execute()
```
## 服务基本用法
1. 定义一个服务
    - proj中定义：右击com.exmple.servicetest -> New -> Service -> Service
        - Exported 是否允许当前程序之外的程序访问该服务
        - Enable 是否启用该服务
    - 在AndroidMenifest.xml中注册该服务
```java
class MyService extends Service {
    public MyService() {}

    @Overload
    public IBinder onBind(Intent intent) {
        throw new UnsupportedOperationException('必须实现')
    }

    @Overload
    public void onCreate() {}

    // 服务每次启动时调用
    @Overload
    public int onStartCommand() {}

    @Overload
    public void onDestroy() {}
}
```
2. 启动和停止服务
- startservice()和stopservice()方法都是定义在context 类中的，所以我们在 活动里可以直接调用这两个方法
```java
// 启动
Intent startIntent = new Intent(this, Myservice.class);
startService(startIntent);
// startService会在Service还未创建的时候 同时触发onCreate(), 在Service创建后每次会触发onStartCommand
// 停止
Intent startIntent = new Intent(this, Myservice.class);
stopService(startIntent);
// 服务内部停止服务
// 在MyService中任何一个位置调用stopSelf()
```
3. 活动和服务通信
- onBind方法
    - 创建Binder实例 + 返回这个Binder实例给Activity
- Activity侧
    - ServiceConnection 匿名类
        - onServiceConnected
        - onServiceDisconnected
    - bindService
    - unbindService
```java
public class MainActivity extends AppCompatActivity implements View.OnClickListener {
    private Myservice.DownloadBinder downloadBinder;

    @Overload
    protected void onCreate() {
        // 绑定事件回调到btn上
    }

    private ServiceConnection connection = new ServiceConnection() {
        // 活动解除绑定
        @Overload
        public void onServiceDisconnected() {}

        // 活动成功绑定
        @Overload
        public void onServiceConnected(ComponentName name, IBinder service) {
            // 向下转型, 得到DownloadBinder实例, 我们在connecttion对象中通过Binder调用了Service的方法
            downloadBinder = (Myservice.DownloadBinder) service;
            downloadBinder.satrtDownload();
            downloadBinder.getProgress();
        }
    }

    @Overload
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.bind_service:
                    Intent bindIntent = new Intent(this, MyService.class);
                    bindService(bindIntent, connection, BIND_AUTO_CREATE); // 来自于Context
                    // BIND_AUTO_CREATE 表示在活动和服务进行鄉定后自动创建服务
                    break;
            case R.id.unbind_service:
                    unbindService(connection);
                    break;
            default: 
                break;
        }
    }
}
```
- service侧
```java
public class MyService extends Service {
    // 声明Binder实例为属性
    private DownloadBinder mBinder = new DownloadBinder();
    // 定义Binder对象
    class DownloadBinder extends Binder {
        public void startDownload() {}
        public int getProgress() {}
    }
    // 定义onBind方法 并返回Binder实例
    @Overload
    public IBinder onBind() {
        return mBinder;
    }
}
```
- eg驱动：
## 服务生命周期
- onCreate
    - 触发：service之前没有创建的时候, 
        - onStartService()
        - bindService() -> onBind()
- onStartCommand
    - 触发:
        - onStartService()
        - bindService() -> onBind()
- onBind
- onDestroy
    - 触发：已经启动的活动：
        - stopService
        - unbindService
        - Service内部：topSelf()
- 注意： 
    - 每个服务只存在一个实例
    - 对 一个 服 务 既 调 用 了 s t a r t s e r v i c e ( ) 方 法 ， 又 调 用 了 bindservice()方法的，这种情况下该如何才能让服务销毁掉呢?根据Android 系统的机制，一 个服务只要被启动或者被绑定了之后，就会一直处于运行状态，必须要让以上两种条件同时不满 足 ，服 务 才 能 被 销 毁 。所 以 ，这 种 情 况 下要 同 时 调 用 s t o p s e r v i c e ( )和 u n b i n d s e r v i c e ( ) 方法 ， o n De s t r o y ( ) 方法 才会 执行 。
## 前台服务
- 不会因为内存等被回收，会有一个正在运行的图标在系统的状态栏显示：例如网易云的播放服务
```java
public class Myservice extends Service {
    // ...
    @Overload
    public void onCreate() {
        super.onCreate();
        // 该intent记录activity和service之间的映射关系
        Intent intent = new Intent(this, MyActivity.class);
        // notification需要的intent
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, 0);
        Notification notification = new NotificationCompat.Builder(this)
            .setContentTitle('title')
            .etContentText("This is content text")
            .setWhen (System.currentTimeMillis ())
            .setLargeIcon (BitmapFactory. decodeResource (getResources (), R.mipmap.ic_launcher))
            .setContentIntent(pi) // 和对应的intent绑定

        // 启动一个前台服务，前台服务需要一个通知id 和 一个Notition对象
        startForeground(1, notification);
    }
}
```
## InentService: service和线程的结合
- 服务中的代码默认运行在主线程中，在主线程中处理耗时逻辑，容易引起ANR(APP not response)
- 最佳实践：在每个服务中开启一个子线程，在这里处理耗时逻辑
1. 不使用InentService：
```java
public class MyService extends Service {
    // ...

    @Overload
    public int onStartCommand(Intent intent, int flags, int startId) {
        new Thread(new Runable() {
            @Overload
            public void run() {
                // 处理具体逻辑

                stopSelf(); // 如果想服务在执行完逻辑后停止服务，可以在这里停止
            }
        }).start();

        return super.onStartCommand(intent, flags, startId);
    }
}
```
2. 使用IntentService
- 总会有 一些程序员忘记开启线程，或者忘记调用stopse1f() 方法。为了可以简单地创建一个异步的、会自动停止的服务，Android 专门提供了 一个 Intentservice 类(抽象类)
- 其实就是对以上service + 线程的一个封装：
```java
// 定义Service
public class MyIntentService extends IntentService {
    public MyIntentService() {
        super("MyIntentService");
    }

    @Overload
    protected void onHandleIntent(Intent intent) {
        // 这个方法执行在单独的线程中 该线程的管理由MyIntentService管理
        // 这个方法执行完 会关闭Service
    }

    @Overload
    public void onDestroy() {
        super.onDestroy();
    }
}

// 定义Activity
Intent intentService = new Intent(this, MyIntentService.class);
startService(intentService);
```
## eg: 完整下载示例[必须吃透这个proj:利用proj记忆技术点]

# 基于位置开发

# 网络&webview

# 进阶技巧
## 组件化
## 模块化
## 依赖管理：引用和发布

# 容器专题：webview
# 容器专题：RectView