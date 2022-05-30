<a name="i1QPk"></a>
# 待分类
1. 在 `npm` 的早期版本， `npm` 处理依赖的方式简单粗暴，以递归的形式，严格按照 `package.json` 结构以及子依赖包的 `package.json` 结构将依赖安装到他们各自的 `node_modules` 中。直到有子依赖包不在依赖其他模块。
1. 为了解决以上问题，`NPM` 在 `3.x` 版本做了一次较大更新。其将早期的嵌套结构改为扁平结构：
   1. 安装模块时，不管其是直接依赖还是子依赖的依赖，优先将其安装在 `node_modules` 根目录。
   1. 当安装到相同模块时，判断已安装的模块版本是否符合新模块的版本范围，如果符合则跳过，不符合则在当前模块（本身依赖这个版本不符合模块的模块，安装在自己的作用域内）的 `node_modules` 下安装该模块。
3. `package-lock.json` 的作用是锁定依赖结构，即只要你目录下有 `package-lock.json` 文件，那么你每次执行 `npm install` 后生成的 `node_modules` 目录结构一定是完全相同的。
3. 开发系统应用时，建议把 `package-lock.json` 文件提交到代码版本仓库，从而保证所有团队开发者以及 `CI` 环节可以在执行 `npm install` 时安装的依赖版本都是一致的。
3. 在开发一个 `npm`包 时，你的 `npm`包 是需要被其他仓库依赖的，由于上面我们讲到的扁平安装机制，如果你锁定了依赖包版本，你的依赖包就不能和其他依赖包共享同一 `semver` 范围内的依赖包，这样会造成不必要的冗余。所以我们不应该把`package-lock.json` 文件发布出去（ `npm` 默认也不会把 `package-lock.json` 文件发布出去）。
3. 在执行 `npm install` 或 `npm update`命令下载依赖后，除了将依赖包安装在`node_modules` 目录下外，还会在本地的缓存目录缓存一份。
3. 构建依赖树：依赖树可以当做一份记录，避免我们查找信息总是要遍历目录文件等。
3. 根据配置文件构建出依赖树，然后根据依赖树去真正地获取模块依赖。
3. 下载的包是压缩的，到达mudules中，是解压后的。
3. `yarn` 默认使用 `prefer-online` 模式，即优先使用网络数据，如果网络数据请求失败，再去请求缓存数据。
3. npm install流程图：

![image.png](https://cdn.nlark.com/yuque/0/2021/png/2338408/1614686844558-51c9ce8d-53fa-4431-ac51-6ad9bc4fdd99.png#height=267&id=f2gtN&margin=%5Bobject%20Object%5D&name=image.png&originHeight=387&originWidth=1080&originalType=binary&ratio=1&size=60491&status=done&style=none&width=744)

12. 当安装到相同模块时，判断已安装的模块版本是否符合新模块的版本范围，如果符合则跳过，不符合则在当前模块的 `node_modules` 下安装该模块。

![image.png](https://cdn.nlark.com/yuque/0/2021/png/2338408/1617283782591-dde197ef-ef5c-423c-9b65-f33c98960ec3.png#height=681&id=t0Xnu&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1362&originWidth=1288&originalType=binary&ratio=1&size=994139&status=done&style=none&width=644)<br />13. 为了解决 `npm install` 的不确定性问题，在 `npm 5.x` 版本新增了 `package-lock.json` 文件，而安装方式还沿用了 `npm 3.x` 的扁平化的方式。<br />`package-lock.json` 的作用是锁定依赖结构，即只要你目录下有 `package-lock.json` 文件，那么你每次执行 `npm install` 后生成的 `node_modules` 目录结构一定是完全相同的。

14. 开发系统应用时，建议把 `package-lock.json` 文件提交到代码版本仓库，从而保证所有团队开发者以及 `CI` 环节可以在执行 `npm install` 时安装的依赖版本都是一致的。
14. 在开发一个 `npm`包 时，你的 `npm`包 是需要被其他仓库依赖的，由于上面我们讲到的扁平安装机制，如果你锁定了依赖包版本，你的依赖包就不能和其他依赖包共享同一 `semver` 范围内的依赖包，这样会造成不必要的冗余。所以我们不应该把`package-lock.json` 文件发布出去（ `npm` 默认也不会把 `package-lock.json` 文件发布出去）。

<a name="gGBTi"></a>
# 参考

- [npm install原理](https://cloud.tencent.com/developer/article/1555982)

