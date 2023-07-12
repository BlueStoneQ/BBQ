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
## build
## build2lib: 构建lib库
## build2esm: 构建esm模块
## 
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
