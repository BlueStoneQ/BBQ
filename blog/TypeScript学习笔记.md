
> 理念：
> 1. 先 把书读薄
> 1. 系统化的知识 最牢固
> 1. 摘录 总结 阅读后咀嚼/思考再写出啦
> 
前言：
> 1. TS针对的是编译期，主要是类型的检测等，本质就是通过结构化的类型定义来告知TS编译器如何检查该代码，不会影响运行时的真实代码；
>    1. 但是 TS也额外扩展了一些js的语法
> 2. TS的理念：严格优先
> 2. TS编写的核心职能：描述类型
> 
参考：
> 1. [TS入门教程](https://ts.xcatliu.com/introduction/what-is-typescript.html)
> 1. [TS进阶教程](https://jkchao.github.io/typescript-book-chinese/compiler/overview.html#%E6%96%87%E4%BB%B6%EF%BC%9Autilities)


<a name="whLjS"></a>
## OverView

1. 这是因为 **TypeScript 只会在编译时对类型进行静态检查，如果发现有错误，编译的时候就会报错**。而在运行时，与普通的 JavaScript 文件一样，不会对类型进行检查。
1. 这是因为 **TypeScript 编译的时候即使报错了，还是会生成编译结果**，我们仍然可以使用这个编译之后的文件。
   1. 如果要在报错的时候终止 js 文件的生成，可以在 `tsconfig.json` 中配置 `noEmitOnError` 即可
3. <br />
<a name="W6H2A"></a>
## 基础
<a name="equUf"></a>
### 不常见的基础类型
<a name="GpAH1"></a>
#### void

1. `void` 表示没有任何返回值的函数
1. 声明一个 `void` 类型的变量没有什么用，因为你只能将它赋值为 `undefined` 和 `null`
<a name="sRaBy"></a>
#### null undefined

1. 与 `void` 的区别是，`undefined` 和 `null` 是所有类型的子类型。也就是说 `undefined` 类型的变量，可以赋值给 `number` 类型的变量
1. 而 `void` 类型的变量不能赋值给 `number` 类型的变量
<a name="s8GUT"></a>
#### 任意值

1. 在任意值上访问任何属性都是允许的，也允许调用任何方法
1. **声明一个变量为任意值之后，对它的任何操作，返回的内容的类型都是任意值**
1. **变量如果在声明的时候，未指定其类型，那么它会被识别为任意值类型**
1. TypeScript 会在没有明确的指定类型的时候推测出一个类型，这就是类型推论
1. **如果定义的时候没有赋值，不管之后有没有赋值，都会被推断成 **`**any**`** 类型而完全不被类型检查**
<a name="wINyO"></a>
### 联合类型

1. 当 TypeScript 不确定一个联合类型的变量到底是哪个类型的时候，我们**只能访问此联合类型的所有类型里共有的属性或方法**
1. 访问 `string` 和 `number` 的共有属性是没问题的
```typescript
function getString(something: string | number): string {
	something.length // ts error: length在number类型不存在
  something.toString() // right
}
```
<a name="oPaJi"></a>
### interface

1. 接口一般首字母大写。[有的编程语言中会建议接口的名称加上 ](https://msdn.microsoft.com/en-us/library/8bc1fexb%28v=vs.71%29.aspx)`[I](https://msdn.microsoft.com/en-us/library/8bc1fexb%28v=vs.71%29.aspx)`[ 前缀](https://msdn.microsoft.com/en-us/library/8bc1fexb%28v=vs.71%29.aspx)
1. 变量属性一般要和接口定义保持一致，多，少 都是不可以的
1. 接口更灵活宽松的方案：可选属性，任意属性
1. 任意属性：
```typescript
interface Person {
    name: string;
    age?: number;
    [propName: string]: any;
}
let tom: Person = {
    name: 'Tom',
    gender: 'male'
};
```

5. **一旦定义了任意属性，那么确定属性和可选属性的类型都必须是它的类型的子集**
   1. **这句话也可以这样理解：已定义的属性也属于任意属性（其子集）**
```typescript
interface Person {
    name: string;
    age?: number;
    [propName: string]: string;
}
let tom: Person = {
    name: 'Tom',
    age: 25,
    gender: 'male'
};
```

6. 一个接口中只能定义**一个**任意属性。如果接口中有多个类型的属性，则可以在任意属性中使用联合类型
```typescript
interface Person {
    name: string;
    age?: number;
    [propName: string]: string | number;
}
let tom: Person = {
    name: 'Tom',
    age: 25,
    gender: 'male'
};
```

7. **只读的约束存在于第一次给对象赋值的时候，而不是第一次给只读属性赋值的时候**
```typescript
interface Person {
    readonly id: number;
    name: string;
    age?: number;
    [propName: string]: any;
}
let tom: Person = {
    name: 'Tom',
    gender: 'male'
  // error 在对 tom 进行赋值的时候，没有给 id 赋值
};
tom.id = 89757; // error 在给 tom.id 赋值的时候，由于它是只读属性，所以报错了
```

8. 接口是一个类型，不是一个真正的值，它在编译结果中会被删除，当然就无法使用 `instanceof` 来做运行时判断了：
<a name="aG8tF"></a>
### 常见的数组类型

1. 表示法
   1. 类型 + 方括号
   1. 数组泛型 Array<number>
   1. 接口表示数组（不推荐，接口常用来描述**类数组**）
```typescript
interface NumberArray {
    [index: number]: number;
}
let fibonacci: NumberArray = [1, 1, 2, 3, 5];
```

2. any在数组中的应用：
```typescript
let list: any[] = ['xcatliu', 25, { website: 'http://xcatliu.com' }];
```

3. 类数组
   1. 一般不用接口描述数组，但是常用来描述**类数组**（不是数组类型）
      1. 例如函数中的arguments:
```typescript
interface IArguments {
    [index: number]: any;
    length: number;
    callee: Function;
}
```
<a name="VSP3Y"></a>
### 函数
<a name="FmjRi"></a>
#### 声明式定义函数
```typescript
function sum(x: number, y: number): number {
    return x + y;
}
```
<a name="PeaSp"></a>
#### 表达式定义函数
```typescript
let mySum: (x: number, y: number) => number // 这里是对变量mySum的类型定义，一般需要和右侧的函数定义保持一致，注意：这里的=>不是ES6中的=>
= function (x: number, y: number): number { // 这里的类型描述 是对右侧函数定义的描述
    return x + y;
};
```
<a name="7qAXh"></a>
#### 接口定义函数形状
```typescript
interface SearchFunc {
    (source: string, subString: string): boolean;
}
let mySearch: SearchFunc;
mySearch = function(source: string, subString: string): boolean {
    return source.search(subString) !== -1;
}
// 表达式形式的函数类型需要给=左右两端都进行定义：
	// 等号右侧的类型定义是右侧匿名函数的类型定义
	// 等号左侧是对具名函数（该匿名函数赋值给的对象）的类型定义

let mySum: (x: number, y: number) => number = function (x: number, y: number): number {
    return x + y;
};
// ts中的=> 和  es6中的 => 不是一个
```
<a name="y7ab7"></a>
#### 可选参数

1. 可选参数必须接在必需参数后面。换句话说，**可选参数后面不允许再出现必需参数了**

参数默认值

1. 有默认值的参数识别为可选参数
1. 此时，不受**可选参数必须在必须参数的后面**的限制
<a name="RD1MC"></a>
#### 剩余参数
```typescript
function push(array: any[], ...items: any[]) {
  // items实质上是一个数组，可以用数组的类型定义它
    items.forEach(function(item) {
        array.push(item);
    });
}
```

<a name="yIpHX"></a>
#### 重载

1. 概念：重载允许一个函数接受不同数量或类型的参数时，作出不同的处理
1. 用处：
```typescript
/**
eg: 我们需要实现一个函数 reverse，输入数字 123 的时候，输出反转的数字 321，输入字符串 'hello' 的时候，输出反转的字符串 'olleh'。
*/
function reverse(x: number | string): number | string {
    if (typeof x === 'number') {
        return Number(x.toString().split('').reverse().join(''));
    } else if (typeof x === 'string') {
        return x.split('').reverse().join('');
    }
}
/**
问题：然而上面这种写法有一个缺点，就是不能够精确的表达，输入为数字的时候，输出也应该为数字，输入为字符串的时候，输出也应该为字符串
所以 我们需要借助重载 实现多个定义，如下
*/
function reverse(x: number): number;
function reverse(x: string): string;
function reverse(x: number | string): number | string {
    if (typeof x === 'number') {
        return Number(x.toString().split('').reverse().join(''));
    } else if (typeof x === 'string') {
        return x.split('').reverse().join('');
    }
}
/**
注意：TypeScript 会优先从最前面的函数定义开始匹配，所以多个函数定义如果有包含关系，需要优先把精确的定义写在前面
*/
```

<a name="ZqGLl"></a>
### 类型断言的用途
<a name="g7L9o"></a>
#### 语法

1. 值 as 类型（推荐，tsx中只能使用这种语法）
1. <类型>值
<a name="NybLe"></a>
#### 用途

1. 将一个联合类型断言为其中一种类型
   1. 因为联合类型只能访问其各个子类型共有的属性或方法，利用类型断言 可以指定访问其中一种类型的属性或者方法
```typescript
interface Cat {
    name: string;
    run(): void;
}
interface Fish {
    name: string;
    swim(): void;
}
function isFish(animal: Cat | Fish) {
  // 指定访问Fish的属性
    if (typeof (animal as Fish).swim === 'function') {
        return true;
    }
    return false;
}
```
b. 类型断言只能够「欺骗」TypeScript 编译器，无法避免运行时的错误，反而滥用类型断言可能会导致运行时错误 <br />c. 总之，使用类型断言时一定要格外小心，尽量避免断言后调用方法或引用深层属性，以减少不必要的运行时错误。

2. 将一个父类断言为更加具体的子类
```typescript
interface ApiError extends Error {
    code: number;
}
interface HttpError extends Error {
    statusCode: number;
}
function isApiError(error: Error) {
    if (typeof (error as ApiError).code === 'number') {
        return true;
    }
    return false;
}
```

3. 将任何一个类型断言为any
```
window.foo = 1; // error
(window as any).foo = 1 // right
```

4. 将any断言为一个具体的类型
   1. 背景：在日常的开发中，我们不可避免的需要处理 `any` 类型的变量，它们可能是由于第三方库未能定义好自己的类型，也有可能是历史遗留的或其他人编写的烂代码，还可能是受到 TypeScript 类型系统的限制而无法精确定义类型的场景。 
   1. 遇到 `any` 类型的变量时，我们可以选择无视它，任由它滋生更多的 `any`。
   1. 我们也可以选择改进它，通过类型断言及时的把 `any` 断言为精确的类型，亡羊补牢，使我们的代码向着高可维护性的目标发展。
```typescript
function getCacheData(key: string): any {
    return (window as any).cache[key];
}
/**
那么我们在使用它时，最好能够将调用了它之后的返回值断言成一个精确的类型，这样就方便了后续的操作
*/
interface Cat {
    name: string;
    run(): void;
}

const tom = getCacheData('tom') as Cat;
tom.run();

```

<a name="HMzTg"></a>
#### 类型断言 vs 类型转换

1. 类型断言会在编译结果中被删除，所以不会影响运行时的真实类型
<a name="CAkGb"></a>
#### 类型断言 vs 类型声明

1. 类型声明更严格，优先使用类型声明
```typescript
const tom = getCacheData('tom') as Cat;
// 等价于
const tom: Cat = getCacheData('tom');
```
<a name="NW72p"></a>
#### 类型断言 vs 泛型
```typescript
// 利用把返回值从any断言为精确类型
function getCacheData(key: string): any {
    return (window as any).cache[key];
}
interface Cat {
    name: string;
    run(): void;
}
const tom = get

// 利用泛型解决(推荐)
function getCacheData<T>(key: string): T {
    return (window as any).cache[key];
}

interface Cat {
    name: string;
    run(): void;
}

const tom = getCacheData<Cat>('tom');
tom.run();
```
<a name="GzNVa"></a>
#### 其他

1. 其实类型断言利用的就是调用者比定义者更清楚某个定义？？
1. 另外，类型断言，只是用来帮助通过TS语法静态检查的一种手段，不要妄想对运行时有帮助，运行时我们还是需要通过类型判断，特性嗅探等来进行防御性处理；
1. 任何类型都可以被断言为any, any也可以被断言为任何类型
1. 将一个变量断言为 `any` 可以说是解决 TypeScript 中类型问题的最后一个手段 , 因为**它极有可能掩盖了真正的类型错误，所以如果不是非常确定，就不要使用 **`**as any  **``**<br />`
1. 总之，**一方面不能滥用 **`**as any**`**，另一方面也不要完全否定它的作用，我们需要在类型的严格性和开发的便利性之间掌握平衡**（这也是 [TypeScript 的设计理念](https://github.com/Microsoft/TypeScript/wiki/TypeScript-Design-Goals)之一），才能发挥出 TypeScript 最大的价值。
1. 要使得 `A` 能够被断言为 `B`，只需要 `A` 兼容 `B` 或 `B` 兼容 `A` 即可 
```typescript
interface Animal {
    name: string;
}
interface Cat {
    name: string;
    run(): void;
}

// 等价于（因为TypeScript 是结构类型系统，类型之间的对比只会比较它们最终的结构，而会忽略它们定义时的关系）

interface Animal {
    name: string;
}
interface Cat extends Animal {
    run(): void;
}

// 此时 Animal和Cat是相互兼容的，其实例也可以互相断言

```
<a name="KPJis"></a>
### 声明文件的作用
<a name="2EzQk"></a>
#### 作用

1. 例如一个第三方库，有些特殊变量（例如jquery中的$），TS不知道它是什么，所以，无法通过TS的语法检查,  这时候需要`declare var`来定义其类型:
```typescript
declare var jQuery: (selector: string) => any;
```

2. 声明语句会在编译后删除
2. **声明文件：**通常我们会把声明语句放到一个单独的文件（`jQuery.d.ts`）中
   1. 必须.d.ts为后缀
   1. 一般来说，ts 会解析项目中所有的 `*.ts` 文件，当然也包含以 `.d.ts` 结尾的文件。所以当我们将 `jQuery.d.ts` 放到项目中时，其他所有 `*.ts` 文件就都可以获得 `jQuery` 的类型定义了
<a name="ir800"></a>
#### 第三方声明文件

1. 社区：[在这里搜索你需要的声明文件](https://microsoft.github.io/TypeSearch/)
1. [jquery的声明文件](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/jquery/index.d.ts)
```
npm install @types/jquery --save-dev
```
<a name="WWKD8"></a>
#### 书写声明文件

1. 背景：当一个第三方库没有提供声明文件时，我们就需要自己书写声明文件了 
1. 全局变量： 
   1. 例如：jquery的$就是一种全局变量，
   1. 使用第三方的声明文件，则什么都不需要做
   1. 如果是将声明文件直接存放于当前项目中，则建议和其他源码一起放到 `src` 目录下（或者对应的源码目录下）
   1. 语法： `declare const`
   1. 一般来说，全局变量都是禁止修改的常量，所以大部分情况都应该使用 `const `
   1. [关于declare namespace](https://ts.xcatliu.com/basics/declaration-files.html#declare-namespace)
   1. [防止命名冲突](https://ts.xcatliu.com/basics/declaration-files.html#%E9%98%B2%E6%AD%A2%E5%91%BD%E5%90%8D%E5%86%B2%E7%AA%81)：
      1. 暴露在最外层的 `interface` 或 `type` 会作为全局类型作用于整个项目中，我们应该尽可能的减少全局变量或全局类型的数量。故最好将他们放到 `namespace` 下
```
// src/jQuery.d.ts
declare namespace jQuery {
    interface AjaxSettings {
        method?: 'GET' | 'POST'
        data?: any;
    }
    function ajax(url: string, settings?: AjaxSettings): void;
}

// 使用时 加上jQuery前缀
// src/index.ts

let settings: jQuery.AjaxSettings = {
    method: 'POST',
    data: {
        name: 'foo'
    }
};
jQuery.ajax('/api/post_something', settings);
```

3. npm包
   1. npm包一般存在于2个地方：
      1. 与该 npm 包绑定在一起。判断依据是 `package.json` 中有 `types` 字段，或者有一个 `index.d.ts` 声明文件。 这种模式不需要额外安装其他包，是最为推荐的，所以以后我们自己创建 npm 包的时候，最好也将声明文件与 npm 包绑定在一起
      1. 发布到 `@types` 里。我们只需要尝试安装一下对应的 `@types` 包就知道是否存在该声明文件，安装命令是 `npm install @types/foo --save-dev`。这种模式一般是由于 npm 包的维护者没有提供声明文件，所以只能由其他人将声明文件发布到 `@types` 里了
<a name="B6zz3"></a>
### 内置对象
<a name="MM9da"></a>
## 进阶
<a name="C6I3n"></a>
### 字符串字面量类型
`type EventNames = 'click' | 'scroll' | 'mousemove';`
<a name="MA89M"></a>
### 枚举
<a name="fad060bd"></a>
### 类

1. ts除了实现了ES6类的功能外，还添加了一些新的用法
<a name="LbVH1"></a>
##### 访问修饰符

- public
- private
- protected
   - 子类中可以访问
   - `protected constructor() {}` 该类只允许被集成

![](https://cdn.nlark.com/yuque/0/2021/jpeg/2338408/1620387648026-3d542f7c-4657-4597-9298-6eb6d01c57ed.jpeg)
<a name="XcpFc"></a>
##### 抽象类

1. 不允许被实例化, 只允许被继承
1. 抽象类中的抽象方法必须被子类实现
```typescript
abstract class Animal {
  public name;
  public constructor(name) {
    this.name = name;
  }
  public abstract sayHi();
}
class Cat extends Animal {
  public sayHi() {
    console.log(`Meow, My name is ${this.name}`);
  }
}
let cat = new Cat('Tom');
```
<a name="H2bcz"></a>
##### 类的类型使用
```typescript
// 用class作为类型 和interface类似
// 本质上：在声明一个类Animal时，除了会创建该类Animal外，还会创建一个名为Animal的类型 （当然该该类型不包括constructor） 
// 所以 我们既可以将Animal当一个类来使用，也可以当一个类型使用
class Animal {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  sayHi(): string {
    return `My name is ${this.name}`;
  }
}
let a: Animal = new Animal('Jack');
```
<a name="ecbf749b"></a>
### 类与接口
<a name="bnzDr"></a>
##### 接口的意义
一个类，一般只能继承一个类。有时候不同类之间可以有一些共有特性，这时候可以把这部分特性提取成接口，用`implements实现。`<br />也就是说，一个接口可以用来描述一个类或者某些共有特征（属性，方法）
<a name="8045759e"></a>
### 泛型
<a name="zlger"></a>
#### 泛型的本质：

1. 就是通过类似于参数的形式，告知结构化类型其中某个在类型定义时未定义的类型；有些拗口：就是在使用某类型时通过泛型语法传入一个类型给该类型；
1. 泛型变量：
   1. 可以在描述该类型结构的时候使用
   1. 可以在该函数或者类定义时，在内部使用；
      1. 内部使用时注意泛型约束
3. 如果类型定义是一个函数，那么泛型可以理解为传给该类型函数的一个参数
<a name="7gSpr"></a>
#### 泛型约束[⏫]

   1. 解决问题：在函数内部使用泛型变量的时候，由于事先不知道其是哪种类型，所以不能随意操作它的属性和方法，这个时候，通过对泛型进行约束，例如用接口描述该泛型变量的特征：
```typescript
/**
* 因为函数内部需要使用length属性，通过extends该接口，使T必须具有length属性
*/
interface Lengthwise {
    length: number;
}
function loggingIdentity<T extends Lengthwise>(arg: T): T {
    console.log(arg.length);
    return arg;
}
```
<a name="xVoJH"></a>
#### 泛型的提取
1. 如果有一个在定义时无法确定的类型，那么就可以使用泛型来描述其类型，同时，要注意如果函数内部需要使用该泛型变量的一些特征等，可以通过`interface`对该泛型变量的特征进行描述，并使用该泛型`extends`该`interface`
<a name="Z0vbx"></a>
####  泛型接口

1. 使用含有泛型的接口描述一个函数
```typescript
interface CreateArrayFunc {
    <T>(length: number, value: T): Array<T>;
}
let createArray: CreateArrayFunc;
createArray = function<T>(length: number, value: T): Array<T> {
    let result: T[] = [];
    for (let i = 0; i < length; i++) {
        result[i] = value;
    }
    return result;
}
createArray(3, 'x');
```
<a name="9PH3P"></a>
#### 泛型类
```typescript
class GenericNumber<T> {
    zeroValue: T;
    add: (x: T, y: T) => T;
}
let myGenericNumber = new GenericNumber<number>();
myGenericNumber.zeroValue = 0;
myGenericNumber.add = function(x, y) { return x + y; };
```
<a name="bb3fc42a"></a>
#### 泛型参数默认类型

1. 泛型参数默认类型：在没有明确指出该泛型，并且从实际值参数中无法推测出时，该默认值会生效：
```typescript
function createArray<T = string>(length: number, value: T): Array<T> {
    let result: T[] = [];
    for (let i = 0; i < length; i++) {
        result[i] = value;
    }
    return result;
}
```

---

<a name="4qT0l"></a>
### 声明合并
<a name="kLPGf"></a>
#### 概念
如果定义了两个相同名字的函数、接口或类，那么它们会合并成一个类型
<a name="cXCYE"></a>
#### 函数合并
就是函数重载
```typescript
function reverse(x: number): number;
function reverse(x: string): string;
function reverse(x: number | string): number | string {
    if (typeof x === 'number') {
        return Number(x.toString().split('').reverse().join(''));
    } else if (typeof x === 'string') {
        return x.split('').reverse().join('');
    }
}
```
<a name="xcXM7"></a>
#### 接口合并
```typescript
interface Alarm {
    price: number;
}
interface Alarm {
    weight: number;
}
// 相当于
interface Alarm {
    price: number;
    weight: number;
}
```
1. 合并的属性
```typescript
interface Alarm {
    price: number;
}
interface Alarm {
    price: string;  // 类型不一致，会报错
    weight: number;
}
```

2. 接口中方法的合并和函数的合并一样
```typescript
interface Alarm {
    price: number;
    alert(s: string): string;
}
interface Alarm {
    weight: number;
    alert(s: string, n: number): string;
}
// 相当于
interface Alarm {
    price: number;
    weight: number;
    alert(s: string): string;
    alert(s: string, n: number): string;
}
```
<a name="dHaDy"></a>
#### 类的合并

1. 合并规则和接口的合并规则一致

---

<a name="jcwQF"></a>
## 工程
<a name="1cf481e0"></a>
### 代码检查
<a name="uzsbq"></a>
#### 在TS中使用ESLint

1. 安装eslint

`npm install --save-dev eslint`

2. 安装typescript

`npm install --save-dev typescript`

3. 安装@typescript-eslint/parser
   1. 作用：由于ESLint默认使用Expree进行语法解析，无法识别TS的一些语法，所以需要安装@typescript-eslint/parser替代掉默认的解析器

`npm install --save-dev @typescript-eslint/parser`

4. 安装@typescript-eslint/eslint-plugin
   1. 作用：作为eslint默认规则的补充，提供了一些额外的适用于ts语法的规则

`npm install --save-dev @typescript-eslint/eslint-plugin`
<a name="GV6EQ"></a>
##### 创建配置文件
在项目根目录下创建一个`.eslintrc.js`
```javascript
module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: {
        // 禁止使用 var
        'no-var': "error",
        // 优先使用 interface 而不是 type
        '@typescript-eslint/consistent-type-definitions': [
            "error",
            "interface"
        ]
    }
}
```
<a name="HFA05"></a>
##### 检查整个项目的ts文件
```json
{
    "scripts": {
        "eslint": "eslint src --ext .ts" // 检查src目录下的.ts文件(eslint默认不会检查.ts文件，所以需要加上--ext .ts)
    }
}
```
<a name="ZwtF2"></a>
##### VSCode中的配置

1. 安装eslint插件
1. vscode中的eslint插件默认不会检查.ts文件，
   1. [文件-首选项-设置-工作区]
   1. 或者 在项目根目录下创建一个配置文件.vscode/settings.json `团队项目推荐`
```json
{
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        {
            "language": "typescript",
            "autoFix": true // 开启自动修复
        }
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
}
```
<a name="XybN8"></a>
#### 使用prettier修复格式错误

1. 目的：保持代码风格统一
1. 安装prettier

`npm install --save-dev prettier`

3. 创建一个prettier.config.js
```javascript
// 一个推荐配置
// prettier.config.js or .prettierrc.js
module.exports = {
    // 一行最多 100 字符
    printWidth: 100,
    // 使用 4 个空格缩进
    tabWidth: 4,
    // 不使用缩进符，而使用空格
    useTabs: false,
    // 行尾需要有分号
    semi: true,
    // 使用单引号
    singleQuote: true,
    // 对象的 key 仅在必要时用引号
    quoteProps: 'as-needed',
    // jsx 不使用单引号，而使用双引号
    jsxSingleQuote: false,
    // 末尾不需要逗号
    trailingComma: 'none',
    // 大括号内的首尾需要空格
    bracketSpacing: true,
    // jsx 标签的反尖括号需要换行
    jsxBracketSameLine: false,
    // 箭头函数，只有一个参数的时候，也需要括号
    arrowParens: 'always',
    // 每个文件格式化的范围是文件的全部内容
    rangeStart: 0,
    rangeEnd: Infinity,
    // 不需要写文件开头的 @prettier
    requirePragma: false,
    // 不需要自动在文件开头插入 @prettier
    insertPragma: false,
    // 使用默认的折行标准
    proseWrap: 'preserve',
    // 根据显示样式决定 html 要不要折行
    htmlWhitespaceSensitivity: 'css',
    // 换行符使用 lf
    endOfLine: 'lf'
};
```

4. 安装VSCode prettier插件
4. 修改.vscode/setting.json，实现保存文件时对代码进行自动格式化：
```json
{
    "files.eol": "
",
    "editor.tabSize": 4,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "eslint.autoFixOnSave": true,
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        {
            "language": "typescript",
            "autoFix": true
        }
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
}
```
6. 由于 ESLint 也可以检查一些代码格式的问题，所以在和 Prettier 配合使用时，我们一般会把 ESLint 中的代码格式相关的规则禁用掉，否则就会有冲突了
<a name="BXPAo"></a>
#### 使用ESLint检查tsx文件

1. 安装eslint-plugin-react

`npm install --save-dev eslint-plugin-react`

2. package.json的scripts.eslint添加.tsx
```json
{
    "scripts": {
        "eslint": "eslint src --ext .ts,.tsx"
    }
}
```

3. VSCode配置新增typescript检查
```json
{
    "files.eol": "
",
    "editor.tabSize": 4,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "eslint.autoFixOnSave": true,
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        {
            "language": "typescript",
            "autoFix": true
        },
        {
            "language": "typescriptreact", // 增加对tsx的检查
            "autoFix": true
        }
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
}
```
<a name="HGQLt"></a>
#### TroubleShooting

1. [链接](https://ts.xcatliu.com/engineering/lint.html#troubleshootings)
<a name="16155d81"></a>
### 编译选项
| 选项 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| allowjs | boolean | false | <br />1. 允许tsc编译js文件<br />1. 一般在项目js ts混合开发时需要设置<br /> |
|  |  |  |  |

<a name="R8eLj"></a>
#### 一份编译选项的最佳实践配置 - ？？

---

<a name="Zd1NK"></a>
## 其他

1. 如果我们需要保证运行时的参数类型，还是得手动对类型进行判断；
1. TypeScript 编译的时候即使报错了，还是会生成编译结果，我们仍然可以使用这个编译之后的文件。
   1. 要在报错的时候终止 js 文件的生成，可以在 `tsconfig.json` 中配置 `noEmitOnError` 即可
3. 使用构造函数 `Boolean` 创造的对象不是布尔值：

---

<a name="POJBS"></a>
## 疑问
> 直面内心困惑疑虑

1. Q：Promise的类型处理方案？？
   1. A:
```typescript
// 这里的promise<number> 代表该函数的返回值为一个promise, 该promise的then中的返回值为number类型
function createPromise(isResolve: boolean): Promise<number> {
	return new Promise((resolve, reject) => {
  	if (isResolve) {
    	resolve(0);
    }
    reject(1);
  });
}
```

2. <br />
```
{
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        "typescript"
    ],
    "typescript.tsdk": "node_modules/typescript/lib"
}
```
