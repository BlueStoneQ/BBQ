/**
 * 2022-6-29
 * [连续子数组最大和](https://leetcode.cn/problems/lian-xu-zi-shu-zu-de-zui-da-he-lcof/)
 * 方法2：DFS 枚举每个子数组情况
 * @param {*} nums 
 * @returns 
 */
 const getMaxSum = (nums) => {
  const numsLen = nums.length;
  let maxSum = 0;
  let maxArr = [];

  for (let i = 0; i < numsLen; i++) {
    let sum = nums[i];

    for (let j = i + 1; j < numsLen; j++) {
      sum += nums[j];
      if (sum > maxSum) {
        maxSum = sum;
        maxArr = nums.slice(i, j + 1);
      }
    }
  }

  console.log('maxArr: ', maxArr);
  return maxSum;
}

// test 
const nums = [-1, 1, 2, -2, 3, 5,  -1];
console.log('getMaxSum(nums)： ', getMaxSum(nums));