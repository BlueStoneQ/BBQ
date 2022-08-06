## 资料
- [me:TS笔记](https://juejin.cn/post/7103091056891297805)
- [视频资料：尚硅谷](https://www.bilibili.com/video/BV1Xy4y1v7S2?p=2&spm_id_from=pageDriver&vd_source=9365026f6347e9c46f07d250d20b5787)

## overView
### TS优点
- TS支持类型
- TS支持js的新语法：例如class
- TS支持ES不具备的新特性：例如interface
- 丰富的配置选项
  - TS可以编译成各种版本的js
- 语法提示
### 开发环境配置
- TS的解析器用nodejs写的
1. 安装node
2. npm i -g typescript
3. npx xxx.ts

## 类型
### any unknow void nerver
- any 越过ts检查
- unknow是一个类型安全的any
- void：无返回值, 或者返回空（undefined）
- nerver：永远不会返回结果
```ts
function f (): nerver {
  throw new Error('xxx');
}
```
### any vs unknow
- 不指定变量类型 就会被ts认作any类型
- any可以赋值给任何类型
- unkonw不能赋值给其他已定类型的变量
  - 只能给自己赋值任何类型

### 连接符 & |
### 对象
1. 后来添加任意属性
```ts
let c: { name: string, age?: number, [propName: string]: any };
c = { name: '猪八戒', a: 1, b: 'xxx' };
```

## 编译选项
```
tsc --init 生成tcconifg文件
```
- include
- exclude
- compilerOptions: 
  - target: 'es5', // 指定ts被编译为ES的版本
  - module: 'es2015', // 指定被编译为的模块化标准 
  - lib: // 告诉TS在项目中使用到的库，会有语法提示等。一般不需要改，只有在非浏览器环境下需要用到某些依赖，可以设置。设置后可以有语法提示。例如在node中使用document.
  - outDir
  - outFile: './dist/app.js' // 会把所有代码合并为一个文件输出, 不怎么用，一般交给打包工具去做
  - allowJs: true/false, // 是否对js进行编译，一般给true
  - checkJs: true/false, // 是否对js进行实时检查，一般和allowJs保持一致
  - removeComments: true/false, // 是否移除注释
  - noEmit: false, // true: 不生成编译后的文件，仅仅是为了使用TS检查 不需要生成编译文件
  - noEmitOnError: true, // 当有错误的时候 不生产编译后的文件
  - strict: true, // 严格模式的总开关，建议为true, 以下的严格选项 都会开启
    - alwaysStrict: true, // 生成的代码使用”严格模式“ - 插入 ”use strict“
    - noImplicitAny: true // 不允许使用隐式的any，也就是未指定的类型的变量，ts编译器不会默认指定为any类型
    - noImplicitThis: true // 不允许不明确类型的this
    - strictNullChecks: true  // 严格的空值检查
    ```ts
    // strictNullChecks: true
    const box = document.getElementById('id');
    box.appendChild(); // 这里的box就可能会是null ts会提醒 我们可以用if判断下box非null之类的
    ```

