/**
 * 排序
 * 1- 利用一个数组列表对象承载我们的排序算法
 * 2- 审题 - 思维模型 - 代码落地
 * 3- 自己先思考给出实现 然后再对照下书中的实现
 * 4- 默认实现-从小到大
 */

function ArrayList() {
  
  var array = [];
  /**
   * 记录一个排序总共的遍历次数
   */
  this.count = 0;

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
   */
  this.bubbleSort = function() {
    const len = array.length;
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < len; j++) {
        this.count++;
        if (array[j] > array[j+1]) {
          swap.call(this, j, j+1);
        }
      }
    }
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
   */
  execTest: function(size = 7, sortFunc) {
    let array = this.createNonSortedArray(size);
    console.log(`[${sortFunc}]排序前：${array.toString()}`);
    sortFunc && array[sortFunc]();
    console.log(`[${sortFunc}]排序后：${array.toString()}`);
    console.log(`[${sortFunc}]比较次数：${array.count}`);
  }
};

/**
 * 测试脚本
 */
testSort.execTest(6, 'bubbleSort');


