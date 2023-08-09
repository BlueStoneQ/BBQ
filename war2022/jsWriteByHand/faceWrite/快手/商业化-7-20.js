/**
 * 2023-7-20
 * A和B做游戏，A先从1和2中挑一个数字，B在A的基础上加1或加2，
 * 然后又轮到了A，就这样双方交替地在这个累加数字的基础上加1或加2，
 * 谁要是正好加到20，谁就赢。
 * 不区分先后手，用什么策略保证一定能赢？
 * 
 */

/**
 * 方法2:[正解]
从20倒推 只要到谁首先到某个节点 那这个节点一定能赢，
        - 例如A首先到节点17, 
            - 则B选1到18(则A再选2到20, A赢),
            - 则B选2到19(则A再选1到20, A赢)
这样优先达到就能必赢的节点: 从20倒推依次是(元素依次减3): 20, 17, 14, 11, 8, 5, 2
这样推演出来的: 只要最先达到2的选手一定可以赢
    - 这样的话，分2种策略：
        - 第一个选：则选2 , 然后沿着必赢链去踩点，必赢
        - 第二个选：则有2种情况：
            - 对方选了1, 则我方选1, 踩中2，则沿着必赢链继续选下去，必赢
            - 对方选了2, 则我方必须尽可能争取第二必赢点5，走上必赢链, 必赢
    - 所以，在这个有限集里推演的必赢策略就是, 要第一个选2，然后沿着必赢链走下去


这样的必赢策略推演 翻译成程序就是？？

签名： getWinStrategy(slectList, targetSum) => winPath（必赢链）
*/

const getWinPath = (slectList, targetSum) => {
    const winPath = [];
    const slectListSum = (slectList || []).reduce((pre, cur) => pre + cur, 0);

    while (targetSum > 0) {
        winPath.push(targetSum);
        targetSum -= slectListSum;
    }

    return winPath;
}

console.log('方法2: getWinPath([1, 2], 20): ', getWinPath([1, 2], 20));
console.log('方法2: getWinPath([1, 2, 3], 30): ', getWinPath([1, 2, 3], 30));

/*********************************************** 方法1: START *********************************************************************************************

/** 
 * 方法1:
 *  优点：可以枚举出各种策略下的必赢路径，从实际开发软件的角度技术密集程度和实用程度超过方法2
 *  缺点：其实不能完全确保必赢,管道最后一个环节计算量很大
 * 基于DFS回溯的暴力枚举法 + 管道式的处理：
 * - 管道式处理（实现了一个简单的同步任务管道式调度器）
 * - 中间函数1: DFS回溯: 枚举出每条选择路径 得到一个路径的集合（二维数组：[路径1， 路径2]）
 * - 中间函数2: 对这个集合做一次filter, 根据先选和后选有不同的策略, 根据不同的策略可以输出对应的必赢链
 * - 选择函数：每次输入当前累积的和curSum，然后在可以赢的序列中找到前面的和为curSum的序列，吐出next元素，作为下一次选择
 * 
 * 可以建立一个缓存型的查表：避免多次运算：
 * 每个和后面可以选哪个？
 * 1: [2, 1]
 * 2: [2, 1]
 * 3: [2, 1]
 * ...
 * 
 * TODO: version2 升级：8-2：
 *  1. 第三步：利用正则匹配到第一个就停止匹配（每个path都join成string, 利用prePathStr来构造正则进行匹配，匹配到第一个即可停止匹配），同时筛除掉之前已经不匹配的：看看是否需要给孟哥😂
    2. 重新完善下pipe的getResult，采用callback的形式
    3. 采用node.readline实现问答交互式的 根据甲乙来给出下一步指导，可以快速实现下，如果还有后续可以发下
 */

/**
 * 回溯: 枚举出所有的可能的分支路径
 * @param {*} targetSum 
 * @param {*} numList 
 * @returns 
 */
const getAllpath = (targetSum, numList) => {
    if (!numList || !Array.isArray(numList) || numList.length === 0) return [];

    const pathList = [];

    const _getAllpath = (path, sum) => {
        if (sum > targetSum) return;
        if (sum === targetSum) {
            pathList.push(path.slice())
            return;
        }

        // 无重复path 无需去重处理
        for (const num of numList) {
            path.push(num)
            _getAllpath(path, sum + num)
            path.pop()
        }
    }

    _getAllpath([], 0);

    return pathList;
}

const STRATEGY = {
    first: 1,
    second: 2,
}
/**
 * 根绝不同策略对路径进行过滤 得出必赢路径集合
 * @param {string} strategy 参赛者是第一个挑，还是第二个挑，对应2套筛选策略
 *                              - 第一个挑 则 奇数个元素的path 最后一个是参赛者 可以赢
 *                              - 第二个挑 则 偶数个元素的path 最后一个是参赛者
 * @returns 
 */
const getWinPathList = (pathList, strategy) => {
    const strategy2LastNum = {
        [STRATEGY.first]: 1, // path.length为奇数，则 path.length % 2 === 1
        [STRATEGY.second]: 0, // path.length为偶数，则 path.length % 2 === 0
    }

    return (pathList || []).filter(path => path.length % 2 === strategy2LastNum[strategy]);
}

// 再做一次去重过滤 序列化后 相同的可以去掉
// Array.prototype.uniqPathList = function() {
//     const pathList = this;
//     return Array.from(new Set((pathList || []).map(path => path.join('')))).map(pathStr => pathStr.split('').map(num => +num))
// }

// const getNextNumByPreSum = (preSum, targetSum, winPathList) => {
//     if (preSum >= targetSum) return 'You win!';

//     // 建立一个查表, 建立 1-20 每个数字后面可以选的数字
    
//     return winPathList.
// }

// test
// getPathList(20, [1, 2]).getWinPathList()

/**
 * 顺手写一个pipe工具 实现函数管道式调用
 */
class PipeLine {
    constructor() {
        this.taskQueue = []; // 这里就先处理简单的同步任务,需要的话,我们也可以处理异步任务链
        this.result = null;
    }

    /**
     * 注册任务到流水线的任务队列中
     * @param {function} task 
     */
    addTask(task) {
        this.taskQueue.push(task);
    }

    run() {
        for (const task of this.taskQueue) {
            this.result = task(this.result);
        }

        return this;
    }

    getResult() {
        return this.result;
    }
}

// 单例
const getSingletonFn = (fn) => {
    let instance = null;

    return function (...args) {
        if (instance === null) {
            instance = fn.apply(this, args);
        }

        return instance;
    }
}

const getPipeLineSingleton = getSingletonFn(() => new PipeLine())

const pipe = function(task) {
    const pipeLine = getPipeLineSingleton();
    if (!pipeLine.pipe || typeof pipeLine.pipe !== 'function') pipeLine.pipe = pipe;

    pipeLine.addTask(task);

    return pipeLine;
}

// pipe调用: 管道第二节的入参pathList 就是 管道第一节的返回值, 内部函数本身的值，是我们在用pipe注册函数的时候注入的
console.log('方法1: 必赢路径: \n',
    pipe(() => getAllpath(20, [1, 2]))
        .pipe(pathList => getWinPathList(pathList, STRATEGY.first))
        .run()
        .getResult()
);

