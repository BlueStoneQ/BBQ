## 摘取出interface中的某个成员
- https://segmentfault.com/q/1010000038792918
```ts
a: IProps['label']
```

## 继承多接口
一个interface可以同时继承多个interface，实现多个接口成员的合并。用逗号隔开要继承的接口。
```ts
interface Shape {
    color: string;
}

interface PenStroke {
    penWidth: number;
}

interface Square extends Shape, PenStroke {
    sideLength: number;
}
```
需要注意的是，尽管支持继承多个接口，但是如果继承的接口中，定义的同名属性的类型不同的话，是不能编译通过的。如下代码：
```ts
interface Shape {
    color: string;
    test: number;
}

interface PenStroke extends Shape{
    penWidth: number;
    test: string;
}
```
# TS报错
- Type string trivially inferred from a string literal, remove type annotation
- 过于啰嗦了，有些地方不用注释类型：
- 例如函数参数的默认值被指定后，就不用再注释参数了
```ts
// bad case
const fn = (param: string = '') => {}

// good case 
const fn = (param = '') => {}
```