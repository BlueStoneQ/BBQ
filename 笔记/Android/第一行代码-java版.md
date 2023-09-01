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
## webview
- layout.xml
```xml
<WebView
    android:id="@+id/web_view"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
/>
```
- activity中使用webview:
```java
WebView webView = (WebView) findViewById(R.id.web_view);
// 设置webview一些属性：这里让webview支持js
webView.getSetting().setJavaScriptEnabled(true);
// 当需要从 一个网页跳转到另一个网页时， 我们希望日标网页仍然在当前WebView中显示，而不是打开系统浏览器
webView.setWebViewClient(new WebViewClient());
// 加载网址
webView.loadUrl('http://xxx.xxx.xx');
```
- 配置网络静态权限：AndroidManifest.xml
```xml
<uses-permission android: name="android.permission .INTERNET" /> </manifest>
```
## HTTP
- HttpURLConnection
    ```java
    // - 获取HtpURLConnection实例
    URL url = new URL("http://xxx.x.x");
    HtpURLConnection connection = (HtpURLConnection) url.openConnection();
    // - 设置：请求方法 链接超时 消息头等
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(8000);
    // - 获取返回的输入流：getInputstream()
    InputStream in = connection.getInputStream();
    // - 关闭连接
    connection.disconnect();
    ```
    - 一般在实践中 我们会用线程来发起网络耗时操作：
    ```java
    // 在activity中
    new Tread(new Runnable() {
        @Overload
        public void run() {
            HttpURLConnection connection = null;
            BufferedReader reader = null;
            try {
                // 网络请求, 拿到返回流InputStream in(见上)
                ...
                // 读取获取到的输入流
                reader = new BufferedReader(new InputStreamReader(in));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = read.readLine()) != null) {
                    response.append(line);
                }
                showResponse(response.toString());
            } catch(Exception e) {
                e.printStackTrace();
            } finally {
                if (reader != null) {
                    try {
                        reader.close();
                    } catch(Exception e) {
                        e.printStackTrace();
                    }
                }

                if (connection != null) {
                    connection.disconnect();
                }
            }
        }
    })

    ...

    // 在主线程总操作UI
    private void showResponse(final String response) {
        //  这 里 为 什 么 要 用 这 个 r u n On U i T h r e a d ( ) 方 法 呢 ? 这 是 因 为 Androi d 是不允许在子线程中进行UI 操作的，我们需要通过这个方法将线程切换到 主线程，然后 再更新UI 元素
        runUiThread(new Runnable()) {
            @Overload
            public void run() {
                // 在这里操作UI
                responseText.setText(response);
            }
        }
    }
    ```
    - 提交数据
    ```java
    connection.setRequestMethod("POST");
    DataOutputStream out = new DataOutputStream(connection.getOutputStream());
    out.writeBytes("username=admin&password=123456");
    ```
- OkHttp: 开源库, 首选
    - 添加依赖
    ```groovy
    dependencies {
        ...
        compile 'com.squareup.okhttp3:okhttp:3.4.1'
    }
    ```
        - 添加后构建，会自动下载2个库：OkHttp 和 Okio（前一个的基础）
    - 创建实例
    - get请求
        - 创建request对象
        - build()来设置方法
        - 创建Call对象， 发送请求
        - 处理response
    - post请求
        - 需要构建出一个requestBody对象来存放待提交的参数
## XML
- pull解析
    -  首 先 要 获 取 到 一个 XmLPulIParserFactory的实例，
    - 并借助这个实例得到XmLPul1Parser 对象，
    - 然后调用 XmLPulLParser 的set Input ()方法将服务器返回的XML数据设置进去就可以开姶解析
    - 解 析的过程也非常简单，通过getEventType()可以得到当前的解析事件，然后在 一个while循环 中不断地进行解析，
        - 如果当前的解析 事件不等于XmlPulParser.END_DOCUMENT，说明解析工 作 还 没 完成 ， 调 用 n e x t ( ) 方法 后 可 以 获取 下一 个解 析 事件
        - 在whi le 循环中，我们通过getName()方法得到当前节点的名字，如果发现节点名等于id name 或version ，就调用nex tTex t ( ) 方法来获取节点内具体的内容，每当解析完一个app 节点后 就将获取到的内容打印出来。 
```xml
<apps>
    <app>
        <id>1</id>
        <name>aa</name>
    </app>
    <app>
        <id>2</id>
        <name>bb</name>
    </app>
</apps>
```
```java
try {
    XmlPullParserFactory factory = XmlPullParserFactory.newInstance();
    XmlPullParser xmlPullParser = factory.newPullParser();
    // 开始解析
    xmlPullParser.setInput(new StringReader(xmlData));
    int eventType = xmlPullParser.getEventType();
    String id = "";
    String name = "";

    while (eventType != XmlPullParser.END_DOCUMENT) {
        String nodeName = XmlPullParser.getName();

        switch(eventType) {
            // 开始解析某个节点
            case XmlPullParser.START_TAG: {
                if ("id".equals(nodeName)) {
                    // 获得节点的具体内容
                    id = XmlPullParser.nextText();
                    break;
                }

                if ("name".equals(nodeName)) {
                    name = XmlPullParser.nextText();
                    break;
                }

                break;
            }
            // 解析完某个节点
            case XmlPullParser.END_TAG: {
                if ("app".equals(nodeName)) {
                    // 打印之类的
                    Log.d("id is" + id);
                    Log.d("name is" + name);
                }
                break;
            }
            default: break;
        }

        // next到下一个节点
        eventType = XmlPullParser.next();
    }
} catch(Exception e) {}
```
- SAX解析
    - 它的用法比Pull 解析要复杂一些，但在语义方面会更加清楚
    - 新建 一个类继承自DefaultHandler，并重写父类的5个方法
```java
// 定义SAX解析器
public class ContentHandler extends DefaultHandler {
    private String nodeName;
    private StringBuilder id;
    private StringBuilder name;

    @Overload
    public void startDocument() throws SAXException {
        id = new StringBuilder();
        name = new StringBuilder();
    }

    @Overload
    public void startElement(String uri, String localName, String qName, Attributes attributes) throws SAXException {
        // 记录当前节点名
        nodeName = localName;
    }

    @Overload
    public void characters(char[] ch, int start, int length) throws SAXException {
        // 根据当前的节点名判断將内容添加到哪 一个StringBuilder对象中
        if ("id".equals(nodeName)) {
            id.append(ch, start, length);
            return;
        }
        if ("name".equals(nodeName)) {
            name.append(ch, start, length);
            return;
        }
    }

    @Overload
    public void endElement(String uri, String localName, String qName) throws SAXException {
        if ("app".equals(localName)) {
            Log.d("id is" + id.toString().trim());
            // 最后要将StringBuilder清空掉
            id.setLength(0);
        }
    }

    @Overload
    public void endDocument() throws SAXException {
        super.endDocument();
    }
}

// 在Activity中调用MyHandler来解析xmlData
try {
    SAXParserFactory factory = SAXParserFactory.newInstance();
    XMLReader xmlReader = factory.newSAXParser().getXMLReader();
    ContentHandler handler = new ContentHandler();
    xmlReader.setContentHandler(handler);
    xmlReader.parse(new InputSource(new StringReader(xmlData)));
} catch(Exception e) {}
```
- DOM解析
## JSON
- 比起xML，JSON 的主要优势在于它的体积更小，在网络上传输的时候可以更省 流量。但缺点在于，它的语义性较差，看起来不如XML 直观
- JSONObject:
❓：嵌套递归型json如何解析：？
```java
try {
    JSONArray jsonArray = new JSONArray(jsonData);

    for (int i = 0; i < jsonArray.length(); i++) {
        JSONObject jsonObject = jsonArray.getJSONObject(i);
        String id = jsonObject.getString("id");
    }
} catch(Exception e) {}
```
- GSON ： 开源库，Google，更简单易用，
    - 可以将一个json-str直接映射成一个对象
    - 添加依赖:app/build.gradle
    ```groovy
    dependencies {
        ...
        compile 'com.google.code.gson:gson: 2.7'
    }
    ```
    ```java
    // 解析
    Gson gson = new Gson();
    App person = gson.fromJson(jsonData, App.class);
    // 解析json数组 借助TypeToken 将期望解析成 的数据类型传人到fromJson( ) 方法中
    list<App> people = gson.fromJson(jsonData, new TypeToken<List<App>>(){}.getType());

    // 定义App
    public class App {
        private String id; 
        private String name; 
        private String version; 

        public String getId() { return id; }
        public void setId (String id) { this.id = id; }
        public String getName () { return name; }
        public void setName (String name) { this.name = name; } 
    }

    // 使用Gson
    try {
        Gson gson = new Gson();
        List<App> applist = gson.fromJson(jsonData, new TypeToken<List<App>>(){}.getType());

        for (App app : appList) {
            Log.d("id is " + app.getId());
        }
    } catch() {}
    ```
## 网络编程最佳实践
- 通常情况下我们都应该将这些通用的网络操作提取到一个公共的类里，并提供一个静 态方法，当想要发起网络请求的时候，只需简单地调用 一下这个方法即可
- java回调机制：传入一个回调实例，实例上会挂载着定义的回调方法
- 使用基于 HttpURLConnection 的类 + java回调机制
- 使用基于 OkHttp + java回调机制
```java
// 方法1：基于HttpURLConnection
// 定义Http的工具类
public class HttpUtil {
    public static void sendHttpRequest(final String address, final HttpCallbackListener listener) {
        new Thread(run Runnable() {
            @Overload
            public void run() {
                HttpURLConnection connection = null;
                try {
                    URL url = new URL(address);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("GET");
                    InputStream in = connection.getInputStream();
                    BufferedReader reader = new BufferedReader(new InputStreamReader(in));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = read.readLine()) != null) {
                        response.append(line);
                    }

                    if (listener != null) {
                        // 调用成功回调
                        listener.onFinish(response.toString());
                    }
                } catch(Exception e) {
                    if (listener !== null) {
                        // 调用回调
                        listener.onError(e);
                    }
                } finally {
                    if(connection != null) {
                        connection.disconnect();
                    }
                }
            }
        }).start();
    }
}

// 定义回调方法挂载对象的接口，要实现这个接口，在2个方法中编写自己的回调逻辑
public interface HttpCallbackListener {
    void onFinish(String response);
    void onError(Exception e);
}

// 调用HttpUtil
HttpUtil.sendHttpRequest(address, new HttpCallbackListener () {
    @Overload
    public void onFinish (String response) {
        // 在 这 里根 据 返 回 内 容 执 行 具 体 的 逻 辑
    }
    @Override
    public void onError(Exception e) { 
        // 在这里对异常情況进行处理
    }
})

// 方法1: 基于OkHttp，自身有回调接口
public class HttpUtil {
    public static void sendOkHttpRequest(String address, okhttp3.Callback callBack) {
        OkHttpClient client = new OkHttpClient();
        Request request = new request.Builder()
            .url(address)
            .build();

        client.newCall(request).enqueue(callback);
    }
}

// 调用
HttpUtil.sendOkHttpRequest("http://www.baidu.com", new okhttp3.Callback() {
    @Override
    public void onResponse (Call call, Response response) throws IOException { 
        //得到服务器返回的具体内容
        String responseData = response.body().string();
    }

    @Override
    public void onFailure(Call call, IOException e) {
        //在这里对异常情况进行处理
    } 
};
```
- 不管是使用HttpURLConnection 还是OkHtp，最终的回调接又都还是在 子线程中运行的，因此我们不可以在这里执行任何的UI 操作，除非借助runOnUi Thread ( ) 方法 * 进行线程转换

# 基于位置的服务 LBS
## 申请百度地图
- 定位：
    - 基于GPS：精度高，只能室外使用，室内信号差？， 需要手机硬件支持
    - 基于网络： 利用手机附近的基站进行三角定位，精度一般，室内外都可以使用
        - 因为Google的服务不在国内，导致网络定位API失效
- 所以 一般实践用的是国内的一些第三方公司的SDK,例如百度地图 高德等：
- 申请APIKey
    - 申请百度开发账号
    - 提供打包程序签名的SHA1指纹：
        - 开发版SHA1
            - 默认用debug.keystore生成的指纹
            - 查看：右侧工具栏 - Gradle - 项目名 - :app - Tasks - android
                    - 双击 signingReport
        - 发布版SHA1
            - 创建：keytool -list -v -keystore <签名文件路径>
    - 申请到百度地图的API Key
- 依赖：
    - 下载百度 LBS的SDK: （开发包）
        - 基础地图SDK
        - 定位SDK
    - 解压开发包，libs目录下就是我们需要的：
        - jar 是java层需要的
        - so文件 是Native层需要的 
            - so文件 C/C++编写 用NDK编译出来的
    - 将依赖放到正确位置：
        - jar包：放在app/libs下
        - so文件：src/main 新建一个目录 jniLibs/  
    - gradle
        - gradle中有自动编译jar包到项目中的声明， 会将libs 日录下所有以jar 结尾的文件添加到当前项目的引用中
        ```groovy
        dependencies {
            compile fileTree(dir: 'lib', include: ['*.jar'])
        }
        ```
        - 但是 我们手动放的jar包 需要手动点击下顶部工具栏的 Sync按钮
            - 点击Sync 按钮之后，1ibs 目录下的jar 文件就会多出 一个向右的箭头，这就表示项目已经能 引 用 到 这 些 J a r 包 了
    - 配置SDK需要的权限
## 使用百度定位
- 确定自己的经纬度
## 使用百度地图
- 让地图显示出来
- layout.xml使用百度自定义的Map组件，需要加上完整包名
```xml
<com.baidu.mapapi.map.MapView
    android:id="@+id/bmapView"
    android:layout_width="match_parent"
    android:layoutheight="match parent"
    android:clickable="true" />
```


# 多媒体
## app运行在手机上
- 手机侧：
    - 设置 - 开发者选项 - 勾选：USB调试
    - 开发者选项入口：关于手机 - 最下面版本号：连续点击
- Android stidio:
## 使用通知
- 获取 NotificationManager 
- Builder构造器来创建Notification
    - API不稳定，我们这里使用support库提供的兼容API
- 设置Notification
- notify显示通知
```java
NotificationManager manager = (NotificationManager) getService(NOTIFICATION_SERVICE);
NOTIFICATION notification = new NotificationCompat.Builder()
    .setContentTitle("大标题")
    .setCOntentText("内容")
    .setWhen(System.currrentTimeMillis)
    .setSmallIcon(R.mipmp.small_icon)
    .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.mipmap.lar_icon))
    .setContentIntent(pi) // 增加点击的意图pi，例如增加点击事件, 定义见下面
    .setAutoCancel(true) // 取消通知-方法1: 通知自己取消自己
    .setSound(Uri.fromFile(new File("system/media/audio/ringtones.Luna.ogg"))) // 在通知的时候 播放一段音频
    .setVibrate(new long[] {0, 1000, 0, 1000}) // 通知的时候震动:静止 震动 静止 ... // 震动需要配置静态权限：VIBRATE
    .setStyle(new NotificationCompat.BigTextStyle().bigText("长文本")) // 允许构建富文本，可以显示长文本
    .setStyle(new NotificationCompat.BigPictureStyle().bigPicture(
        BItmapFactory.decodeRedource(getResources(), R.drawable.big_image)
    )) // 显示大图片
    .setPriority() // 设置优先级：5个常量
    .build();

int notitionId = 1;
manager.notify(notitionId, notification);
// 取消通知-方法2
manager.cancel(notitionId);

// 通过意图描述通知点击的事件：从一个活动调到另一个活动
Intent intent = new Intent(this, AnotherActivity.class);
PendingIntent pi = (PendingIntent) getActivity(this, 0, intent, 0);
```
- 通知栏：增加点击能力
- Intent Vs PendingIntent
    - PendingIntent 倾向于在某个合适的时机执行某个动作，也可以理解为延迟执行的Intent
    - 获取实例的静态方法
        - getActivity
        - getBroadcast
        - getService
## 调用摄像头
- 使用<ImageView>显示图片
- 使用File对象来存储拍下的照片
    - 应用关联目录 可以 避免申请SD卡读写权限
        -  具 体 的 路 径 是/ s d c a r d / A n d r o i d / d a t a / - p a c k a g e n a m e > / c a c h e
- 将File转化为Uri对象 
    - Uri.fromFile 
    - FileProvider.getUriForFile将File封装成一个封装过的Uri
        - 因为从Android 7.0 系统开始，直接使用本地真实路径的Uri 被认为是不安全的，会抛出 一 个 F i l e U r i E x p o s e d E x c e p t i o n 异 常 。 而 F i l e P r o v i d e r 则 是 一 种 特 殊 的 内 容 提 供 器 ， 它 使 用 了和 内 容提供器类似的机制来对数据进行保护
- Intent: 
    - 描述打开照相机：action: android.media.action.IMAGE_CAPTURE 
    - 照相结果输出到Uri指定的目录: putExtra
    - startActivityForResult() 启动活动
- 将拍的照片设置到ImangeView中显示出来
    - 因为startActivityForResult， 拍完后 返回结果会到 onActivityResult()中
```java
// 创建file对象 用于存储拍照后的图片， getExternalCacheDir 获取 应用关联缓存目录
File outputImage = new File(getExternalCacheDir(), "output_img.jpg");
try {
    if (outputImage.exists()) {
        outputImage.delete();
    }

    outputImage.createNewFile();
} catch(IOException e) {}
// File对象转为Uri
Uri imageUri;
if (Build.VERSION.SDK_INT >= 24) {
    imageUri = FileProvider.getUriForFile(
        MainActivity.this, 
        "com. example. cameraalbumtest.fileprovider",
        outputImage);
} else {
    imageUri = Uri.fromFile(outputImage);
}
// 关键：构建启动相机的Intent + 设置存储照片位置
Intent intent = new Intent("android.media.action.IMAGE_CAPTURE");
intent.putExtra(MediaStore.EXTRA_OUTPUT, imageUri);
// 启动相机程序
startActivityForResult(intent, TAKE_PHOTO);

// 拍照后:在onActivityResult中 将拍摄的结果显示出来
@Overload
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    switch (requestCode) {
        case TAKE_PHOTO:
            if (resultCode == RESULT_OK) {
                try {
                    // 将拍摄照片显示出来
                    Bitmap bitmap = BitmapFactory.decodeStream(getContentResolver().openInputStream(imageUri));
                    // 当然 这里为了突出核心 一般图片元素的获取我们可以放在onCreate中
                    ImageView picture = (ImageView) findViewById(R.id.picture);
                    picture.setImageBitmap(Bitmap);
                } catch(FileNotFoundException e) {}
            }
            break;
        default:
            break;
    }
}
```
## 调用相册
- 运行时权限申请：WRITE_EXTERNAL_STORAGE
- 打开相册：构建Intent + 发送Intent
- 选择图片后的回调
```java
// 运行时权限申请：WRITE_EXTERNAL_STORAGE
if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
    ActivityCompat.requestPermissions(MainActivity.this, new String[]{
        Manifest.permission, WRITE_EXTERNAL_STORAGE
    }, 1); // 最后一个参数是onRequestPermissionsResult中的入参：requestCode的值
    // 申请权限，用户点击允许/拒绝后，会触发onRequestPermissionsResult
} else {
    openAlbum();
}

private void openAlbum() {
    // 关键：打开相册：构建Intent + 发送Intent
    Intent intent = new Intent("android.intent.action.GET_CONTEN");
    intent.setType("image/*");
    startActivityForResult(intent, CHOOSE_PHOTO);
}

// 选择图片后的回调
@Overload
protected void onActivityResult(int requestCode, int resultCode, Intent data) {

}

// 申请权限，用户点击允许/拒绝后，会触发onRequestPermissionsResult
@Overload
protected void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
    // 如果申请成功 可以继而打开相册
}
```

## 播放多媒体文件
- 播放音频
    - 获取 MediaPlyer
    - 设置音源path: FilePath 不是 Uri 或者 Bitmap
    - 播放前准备
    - 播放
    - 暂停
    - 停止
    - 释放掉MediaPlyer相关资源
- 播放视频
    - 类似播放音频，获取 VideoView类(背后仍用的MediaPlayer对视频文件进行控制)
    - 设置播放视频文件的FilePath
    - 一般在onDestroy中需要释放掉VideoView占用的资源：suspend()
    - 缺点：不是万能的，支持格式 和 播放效率方面不足
    - 想要仅仅使用 videoView编写出一个功能很强大的播放器是不太现实的

# UI
## 程序界面
## 常用控件用法
- TextView
- Button
- EditText
- ImageView
- ProgressBar
- AlertDialog
- ProcessDialog
## 四种基本布局
## 自定义控件
- 所用的所有控件都是直接或间接继承自View 
- 引入布局
    - 新建组件自身的布局：UI xml
    - 在主要布局中引入这个组件的布局：
    ```xml
    <linearLayout>
        <include layout="@layout/title"/>
    </linearLayout>
    ```
- 创建自定义控件
    - 例如控件使用LinearLayout
    ```java
    public class TitleLayout extends LinearLayout {

        public TitleLayout(Context context, AttributeSet attr) {
            super(context, attrs);
            LayoutInflater.from(context).inflate(R.layout.title, this);
            // 自定义控件中的控件
            Button titleBack = (Button) findViewById(R.id.title_back);
            // 可以定义一些自定义控件的行为
        }
    }
    ```
## ListView 
- width + height: match_Parent : 占满屏幕
- 设置数据
    - ArrayAdapter
    - ListView.setAdapter(arrtAdpter)
- 设置item-view
    - 新建layout_item.xml
- 定义item对应的实体类
```java
public class Fruit {
    private String name;
    private Int imageId;

    public Fruit(String name, int imageId) {
        this.name = name;
        this.imageId = imageId;
    }

    public String getName() {
        return name;
    }

    public int getImageId() {
        return iamgeId;
    }
}
```
- 为ListView子项指定一个item自定义布局:
    - 该Layout是和Item子项：Fruit绑定在一起，Fruit作为Item设置到ListView中的
- 创建数据的自定义适配器
```java
public class FruitAdapter extends ArrayAdapter<Fruit> {
    private int resourceId;

    public FruitAdapter(Context context, int textViewResourceId, List<Fruit> objects) {
        super(context, textViewResourceId, objects);
        resourceId = textViewResourceId;
    }

    // 这个方法在每个子项被滚动到屏幕内的时候会被调用 
    @Overload
    public View getView(int position, View convertView, ViewGroup parent) {
        Fruit fruit = getItem(position); // 获取当前item实例
        // 加载item的layout.xml
        View view = LayoutInflater.from(getContext()).inflate(resourceId, parent, false);
        // 获得item.layout中的控件
        ImageView fruitImage = (ImageView) view.findViewById(R.id.fruit_image);
        TextView fruitName = (TextView) view.findViewById(R.id.fruit_name);
        // 将item的值映射到View上
        fruitTmage.setImagereSource(fruit.getImageId());
        fruitName.setText(fruit.getName());

        return view;

    }
}
```
- 引用该自定义item控件 + ListView
```java
FruitAdapter adapter = new FruitAdapter(MainActivity.this,
R. layout.fruit item, fruitlist);
ListView listView = (ListView) findViewById (R.id.list_view); listView.setAdapter (adapter);
```
- listView点击事件
- 提升ListView的运行效率[容易问]
    - 之所以说ListView 这个控件很难用，就是因为它有很多细节可以优化，其中运行效率就是很 重要的一点
    -  g e t V i e w ( )方 法 中 还 有 一 个 c o n v e r t V i e w 参 数 ， 这 个 参 数 用 于 将 之 前 加 载好的布局进行缓存，以便之后可以进行重用
## RecyclerView[更推荐]
    - ListView需要手动优化
    - ListView无法横向滚动
## 最佳实践
# Fragment
## 使用
- 面向一套代码适配：手机 和 平板：
- 为每个Fragment建立一个xml
- 建立：LeftFragment extends Fragment
    - 建议使用support-v4 库中的 android.support.v4.app.Fragment
    - 不需要在 build.gradle文件中添加support-v4 库的依赖，因为build.gradle文件中已经添加了appcompat-v7, 这个库会将support -v4库也一起引人
```java
public class LeftFragment extends Fragment {
    @Overload
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle saveInstanceState) {
        // 加载布局
        View view = inflater.inflate(R.layout.left_fragment, container, false);
        return view;
    }
}
```
- 静态引入fragment: layout.xml引入fragment
    - 需要通过android:name 属性来显式指明要添加的碎片类名，注意一定要 将类的包名也加上。
```xml
<fragment
    android:id="@+id/left_fragment"
    android:name="com.example.fragmenttest.LeftFragment""
/>
```
- 在活动中动态加载Fragment
    - 碎片真正的强大之处在于， 它可以在程序运行时动态地添加到活动当中。根据具体情况来动态地添加碎片，你就可以将程序 界面定制得更加多样化。
    - 创建待添加的碎片实例
    - 获取FragmentManager : 在活动中可通过 getSupportFragmentManager()
    - 开启一个事务：beginTransaction()
    - 向容器添加或者替换碎片：replace
    - 提交事务：commit
```java
// 例如在activity中点击某个按钮 然后替换一个碎片
FragmentManager fragmentManager = getSupportFragmentManager();
FragmentTransaction transaction = fragmentManager.beginTransaction();
transaction.replace(R.id.right_layout, fragment); //  params: 容 器 的 i d 和 待 添 加 的碎 片实例
transaction.commit(); 
```
- 在碎片中模拟返回栈
    - 在创建的是时候，将这个fragment加入到返回栈中
    - transaction.addToBackStack(null);
- 碎片与活动之间通信
    - 活动中调用碎片：
        - FragmentManager 提供了一个类似于 findviewById() 的方法，专门用于从布局文件中获取碎片的实例，代码如下所示:
        ```java
        RightFragment rightFragment = (RightFragment) getFragmentManager().findFragmentById (R.id.right_fragment);
        ```
    - 碎片中获取活动实例：
        - MainActivity activity= (MainActivity) getActivity() ;
        - 碎片中获取context: getActivity() // 获取到的活动本身就是context
- 碎片与碎片之间通信：
    - 碎片A - 获取：活动 - 得到：碎片B
## 生命周期：类似Activity
- 运行状态
- 暂停状态
- 停止状态
    - 用户不可见
    - 可能会被系统回收
- 销毁状态

- Fragment和Activity一般是绑定在一起的，Fragment一般是镶嵌在Activity中

- 回调
    - onAttach
    - onCreateView
    - onActivityCreated
    - onDestroView
    - onDetach
## 动态加载布局
- 根据分辨率 或者 屏幕大小 决定加载哪个布局
- 限定符：类似css中的媒体查询：
    - 目录命名上：
        - 单页模式:res/layout/xx.xml
            - 包含1个碎片
        - 多页模式:res/large-layout/xx.xml
            - 可以包含2个碎片
            - 那些屏幕被认为 是large 的设备就会自动加载layout-large 文件夹下的布局
    - 大小 限定符
    - 分辨率 限定符
    - 方向 限定符
- 最小宽度限定符
    - 最小宽度限定符允许我们对屏幕的宽度指定一个最小值(以dp 为单位)，然后以这个最小值 为临界点，屏幕宽度大于这个值的设备就加载 一个布局，屏幕宽度小于这个值的设备就加载另 一 个布局。
    - res/layout-sw600dp/xx.xml
        - 屏幕width > 600dp : res/layout-sw600dp/xx.xml
        - 屏幕width < 600dp : res/layout/xx.xml
# UI:materialDesign
## ToolBar
## 滑动菜单
## 悬浮按钮和可交互提示
## 卡片式布局
## 下拉刷新
## 可折叠式标题栏

# 发布到应用商店
## 生成正式签名的APK文件
- 使用android studio生成
    - 查看debug.keystore文件地址:
        - Android studio右侧工具栏的Gradle ›项目名一r app Tasks- randroid，双击signingReport,
    -  生成：
        - A n d r o i d S t u d i o 导 航 栏上的Build -GenerateSignedAPK
        -  C r e a t e n e w 按钮 ， 然 后 会 弹 出 一个新的对话框来让我们填写创建keystore 文件所必要的信息。
            - Validity那一栏填写的是keystore 文件的有效时长，单位是年， 一般建议 时问可以填得长一些，比如我填了30年。
        - app-release apk 就是带有正式签名的APK文件了
- 使用Gradle生成
    - 如果你想将Gradle 完全精通的话，这个难度就比较大了。Gradle 的用法极为丰富，想要完全掌握它的用法，其复杂程度并不亚于学习一门新的语言(Gradle 是使 用Groovy 语言编写的)。而Android 中主要只是使用Gradle 来构建项目而已，因此这里我们掌握 一 些它的基本用法就好了，重点还是要放在功能开发上面，不要本末倒置了
    - 。 A n d r o i d S t u d i o 项 目 的 根 目 录 下 有 一个 g r a d l e . p r o p e r t i e s 文 件 ， 它是专门用来配置全局键值对数据的
        - 目前keystore 文 件的所有信息都是以明文的形式直接配置在build.gradle中的 ，这样就不太安全。Android推荐的 做法是将这类敏感数据配置在 一个独立的文件里面，然后再在build.gtadle中通过键值去读取这些数据
        - 我 们只需要将 gradle,properties 文件保护好就行了，比如说将它从Git 版本控制中排除。这样 gradleproperties文件就只会保留在本地，从而也就不用担心keystore 文件的信息会泄漏了
    - 配置gradle: app/build.gradle，在release闭包下配置：
    ```groovy
    android {
        signingConfigs {
            config {
                storeFile file(":/Users/Administrator/Documents/guolin.jks") // 指定keyStore文件位置
                storePassword '1234567
                keyAlias 'guolindev'
                keyPassword '1234567'
            }
        }
    }
    ```
- 生成APK
    - Android Studio中内置了很多的Gradle Tasks，其中就包括了生成APK文件的Task。点击右侧 工 具栏的Gradle -项目名一:app--Tasks-sbuid
    - assembleDebug用于生成测试版的APK 文件，assembleRelease 用于生成正式版的APK 文 件 ， a s s e m b l e 用 于同 时 生 成 测 试 版 和 正 式 版 的 A P K 文 件 。 在 生 成 A P K 之 前 ， 先 要 双 击 c l e a n 这个Task来清理一下当前项目，然后双击assenbleRelease
    - apk-out: app/buildloutputs/apk
- 生成多渠道APK文件
    - 对不同的应用商店提供不同版本的需求：（一般没有这种需求）
    - app/build.gradle
    - 配置：productFlavors 在里面可以添加不同渠道的差异化配置
## 申请应用商店账号
## 发布app
- 针对未签名APK直接签名：
    - 点击下载应用按钮，先将加固后的APK 文件下载下来。接下来的工作就有点烦琐了，因为 A n d r o i d S t u d i o 中 并 没 有 提 供 对 一 个 未 签 名 的 A P K 直 接 进 行 签 名 的 功 能 ， 因 此 我们 只 能 通 过 最 原 始 的 方 式， 使 用 j a r s i g n e r 命 令 来 进 行 签 名 。
    在命令行界面按照以下格式输人签名命令:
    jarsigner - verbose - sigalg SHAlwithRSA -digestalg SHAl -keystore [keystore 文件路径〕 -storepass 〔keystore 文件密码〕〔待签名APK路径】〔keystore 文件别名】
    将 [ ] 中 的 描 述 替 换 成 k e y s t o r e 文 件 的 具 体 信 息 就 能 签 名 成 功 了 ，注 意 [ ] 符 号 是 不 需 要 的 。 接 着我们将 签名后的 APK 文件重新 上传就 可以 了。
## 嵌入广告以盈利
- 腾讯广告联盟（原广点通）
- 接入广告SDK
- 更新APK-version + 重新发布到app商店
    - app/build.gradle
```groovy
android {
    defaultConfig {
        versionCode 2
        versionName "1.1"
    }
}
```
# 1期高级技巧
## 全局获取Context
- Activity本身就是一个Context, 所以在Activity内本身就可以通过this访问到context
- 我们可以定制一个自己的Application来管理全局的状态信息
```java
public class MyApplication extends Application {
    private static Context context;

    @Overload
    public void onCreate() {
        context = getApplicationContext();
    }

    public static Context getContext() {
        return context;
    }
}
```
- 告诉系统当程序启动的时候，初始化MyApplication，而不是默认的Application
    - 在AndroidManifest.xml中指定即可:  在 指 定 My A p p l i c a t i o n 的 时 候 一 定 要 加 上 完 整 的 包 名 ， 不 然 系 统 将 无 法 找 到 这 个类。
```xml
<manifest>
    ...
    <application
        android: name="com. example.networktest.MyApplication"
    ></application>
</manifest>
```
- 这样，不论你在项目的任何地方使用context, 只要调用下MyApplication.getContext()
- 当时为了让LitePal可以正常工作，要求必须在 AndroidManifest.xml 中配置如下内容:
```xml
<application
    android: name="org. litepal.LitePalApplication">
</application>
```
其实道理也是一样的，因为经过这样的配置之后，LitePal就能在内部自动获取到context 了。
- 如果我们已经配置过了自己的Application 怎么办?这样 岂不是和LitePalApplicat ion 冲突了?没错，任何一个项目都只能配置一个Application,
    - 解决方案：LitePal 提供了很简单的解决方案，那就是在我们自己的Appl icat ion 中去调用 L i t e P a l 的 初 始 化 方 法 就 可 以 了， 如 下所 示 :
    - 在MyApplication.onCreate()中调用：LitePalApplication.initialize (context);
## 使用intent传递对象
- 启动活动 发送广播 启动服务，就是各个部件之间通信的时候使用的。
- intent传递非对象：
    - intent.putExtra("key1", "value1");
    - intent.getIntExtra("key1", "");
- intent传递对象：
    - Serializable方式：序列化  
        - 序列化的方法也很简单，只需要让一个类去 实 现 s e r i a l i z a b l e 这 个 接 又 就 可 以 了
        ```java
        // 定义
        public class Person implements Serializable {}

        // 使用
        Person person = new Person();

        ...
        // 设置
        Intent.putExtra("person_data", person);

        // 获取
        // 调用了getserial izabl eExtra()方法来狱取通过参数传递过来的序列化对象，接着再 将 它 向 下转 型 成 P e r s o n 对 象 
        Person person = (Person) getIntent().getserializableExtra("person_data");
        ```
    - Parcelable方式
        - 实现原理是将 一个完整的对象进行分解，而分解后的每一部分都是Intent 所支持的数据类型，这样也就实现传递对象的功能了
        - 实现Parcelable接口
            - 重写 describecontents(直接返回0)
            - 重写 writeToParcel
                - 调用Parcel.writeXxx()方法 将Persion中的字段一一写出
                    - wirteString()
                    - wirteInt()
            - 提供一个名为CREATOR的常量, 这里创建了 Parcelable. Creator 接又的 一个实现，并将泛型指定为Person
        ```java
        // 定义
        public class Person implements Parcelable {
            private String name;
            private Int age;

            ...

            @Overload
            public int describeContents() { return 0; }

            @Overload
            public void writeToParcel(Parcel dest, int flags) {
                dest.wrietString(name);
                dest.writeInt(age);
            }

            public static final Parcelable.Creator<Person> CREATOR = new Parcelable.Creator<Person>() {

                @Overload
                public Person createGromParcel(Person source) {
                    Person person = new Person();

                    person.name = source.readString();
                    person.age = source.readInt();

                    return person;
                }

                @Overload
                public Person[] newArray(int size) {
                    return new Person[size];
                }
            }
        }
        // 使用:设置
        Intent.putExtra("person_data", person);
        // 使用:获取
        Person person= (Person) getIntent().getParcelableExtra("person_data");
        ```
- 对比：
对比一下，Serializable的 方式较为简单，但由于会把整个对象进行序列化，因此效率会比Parcelable 方式低 一些，所以在 通 常 情 况 下 还 是 更 加 推 荐 使 用 P a r c e l a b l e 的 方 式 来实 现 I n t e n t 传 递 对 象 的 功 能 。
    
## 定制自己日志工具
- 开发一个日志对象，对象根据level属性来打印日志:
```java
public class LogUtil {
    public static final int VERBOSE = 1;
    public static final int WARN = 4;
    public static final int NOTHING = 6; // 不打印任何日志

    public static int level = VERBOSE; // 这里值其实可以从配置常量中读取 在不同的环境中 读取不同的配置

    public Static void v(String tag, String msg) {
        if (level <= VERBOSE) {
            Log.v(tag, msg);
        }
    }

    public Static void w(String tag, String msg) {
        if (level <= WARN) {
            Log.v(tag, msg);
        }
    }
}
```
## 调试app
- 在当前进程中 使用Android顶部工具栏的 Attachdebugger toAndroidprocess按钮：
## 创建定时任务
- Java Timer类
    -  T i m e r 有 一 个 明显的短板，它并不太适用于那些需要长期在后台运行的定时任务
    - 手机休眠状态，CPU长时间不操作会进入睡眠状态， Timer 中的定时任务无法正常运行
    Timer 中的定时任务无法正常运行
- Android Alerm机制
    - Alarrn 则具有唤醒 CPU的功能，它可以保证在大多数情况下需要执行定时任务的时候CPU都能正常工作
    - 唤醒CPU和唤醒屏幕完全不是 一个概念
    - 范式：
        - getsystemService(Context.ALARM_SERVICE) => AlarmManager
            - set:
                - 模式
                - 时间
                - pendingIntent: 启动服务或者广播
                    - 来源：getService / getBroadcast
    ```java
    // 建立一个每隔1h就会执行一次的任务：服务
    public class LongRunningService extends Service {
        @Overload
        public IBinder onBind(Intent intent) { return null; }

        @Overload
        public void onStartCommand(Intent intent, int flags, int startId) {
            new Thread(new Runnable() {
                @Overload
                public void run() {
                    // 需要每隔1h就执行具体任务
                }
            }).start();

            // 启动定时任务：1h后再次启动该服务
            // 获取AlarmManager
            AlarmManager manager = (AlarmManager) getSystemService(ALARM_SERVICE);
            // 计算定时时间
            int h = 60 * 60 * 1000;
            long triggerAtTime = SystemClock.elapsedRealtime() + h; // 从开机时间到现在的时间（现在） + 1h = 从现在起一个小时后
            // 设置Intent: 从当前任务 跳到 下一个当前任务，是同一个任务
            Intent i = new Intent(this, LongRunningService.class);
            PendingIntent pi = PendingIntent.getService(this, 0, i, 0);
            // 设置定时器
            manager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtTime, pi);
            // Service固定范式：调用Service.onStartCommand
            return super.onStartCommand(intent, flags, startId);
        }
    }
    // 启动该服务
    Intent intent = new Intent(context, LongRunningService.class);
    context.startService(intent);
    ```
- 如果你要求Alarm任务的执行时间必须淮确无误，Android 仍然提供了解决方案。 使用AlarmManager 的setExact ()方法来替代set ()方法，就基本上可以保证任务能够准时 执行了。
    - 从Andr oid 4. 4 系统开始，Alar m任务的触发时间将会变得不准确，有可 能会延迟 一段时问后任务才能得到执行。这并不是个bug，而是系统在耗电性方面进行的优化。 系 统 会 自 动 检 测 目 前 有 多 少 A l a r m 任 务 存 在 ，然 后 将 触 发 时 间 相 近 的 几 个 任 务 放 在 一 起 执 行 ， 这 就可以大幅度地滅少CPU被唤醒的次数，从而有效延长电池的使用时间
- Doze模式
    - Android 6.0以上
    - 在Doze模块下， A l a r m 任 务 将 会 在 下次 退 出 D o z e 模 式 的 时 候 执 行， 也就是Alarm会不准时
    -  如 果 你 真 的 有 非 常 特 殊 的 需 求 ，要 求 A l a r m 任 务 即 使 在 D o z e 模 式 下也 必 须 正 常 执 行 ， Android还是提供了解决方案。调用AlarmManager 的setAndAl lowwhileIdle()或setExact-
    A n d A l l o w w h i l e I d l e ( ) 方 法 就 能 让 定 时 任 务 即 使 在 D o z e 模 式 下也 能 正 常 执 行 了，这 两 个 方 法 之 间的区别和set () 、setExact ()方法之间的区别是一样的。
## 多窗口模式编程
- 多窗口声明周期
- 关闭多窗口模式
## lambda表达式
- java8 新特性
- L a m b d a 表 达 式 却最低兼容到Android2.3系统，基本上可以算是覆盖所有的Android 手机了
- 本质上是一种匿名方法，它既没有方法名，也即没有访问修饰符和返回值类 型，使用它来编写代码将 会更加简洁，也更加易读
- 配置：app/build.gradle
```groovy
android {
    defaultConfig {
        jackOptions.enable = true
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}
```
// me: 很像箭头函数
```java
// 开启一个线程
new Tread(() -> {
    // 处理逻辑
}).start();
// 凡是这种只有一个待实现方法的接又，都可以使用Lambda 表达式的写法
// eg: 开启子线程 、 设置点击事件
button.setOnClickListener(v -> {});
```
# 容器专题：webview
# 容器专题：RN: RectView

# 进阶技巧
## 组件化
## 模块化
## 依赖管理：引用和发布