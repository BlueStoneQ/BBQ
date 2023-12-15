# RN集成到android中
- https://reactnative.cn/docs/integration-with-existing-apps
1. android依赖配置
2. 启动原生模块的autolink
3. 权限配置
4. 代码集成
  - RN react index.js端
  - android容器端：
  ```java
  // 🟥最好构建一个extends了ReactRootView的中间父类，类似于Base之类的
  public class MyReactActivity extends Activity implements DefaultHardwareBackBtnHandler {
    // 核心组件 ReactRootView
    private ReactRootView mReactRootView;
    private ReactInstanceManager mReactInstanceManager;

    @override
    protected void onCreate(Bundle savedInstanceState) {
      super.onCreate(savedInstanceState);

      mReactRootView = new ReactRootView(this);
      // 获取RN-bundle-list
      List<ReactPackage> packages = new PackageList(getApplication()).getPakcages();

      mReactInstanceManager = ReactInstanceManager.builder()
        .setApplication(getApplication())
        .setCurrentActivity(this)
        .setBundleAssetName()
    }

    // 把一些 activity 的生命周期回调传递给ReactInstanceManager

    // 把后退按钮事件传递给 React Native

    // 允许 JavaScript 控制用户按下设备后退按钮时发生的情况（例如，执行导航时）。当 JavaScript 不处理后退按钮按下的情况时，将调用invokeDefaultOnBackPressed方法。默认情况下，这将完成你的Activity。

  }
  ```
    - 执行"Sync Project files with Gradle"操作