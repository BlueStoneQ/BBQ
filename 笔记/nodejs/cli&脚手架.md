## 参考github仓库
- https://github.com/YvetteLau/Blog/tree/master/eos-cli
- https://github.com/wibetter/akfun/tree/master
- https://github.com/react-native-community/cli
## 方案1
- yeoman
  - yeo + 对应的模版generator: 可以创建对应的项目 
- plop
- Gnerator

## 方案2
1. 远程模版：容易进行模版升级,x模版升级和cli升级解耦
- download-git-repo：下载模版
    - git-clone: 也可以下载模版
- handlebars进行模版的关键字替换
- fs.write()
2. 本地模版

# 案例1: akfun
- https://github.com/wibetter/akfun/tree/master
- AKFun 是一个基于 Webpack 和 rollup 的前端多场景打包工具，支持多种技术栈：Vue技术栈、React技术栈、React&TS技术栈
## init
- 询问：创建的项目类型 以选择不同的项目模版: inquirer
- 下载项目模版npm包
```js
const loading = require('ora')('正在加载...')
loading.start()
require('git-clone')(gitUrl, targetDir, (err) => {
  if (err) {
    loading.fail('加载失败')
  } else {
    require('rimraf').sync()(path)
    loading.succeed('加载完成')
  }
})
```
## dev
- 开启dev-server
- 使用exxpress构建调试服务器：express + webpack-dev-middleware[webpack的express中间件] + webpack[core]
```js
// 使用 express 启动一个服务
const app = express();

// 获取开发环境的webpack基本配置
const webpackConfig = getDevWebpackConfig(config);

const compiler = webpack(webpackConfig); // 启动 webpack 进行编译

  // 启动 webpack-dev-middleware，将编译后的文件暂存到内存中
const devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  stats: true
});

// serve webpack bundle output
app.use(devMiddleware);

// 启动 webpack-hot-middleware，也就是我们常说的 Hot-reload
const hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: false,
  heartbeat: 2000
});

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware);

// 处理proxy: 把请求代理转发到其他服务器, 好比一些请求是业务请求，我们可以将业务请求的api的特征配置到 config.dev.proxyTable
// 在调试中 相关请求会从本地localhost被转发到业务服务器
const { createProxyMiddleware } = require('http-proxy-middleware');
const proxyTable = config.dev.proxyTable;
if (proxyTable && JSON.stringify(proxyTable) !== '{}') {
  // 将 proxyTable 中的请求配置挂在到启动的 express 服务上
  // proxy api requests
  Object.keys(proxyTable).forEach((context) => {
    let options = proxyTable[context];
    if (typeof options === 'string') {
      options = { target: options };
    }
    app.use(context, createProxyMiddleware(options));
  });
}

// https://blog.csdn.net/astonishqft/article/details/82762354
// 使用 connect-history-api-fallback 匹配资源，如果不匹配就可以重定向到指定地址: 可以用来代替engix处理SPA-router刷新带来的无效路由问题
// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')());
```
## build
- 检查版本：配置的版本都要做一遍检查
```js
// 版本配置
const verConfig = [{
  name: 'node',
  curVer: process.version(),
  requireVer: '16.0.0'
}]
// 利用semver遍历检查， 有问题可以通过console输出到stdout
```
- 读取配置：使用webpack-merge来合并输入配置 + 当前默认配置: 
- 删除旧dist, 重新构建
```js
require('rimraf')(distPath, err => {
  if (err) throw err;
  webpack(webpackConfig, (err, stats) => {
      if (err) throw err;

      process.stdout.write(
        `${stats.toString({
          colors: true,
          modules: false,
          children: false,
          chunks: false,
          chunkModules: false
        })}\n\n`
      );

      if (stats.hasError()) {
        console.log('构建失败')
        process.exit(1)
      }

      console.log('构建完成')
  })
})
```
## build2lib: 构建lib库
- lib库，使用webpack构建，仅仅是构建配置和常规项目构建不同
- 配置中：比较偏重的是：压缩打包
## build2esm: 构建esm模块
- 构建esm模块，使用rollup 拥有更完备的tree-shaking, 缺点不支持**按需加载**。
- ⭕️webpack：的tree-shaking的缺陷：对于导入的第三方库（但是没有被使用）， 不会被判定为dead-code, 不会被shaking掉
- config-merge策略：优先级: 命令行参数 > 配置文件config > 内置默认config
- webpack.externals: 防止将某些 import 的包(package)打包到 bundle 中，而是在运行时(runtime)再去从外部获取这些扩展依赖(external dependencies)
```js
// deep-mergeconfig
// 构建
const bundle = await rollup.rollup({
  input,
  plugins
})
// 构建结果写入
bundle.write(output)
```
# 案例2: ark-cli
## init
- 检查cli更新
  - 获得当前线上最新的 cli 的最新version
  ```js
  const latestversion = exec('npm info ${pkgName} version');
  ```
  - 比对当前本地的package.json.version, 如果版本小于线上版本 则对用户在stdOut中进行提示
  ```js
  if (semver.lt(pkg.version, latestVersion)) {
    console.log('请升级到xxx版本')
  }
  ```
- init动作
  - 下载模版
  ```js
  // 确定outputDir：默认下载到tmp下
  const tempDir = os.temdir()
  // 下载 模版(npm包)
  require('download-package-tarball')({
    url: `https://registry.npmjs.org/${packgeName}/-/${packgeName}-${latestVersion}.tgz`,
    dir: tempDir
  })
  // copy到outputDir
  require('fs-extra').copy(
    path.resolve(tempDir, pkgName),
    targetPath || process.cwd(),
    { owerwrite: true }
  )
  // 根据命令行参数 模版替换[项目名等]
  const template = fs.readSync(path.resolve(targetPath, pkgName))
  require('handlebars').compile(template, {
    projName: ops.pkgName
  })
  fs.writeSync(path.resolve(targetPath, pkgName), {
    { owerwrite: true }
  })
  ```
## dev
- 职能：启动本地开发模式
- 检查cli更新
- dev: 
  - 初始化插件系统，生成诺插件实例
  ```js
  cliContext.pluginDriver = PluginDriver.getSingleInstance()
  ```
  - 监听文件变动 -> 触发：build
  ```js
  chokidar.watch(targetDir)
    .on('change', lodash.debounce(onFileChange))
    .on('add', onFileChange)
  
  const onFileChange = (changeFilePath) => {
    build(path.join(process.cwd(), changeFilePath))
  }
  ```
  - 启动本地dev-server
  ```js
  startServer(cliContext)
  // 定义
  const startServer = (cliContext) => {
    // 在cliContext上挂载router 插件可以通过router来注册自己的api
    cliContext.router = router;
    // 触发 puginDriver.beforeRouteRegister, 并给插件列表中每个插件通过参数注入 cliContext对象 
    await  cliContext.pluginDriver.runHooks('deforeRouteRegister', { cliContext })
    
    koaApp.use(cors()) // 通过ark的域名到本地的localhost 需要cors设置
  }
  ```
# 案例3: @react-native-community/cli
