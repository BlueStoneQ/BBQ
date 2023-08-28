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
- 新建一个类继承ContentProvider
