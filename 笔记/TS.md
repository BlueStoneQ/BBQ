## 摘取出interface中的某个成员
- https://segmentfault.com/q/1010000038792918
```ts
a: IProps['label']
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