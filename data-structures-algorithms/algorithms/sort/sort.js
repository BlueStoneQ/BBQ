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
   */
  this.myInsertionSort = function(myArray) {
    var arr = myArray ? myArray.slice() : array.slice();
    for (let i = 1, len = array.length; i < len; i++) {
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
    var arr = myArray ? myArray.slice() : array.slice(); 
    for (let i = 1, len = arr.length; i < len; i++) {
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
   */
  // this.binaryInsertionSort = function(myArray) {
  //   var arr = myArray ? myArray.slice() : array.slice();
  //   for (let i = 1, len = arr.length; i < len; i++) {
  //     var 
  //   }
  // }
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
   */
  execTest: function(size = 7, sortFunc) {
    let array = this.createNonSortedArray(size);
    console.log(`[${sortFunc}]排序前：${array.toString()}`);
    sortFunc && array[sortFunc]();
    console.log(`[${sortFunc}]排序后：${array.toString()}`);
    console.log(`[${sortFunc}]时间复杂度：${array.cost}`);
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
testSort.execTest(7, 'insertionSort');

