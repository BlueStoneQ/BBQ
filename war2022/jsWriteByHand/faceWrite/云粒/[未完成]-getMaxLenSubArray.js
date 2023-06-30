/**
 * [未完成]手写-一个数组中最长的连续子数组
 * 2022-5-30
 * - 滑动窗口
 */


/**
 * 左右指针向中心靠拢 + 找到的第一个连续的数组就是最长的连续数组
 * @param {*} arr 
 * @returns 
 */
 const getMaxLenSubArray = (arr) => {
   // defend
   // init data
   let startIndex = 0, endIndex = 0; // 要截取一段数组 必须知道左右边界index
   let leftIndex = 0, rightIndex = arr.length - 1; // 动态index
   // 判断这一段数组是否是连续的
   const isSeries = (arr) => {
     // 判断相邻的两个元素 如果a[i + 1] !== a[i] + 1 的话 则就不连续
     for (let i = 0; i < arr.length - 1; i++) {
       if (arr[i + 1] !== arr[i] + 1) return false;
     }

     return true; // 经过上面检查 就是连续的
   }
   // algo
   while (leftIndex < rightIndex) {
     const subArr = arr.slice(leftIndex, rightIndex);
     if (isSeries(subArr)) return subArr;
   }
   // return
   return 
 }
/**
 * test
 */
const arr = [2, 3, 4, 2, 3, 5, 6 ,7, 8, 9 , 10, 1, 2, 4];
console.log(getMaxLenSubArray(arr)); // expect [5, 6 ,7, 8, 9, 10]