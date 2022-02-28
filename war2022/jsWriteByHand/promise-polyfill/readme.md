# 规范解读
- then 的参数 onFulfilled 和 onRejected 可以缺省
 * 8. promise 可以then多次，promise 的then 方法返回一个 promise
 * 9. 如果 then 返回的是一个结果，那么就会把这个结果作为参数，传递给下一个then的成功的回调(onFulfilled)
 * 10. 如果 then 中抛出了异常，那么就会把这个异常作为参数，传递给下一个then的失败的回调(onRejected)
 * 11.如果 then 返回的是一个promise，那么会等这个promise执行完，promise如果成功，
 *   就走下一个then的成功，如果失败，就走下一个then的失败
 onFulfilled or onRejected must not be called until the execution context stack contains only platform code. 


在执行上下文堆栈仅包含平台代码之前，不得调用 onFulfilled 或 onRejected

这里的“platform code”是指引擎、环境和Promise实现代码。在实践中，这个要求确保 onFulfilled 和 onRejected 异步执行，在调用 then 的事件循环之后，并使用新的堆栈。这可以通过“宏任务”机制（例如 setTimeout 或 setImmediate）或“微任务”机制（例如 MutationObserver 或 process.nextTick）来实现。由于Promise实现被认为是平台代码，在操作者调用时，它本身可能包含一个任务调度队列或“trampoline”

 # me
 1. 可以这样理解 then这里更像注册端，将函数注册进去；在定义时，调用resolve函数，更像是emit，执行队列里注册的函数。

# TODO
- 需要用promisA+的测试集跑下
- 写好了，可以迁移下

# 参考
- https://blog.jsonfeed.cn/understand-promise-specification/
- [promiseA+规范解读](https://juejin.cn/post/6995452761550618637)
- [注释写的较为详细流畅](http://www.noobyard.com/article/p-ecmqfceq-oe.html)