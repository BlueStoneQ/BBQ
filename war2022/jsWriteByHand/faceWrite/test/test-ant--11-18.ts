// ant 保险
// 设计一个函数 warpFunc，可以对其他任意函数 funcX 进行处理，并满足：warpFunc(funcX)(x1)(x2)(x3)()的结果等同于funcX(x1, x2, x3) ，funcX可以为任意函数，且参数数量不固定。

export function warpFunc(fn, originalArgs) {
  // defend
  if (typeof fn !== 'Function') {
    throw new Error('first param must be function');
  }
  // init data
  const needArgsLen = fn.length; // 1
  // return 
  const _fn = function (...args) {
    const combineArgs = [...originalArgs, ...args];
    if (args.length === 0) {
      return fn.apply(this, combineArgs);
    }

    return warpFunc(fn, combineArgs);
  }

  return _fn;
}

// 用例
describe('test warpFunc', () => {
  	const funX = function(...arg) {
      	if (!arg.length) return 0;
      	return arg.reduce((x, y)=> x + y)
    }
  
    it('用例', function () {
        try {
          warpFunc();
        } catch(e) {
          asset(e.message === 'first param must be function');
        }
      	try {
          warpFunc(1)(1)();
        } catch(e) {
          asset(e.message === 'first param must be function');
        }
        asset(warpFunc(funX)() === 0);
      	asset(warpFunc(funX)(1)() === 1);
      	asset(warpFunc(funX)(1)(2)(3)(4)() === 10);
    });
});



/**
使用 setTimeout, clearTimeout 实现  mySetInterval， myClearInterval
在 write code here 注释处编写代码
*/

type Timer = number;

// 使用setTimeout实现setInterval
// write code here
export function mySetInterval(callback, t): Timer {
  const timer = {
    stop: false
  };

  const run = () => {
    if (timer.stop === true) return;
    setTimeout(() => {
      callback && callback();
      run();
    }, t);
  }

  run();

  return timer;
}

// 提示：使用clearTimeout
export function myClearInterval(timer: Timer) {
  // 如果timer要是number 就得用一个全局唯一任务队列去管理 - timer是他的key或者index [ { stop: true } ]
  timer.stop = true;
}



/**
 * 实现函数，可以拓展原生 Promise，新增一个 cancel 方法用于取消当前的 Promise
Promise 被取消后，会被直接resolve, 返回值为 undefined
*/

interface CancelablePromise<T> extends Promise<T> {
    cancel(): void;
}

export function wrapToCancelPromise(originalPromise: Promise<any>): CancelablePromise<any> {
  if (!Promise.prototype.cancel) {
    Promise.prototype.cancel = function () {
      return new Promise((resolve, reject) => {
        try {
          const timer = await this;
          clearTimeout(timer);
        } catch (err) {
          reject(err);
        }
      });
    }
  }

  return originalPromise.cancel();
}


// 用例
function delay(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

describe('test cancelable-promise.test.ts', function () {
    it('取消Promise', async function () {

        let i = 1;

        async function test() {
            await delay(500);
            i++;
        }

        const cancelablePromise = wrapToCancelPromise(test());

        setTimeout(() =>{
            cancelablePromise.cancel();
        }, 200);

        const result = await cancelablePromise;

        expect(i).toBe(1);
        expect(result).toBe(undefined);
    });

    it('取消时机较晚', async function () {

        let i = 1;

        async function test() {
            await delay(200);
            i++;
        }

        const cancelablePromise = wrapToCancelPromise(test());

        setTimeout(() =>{
            cancelablePromise.cancel();
        }, 500);

        await cancelablePromise;

        expect(i).toBe(2);
    });

    it('异常处理', async function () {

        let i = 1;

        const err = new Error('test error');

        async function test() {
            await delay(200);
            throw err;
        }

        const cancelablePromise = wrapToCancelPromise(test());

        setTimeout(() =>{
            cancelablePromise.cancel();
        }, 500);

        try {
            await cancelablePromise;
        } catch (e) {
            expect(e).toBe(err);
        }
    });
});


