/**
 * 6-29
 * 
 * 1. 二叉树的中序+非递归遍历 
 * 2. [连续子数组最大和](https://leetcode.cn/problems/lian-xu-zi-shu-zu-de-zui-da-he-lcof/)
 */

/**
 * [连续子数组最大和](https://leetcode.cn/problems/lian-xu-zi-shu-zu-de-zui-da-he-lcof/)
 * 方法1：滑动窗口 - 这个算法应该是没问题的
 * @param {*} nums 
 * @returns 
 */
const getMaxSum = (nums) => {
  // defend
  // init data
  let maxSum = 0;
  let sum = 0;
  let left = 0, right = 0;
  // algo
  while (right < nums.length) {
    const willInNum = nums[right];
    sum += willInNum;
    if (sum > maxSum) {
      maxSum = sum;
    }

    console.log('right: ', right);
    console.log('sum: ', sum);

    while (left < right && willInNum < 0 && nums[left] < 0) {
      const willOutNum = nums[left];
      console.log('willOutNum: ', willOutNum);
      sum -= willOutNum;
      if (sum > maxSum) {
        maxSum = sum;
      }
      left++;
    }

    right++;
  }
  // return 
  return maxSum;
}


// test 
const nums = [-1, 1, 2, -2, 3, 5,  -1]; // expect 9
console.log('getMaxSum(nums)： ', getMaxSum(nums));