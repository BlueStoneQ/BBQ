```
例子驱动
```
# 资料
- [神光:nest小册:作为学习大纲](https://juejin.cn/book/7226988578700525605/section/7229127664756326455)
- 【Nestjs 全家桶系列】 https://www.bilibili.com/video/BV1NG41187Bs/?p=2&share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233


# IOC & DI
- IOC: Inversion of Control: 控制反转
  - 高层模块不应依赖低层模块，二者都应该依赖其抽象
  - 抽象不应该依赖细节
  - 细节应该依赖抽象
- DI: dependency injection: 依赖注入
  - 和IOC本质上是一个东西
- 没有使用IOC&DI来设计的依赖关系：
```ts
class A {
  constructor(name) {
    this.name = name;
  }
}

class B {
  constructor(name) {
    // 注意，这里发生了B和A的依赖耦合，如果A的构造函数签名发生变化，则B也需要改变内部这里的实现
    this.name = new A(name).name;
  }
}
```
- 按照IOC&DI设计的依赖关系：
```ts
// IOC&DI实现：我们会引入一个第三方的管理依赖的class
class Container {
  constructor() {
    this.map = {};
  }

  // 功能本质上其实是注册
  provide(key: string, value: any) {
    this.map.set(key, value);
  }

  get(key: string) {
    return this.map.get(key);
  }
}

// init
const container = new Container();

container.provide('a1', new A('jam'));
container.provide('a2', new A('joy'));

class B {
  // B这里不直接依赖A了 而是依赖container
  constructor(container: Container) {
    this.a1 = container.get('a1');
    this.a2 = container.get('a2');
  }
}

```
# nest-cli

# Controllers
- 装饰器: 实现nestjs的底层GET装饰器
```js
// 装饰器本质上就是一个函数, 这里为了传入URL 我们使用HOF
const Get = (url) => (target, key, descriptor) => {
  const originalFunc = descriptor.value; // 被装饰的函数, 下面的例子是fetchList函数

  axios.get(url).then(res => originalFunc(err)).catch(err => originalFunc(err))
}

class Controller {
  @Get('http://xxx.xxx.xx/api/xxx')
  fetchList(res) {}
}
```
# Providers
# Modules
# Middleware
# Exception filters
# Pipes
# Guards
# Interceptors
# Custom decorators
# fundamentals
# technipues
# Security
# GraphQL
# micro-service
- https://juejin.cn/book/7226988578700525605/section/7236156501499330618
- 不过微服务和微服务之间一般不是用 http 来通信的。
为什么呢？
因为 http 的请求响应会携带大量的 header：
增大了通信的开销。
所以服务和服务之间没必要用 http，直接用 tcp 就好了。
# MQ：RabbitMQ
- https://juejin.cn/book/7226988578700525605/section/7236156565277900858
- amqplib 的包，这个是 rabbitmq 的 node 客户端（amqp 是 rabbitmq 的协议）
- 流量削峰：
  - 数据库的并发比较低，我们可以通过 MQ 把消费的上限调低，就能保证数据库服务不崩。比如 10w 的消息进来，每次只从中取出 1000 来消
- 
