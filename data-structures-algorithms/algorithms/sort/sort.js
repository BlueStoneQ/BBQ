/**
 * @author sTone
 * @refrence http://biaochenxuying.cn:2019/articleDetail?article_id=5d4059b896cf541789792485##toc38
 * 
 * 1. 所有的排序 默认为升排序：123这样子 小到大
 * 2. 在算法中 我们要有指针性操作的认识
 * 1. 利用一个数组列表对象承载我们的排序算法
 * 2. 审题 - 思维模型 - 代码落地
 * 3. 自己先思考给出实现 然后再对照下书中的实现
 * 4. 默认实现-从小到大
 * 5. 所有自己独立思考实现的方案：my前缀
 */

function ArrayList() {
  
  var array = [];
  /**
   * 记录时间复杂度
   */
  this.cost = 0;

  this.insert = function(item) {
    array.push(item);
  }
  
  this.toString = function() {
    return array.join();
  }

  /**
   * 提供格式化的string 用中括号扩出哪两个元素发生了交换
   * @param {num} index1 发生了交换的两个元素坐标
   * @param {num} index2
s   */
  this.formatString = function(index1, index2) {
    let str = array.join();
    str.replace(`${array[index1]}`,  `[${array[index1]}]`);
    str.replace(`${array[index2]}`,  `[${array[index2]}]`);
    return str;
  }

  /**
   * 私有工具函数
   */
  var swap = function(index1, index2) {
    var t = array[index1];
    array[index1] = array[index2];
    // 打印下当前的array的形态
    array[index2] = t;
    console.log(`[${this.count}] ${this.formatString(index1, index2)}`);
  }

  /**
   * 冒泡排序
   *
   *  改进版冒泡：
   *    -i的原因：
   *      每次内循环时，前面的i个数字已经是冒泡上来的，也就是有序的
   * 内层循len - 1的原因是
   *  因为最大坐标为len-1, 而在len - 2时就已经发生了和array[len-2]和array[len-1]的比较了
   * 排序其实大都基于比较：优化的理念就是减少不必要的无用的比较（循环次数）
   *
   */
  this.bubbleSort = function() {
    const len = array.length;
    if (len <= 1) return;

    for (let i = 0; i < len; i++) {
      this.cost++;
      for (let j = 0; j < len - 1 - i ; j++) {
        this.cost++;
        if (array[j] > array[j+1]) {
          swap.call(this, j, j+1);
        }
      }
    }
  }

  /**
   * 插入排序 Insertion Sort(自己按照插入排序的思想写的实现)
   * 1. i 和 j 其实就是双指针
   * 2. 缺陷：把索引找寻和插入应该分开 避免频繁插入操作
   */
  this.myInsertionSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array;
    const len = arr.length;
    if (len <= 1) return;

    for (let i = 1; i < len; i++) {
      var tmp = arr[i];
      for (let j = i - 1; j >= 0; j--) {
        if (tmp < arr[j]) {
          arr[j + 1] = arr[j];
        } else {
          arr[j + 1] = tmp;
          break;
        }
        // 要考虑边界：j - 0 不存在的情况
        if (j === 0) {
          arr[j] = tmp;
        }
        console.log('arr: ', arr);
      }
    }
    // 修改当前命名空间中的数组
    array = arr;
    return arr;
  }

  /**
   * 插入排序 Insertion Sort[主流实现]
   * 1. 记忆的是什么 就是那个动态图
   */
  this.insertionSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array; 
    const len = arr.length;
    if (len <= 1) return;
    for (let i = 1; i < len; i++) {
      // i = 1, 因为默认第一个元素已排序 我们选择第二个元素开始作为插入参数
      var preIndex = i - 1;
      var current = arr[i];
      // 通过遍历把preIndex指针移动到current大于arr[preIndex]处: 即：大于current的向后移动
      while ( preIndex >= 0 && current < arr[preIndex] ) {
        arr[preIndex + 1] = arr[preIndex]; // 将大于current的值向后移动一位
        preIndex--; // 移动遍历指针
      }
      if (preIndex + 1 !== i) {
        // 避免同一个值赋值给自身所在位置
        arr[preIndex + 1] = current; // 插入操作
        console.log(`[${i}: `, arr);  
      }
    }
  }

  /**
   * 拆半插入 - 插入排序升级版
   * 1. 优化主要体现在preIndex的确定
   */
  this.myBinaryInsertionSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array;
    const len = arr.length;
    if (len <= 1) return;
    // 当前插入值, 折半辅助量：低半区下限/边界，高半区上限/边界，中间下标
    let current, low, high, m;
    for (let i = 1; i < len; i++) {
      high = i - 1;
      low = 0;
      current = arr[i];
      // 找出要插入的位置（下标）
      while (low <= high) {
        m = (low + high) >> 1;
        if (current >= arr[m]) {
          // 不断让两个范围下标靠近：low high，缩小范围 
          low = m + 1;
        } else {
          high = m - 1;
        }  
      }
      // 对要插入位置直到要插入元素之间的元素 均向后移动一位 - 记住 从后向前遍历 不然 容易前面的覆盖后面的
      for (let j = i; j > low;j--) {
        arr[j] = arr[j - 1];
      }
      // 将要插入元素插入算出的插入位置
      arr[low] = current;
      console.log(i, ':arr: ', arr);
    }
    return arr;
  }

  /**
   * 选择排序 - Select Sort
   * 1. 类似于插入排序 分为：已排序区间 和  未排序区间
   * 2. 区间的分隔 实际上就是搜索范围的缩小 - 也就是边界index的移动
   */
  this.mySelectSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array;
    for (let i = 0, len = arr.length; i < len; i++) {
      for (let j = i; j < len; j++) {
        if (arr[i] > arr[j]) {
          // 交换两个数
          let tmp = arr[j];
          arr[j] = arr[i];
          arr[i] = tmp;
        }
        console.log('mySelect sort arr: ', arr);
      }
    }
    return arr;
  }

  /**
   * 选择排序 - Select Sort 
   */
  this.selectSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array;
    let minIndex, temp;
    for (let i = 0, len = arr.length; i < len; i++) {
      minIndex = i;
      for (let j = i; j < len; j++) {
        // 找出未排序区间的最小值的index
        if (arr[minIndex] > arr[j]) {
          minIndex = j;
        }
      }
      // 把找到的未排序区间的值插入已排序区间的末尾 - 其实是与末尾（也就是当前未排序区间的第一位）进行交换
      temp = arr[i];
      arr[i] = arr[minIndex];
      arr[minIndex] = temp;
      console.log('selectSort arr: ', arr)
    }
    return arr;
  }

  /**
   * 归并排序 - Merge sort
   * 1. 自己根据算法思维模型实现的一版
   * 2. 第一个可以实用的排序算法
   * 3. 分为：分割（直至子数组长度为1）+ 合并（比较）
   * 4. 低谷就像一个回旋洞，走到那里就掉进去了，从洞里回旋出来 - 也可以用洋葱模型理解下：koa2: await实现的那种中间件机制
   * 5. 分治思想：那我们可以分为分割和合并两个部分，分别开发，保证分割函数：分割为长度为1为止；合并：多个合并为一个；
   */
  this.myMergeSort = function(myArray) {
    let arr = myArray ? myArray.slice() : array;
    // 定义需要的工具函数
    if (!this.myMerge) {
      // 节流，myMerge避免重复定义
      this.myMerge = function(arrL, arrR) {
        console.log('arrL: ', arrL);
        console.log('arrR: ', arrR);
        // 操作数组需要什么？？’指针‘（下标变量）
        let iL = 0,
            iR = 0;
        // 额外空间-数组来存储合并后的数组 - 但是在每一轮合并后该数组就会销毁
        let mergeArr = [];
        // 需要两个区间元素作比较的情况 - 直到一方全部进入合并后的数组
        while(arrL[iL] && arrR[iR]) {
          if (arrL[iL] <= arrR[iR]) {
            // 这里的<=也保证了该排序稳定性：相等的 位于左边的排序后依然在左边
            mergeArr.push(arrL[iL++]);
          } else {
            mergeArr.push(arrR[iR++]);
          }
        }
        // 只剩一边的情况
        while(arrL[iL]) {
          mergeArr.push(arrL[iL++]);
        }
        while(arrR[iR]) {
          mergeArr.push(arrR[iR++]);
        }
        console.log('mergeArr: ', mergeArr);
        return mergeArr;
      }
    }
    if (!this.myMergeSortRec) {
      this.myMergeSortRec = function(arr) {
        let len = arr.length;
        // 递归：一定要重视终止条件
        if (len === 1) {
          return arr;
        }
        let m = len >> 1; // 等于Math.floor(len/2)
        let arrL = arr.slice(0, m);
        let arrR = arr.slice(m, len);
        return this.myMerge(this.myMergeSortRec(arrL), this.myMergeSortRec(arrR));
      }
    }
    // 启动排序
    return this.myMergeSortRec(arr);
  }

  /**
   * 归并排序 merge sort - 主流实现版
   * 1. 再到后面效率越高的排序，要有“辅助函数”的意识
   * 2. 数组有一些非坐标操作：例如栈操作/队列操作,可以让我们免于用额外的空间来存储遍历下标
   * 3. 分割点：一般就是中点：mid = Math.floor(len / 2)
   */
  this.mergeSort = function(myArray) {
    let arr = myArray ? myArray.slice() : array;
    // 定义辅助函数
    // 辅助函数-合并
    if (!this.merge) {
      this.merge = function(arrL, arrR) {
        let mergeArr = [];
        // 两个子区间进行合并
        while(arrL.length > 0 && arrR.length > 0) {
          if (arrL[0] <= arrR[0]) {
            // 排序的稳定性 很多程度上取决于这里作比较时的方向和=的使用
            mergeArr.push(arrL.shift());
          } else {
            mergeArr.push(arrR.shift());
          }
        }
        // 剩下的另一边位合并的进行合并
        while(arrL.length) {
          mergeArr.push(arrL.shift());
        } 
        while(arrR.length) {
          mergeArr.push(arrR.shift());
        }
        console.log('mergeArr: ', mergeArr);
        return mergeArr;
      }
    }
    // 辅助函数 - 分割(真正的递归其实在这里，辅助函数只是作为工具，参与mergeSortRec每一层的递归)
    if (!this.mergeSortRec) {
      this.mergeSortRec = function(arr) {
        let len = arr.length;
        // 递归终止条件 - 就是在满足某一条件的情况下 不再调用自身 而是返回一个‘正常值’
        if (len === 1) {
          // 利用递归分割 - 分割到子数组长度为1时 停止递归调用 开始从内向外返回可用于计算的‘正常值’
          return arr;
        }
        let mid = Math.floor(len/2);
        let arrL = arr.slice(0, mid);
        let arrR = arr.slice(mid);
        return this.merge(this.mergeSortRec(arrL), this.mergeSortRec(arrR));
      }
    }
    return this.mergeSortRec(arr);
  }

  /**
   * 快速排序 quick sort
   * 1. 实现方式1：辅助方法少的一种
   * 2. 请分析该实现的复杂度
   */
  this.myQuickSort = function(myArray) {
    console.log('开始排序');
    // 特殊变量处理
    let arr = myArray ? myArray.slice() : array;
    // 辅助函数
    if (!this.mqs) {
      console.log('gshsg');
      this.mqs = function(arr) {
        console.log('开始排序1');
        if (arr.length <= 1) {
          console.log('递归出口');
          return arr;
        }
        const len = arr.length;
        // 选择基点
        let baseVar = arr.splice(Math.floor(len/2), 1)[0];
        let leftArr = [], // 存放比基点大的数组
            rightArr = []; // 存放比基点小的数组
        // 递归出口 - 划分操作时，划分len = 1时，为递归出口
        // 划分操作 - 因为splice使arr的长度减一 所以 遍历时 我们要用len-1作为遍历的下标上限
        for (let i = 0; i < len - 1; i++) {
          if (arr[i] < baseVar) {
            leftArr.push(arr[i]);
          } else {
            rightArr.push(arr[i]);
          }
        }
        // console.log('leftArr: ', leftArr);
        // console.log('rightArr: ', rightArr);
        // 递归拼接
        return this.mqs(leftArr).concat(baseVar, this.mqs(rightArr));
      }
    }
    // console.log(this.mqs);
    return this.mqs(arr);
  }

  /**
   * 快速排序 - quick sort 经典实现
   */
  this.quickSort = function(myArray) {
    let arr = myArray ? myArray.slice() : array;
    // 辅助函数
    if (this.partition) {
      /**
       * 划分操作函数
       * @param arr 需要排序的数组
       * @param { num } indexL 数组左边界
       * @param { num } indexR 数组右边界
       * @returns { num } 基点的下标值 
       */
      this.partition = function(arr, indexL, indexR) {
        
      }
    }
    if (this.swap) {
      // 交换函数
      this.swap = function() {

      }
    }
    if (this.qs) {
      /**
       * 快排调度函数-主函数（入口函数）
       * @param arr 需要排序的数组
       * @param { num } indexL 数组左边界
       * @param { num } indexR 数组右边界
       * @returns { Array } 排序后的数组
       */
      this.qs = function(arr, indexL, indexR) {
        const len = arr.length;
        indexL = typeof indexL !== 'number' ? 0 : indexL; 
        indexR = typeof indexR !== 'number' ? len - 1 : indexR;

      }
    }
    return this.qs(arr);
  }
}  



/**
 * 测试工具-命名空间
 */
const testSort = {
  /**
   * 创建未排序数组(工厂)
   */
  createNonSortedArray: function(size) {
    var array = new ArrayList();
    for (var i = size; i > 0; i--) {
      array.insert(i);
    }
    return array;
  },

  /**
   * 测试代码执行器
   * @param { num } size 自动生成的排序数组长度
   * @param { func } sortFunc 排序函数（名称/句柄）
   * @param { Array } arr 自定义的需要排序的数组
   */
  execTest: function(size = 7, sortFunc, arr) {
    let array = this.createNonSortedArray(size);
    console.log(`[${sortFunc}]排序前：${array.toString()}`);
    sortFunc && (array = array[sortFunc](arr));
    console.log(`[${sortFunc}]排序后：${array}`);
    // console.log(`[${sortFunc}]时间复杂度：${array.cost}`);
  }
};

/**
 * 写一个计算时间复杂度的工具函数
 * 1- 我们应该提供某个函数每一次循环的开销 
 *  然后 该函数通过计算和逻辑 评估出该算法的复杂度 并用一个对象返回：其实有大O表示法
 * 2- 怎么计算呢 输入算法的输入值 然后统计其算法次数 然后计算之间关系
 * */


/**
 * 测试脚本
 */
// testSort.execTest(6, 'bubbleSort');
// testSort.execTest(7, 'myInsertionSort');
// testSort.execTest(7, 'insertionSort');
// testSort.execTest(7, 'myBinaryInsertionSort');
// testSort.execTest(7, 'mySelectSort');
// testSort.execTest(7, 'selectSort');
// testSort.execTest(7, 'myMergeSort');
// testSort.execTest(7, 'mergeSort');
testSort.execTest(7, 'myQuickSort');