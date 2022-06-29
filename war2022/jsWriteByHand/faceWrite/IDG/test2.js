/**
 * 2022-6-29
 *  [连续子数组最大和](https://leetcode.cn/problems/lian-xu-zi-shu-zu-de-zui-da-he-lcof/)
 * 方法2：DFS 枚举每个子数组情况
 * @param {*} nums 
 * @returns 
 */
const getMaxSum = (nums) => {
  const numsLen = nums.length;
  let maxSum = 0;
  let maxArr = [];

  const _getMaxSum = (path, startIndex, sum) => {
    if (startIndex === numsLen) {
      if (sum > maxSum) {
        maxSum = sum;
        maxArr = path.slice();
      }
      return;
    }

    for (let i = startIndex; i < numsLen; i++) {
      path.push(nums[i]);
      _getMaxSum(path, i + 1, sum + nums[i]);
      path.pop();
    }
  }

  _getMaxSum([], 0, 0);

  console.log('maxArr: ', maxArr);

  return maxSum;
}

// test 
const nums = [-1, 1, 2, -2, 3, 5,  -1];
console.log('getMaxSum(nums)： ', getMaxSum(nums));