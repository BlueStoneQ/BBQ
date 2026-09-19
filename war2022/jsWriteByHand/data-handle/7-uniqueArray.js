/**
 * 【题目 3.2】手写实现数组去重（unique）
 * 要求：对数组去重，掌握 Set、filter+indexOf、reduce、Map 等多种实现方式。
 */

/**
 * 数组去重
 * 2022-3-25
 */

/**
 * 方法1： ES6: Set + Array.from
 */
const uniqueArray1 = (arr) => {
  return Array.from(new Set(arr));
}

/**
 * 方法2： ES5: 使用Obj的key不重复去重
 */
const uniqueArray2 = (arr) => {
  const map = {}; // Map也可以
  const res = [];

  for (const item of arr) {
    if (map[item]) continue;
    res.push(item);
    map[item] = true;
  }

  return res;
}

/**
 * [必须得掌握]算法中使用双指针去重
 * 1. 但是需要先排序 让重复的相邻在一起
 * 2. 参见：[26-删除有序数组中的重复项](https://github.com/BlueStoneQ/algorithm/blob/main/Array/easy/26-%E5%88%A0%E9%99%A4%E6%9C%89%E5%BA%8F%E6%95%B0%E7%BB%84%E4%B8%AD%E7%9A%84%E9%87%8D%E5%A4%8D%E9%A1%B9/26-removeDuplicates.js)
 */
/**
 * leet: https://leetcode-cn.com/problems/remove-duplicates-from-sorted-array/
 * Date: 2022-2-1 
 * dong: https://mp.weixin.qq.com/s?__biz=MzAxODQxMDM0Mw==&mid=2247487466&idx=1&sn=e0c21cf8c3a76cfc4844b1269b658344&scene=21#wechat_redirect
 * 类型：双指针，原地去重
 * 简单题：一般要求复杂度要尽可能的低，这也是考察的关注点
 * 数组要关注的点：是否有序 
 *  - 这道题的算法 建立在有序的基础上
 */

/**
 * @param {number[]} nums
 * @return {number}
 */
var removeDuplicates = function(nums) {
  // 防御
  if (!Array.isArray(nums)) return;
  // 初始化变量
  const numsLen = nums.length;
  let slowIndex = 0, fastIndex = 0;
  // 核心算法
  while (fastIndex < numsLen) {
    // 快指针发现不重复的元素 可以覆盖到慢指针上（因为数组有序，所以重复的元素肯定都是挨在一起的）
    if (nums[fastIndex] !== nums[slowIndex]) {
      slowIndex++; // slow要先向右移动一步 因为不移动 目前指向的元素 是重复的第一个元素 是要保留的
      nums[slowIndex] = nums[fastIndex];
    }
    fastIndex++;
  }
  // 返回结果 +1：最后一位下标比长度少1
  return slowIndex + 1;
};

// test
const arr = [1, 2, 3, 1, 2, 3, 5, 6];

console.log('uniqueArray1: ', uniqueArray1(arr));

console.log('uniqueArray2: ', uniqueArray2(arr));
