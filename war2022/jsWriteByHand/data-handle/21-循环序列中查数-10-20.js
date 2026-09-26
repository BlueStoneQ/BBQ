/**
 * 【题目 3.12】循环有序数组查找
 * 要求：在循环有序数组（如 [6,7,8,1,2,3,4,5]）中查找指定值并返回下标，
 *      可用二分法优化到 O(log n)。
 */

// O(log n), 看这个即可
// 主体思路：看 `mid` 和边界判断：哪一半满足有序且目标值落在其范围内，就去那一半找，否则去另一半。
const search = (nums, target) => {
    let left = 0, right = nums.length - 1

    while(left <= right) {
        const midIndex = left + Math.floor((right - left) / 2)

        if (target === nums[midIndex]) {
            return midIndex
        }

        if (nums[left] <=  nums[midIndex]) {
            // mid左侧有序
            if (target >= nums[left] && target < nums[midIndex]) {
                // target在mid的左侧内
                right = midIndex - 1
            } else {
                // 不在左侧，就在右侧
                left = midIndex + 1
            }
        } else {
            // mid右侧有序
            if (target > nums[midIndex] && target <= nums[right] ) {
                // target在mid的右侧内
                left = midIndex + 1
            } else {
                // 不在右侧， 就在另一侧
                right = midIndex - 1
            }
        }
    }

    return -1
}


/***
 * 下面的问题 是算法复杂度不到位 O(n) 不是 O(log n)，不推荐，********************** **************************************************************************************************************
 */

/**
 * 20、[intermediate] 在一个循环有序的列表中查找指定的值。比如[6,7,8,1,2,3,4,5]就是一个循环有序数组。
 */
// 二分法查找
Array.prototype.$binarySearch = function (val) {
    let left = 0, right = this.length - 1

    while (left <= right) {
        const midIndex = left + Math.floor((right - left) / 2)

        if (val === this[midIndex]) {
            return midIndex
        }

        if (val > this[midIndex]) {
            left = midIndex + 1
        } else {
            right = midIndex - 1
        }
    }

    return -1
}

(() => {
  // 二分法search
  const binarySearch = (arr, val) => {
    // defend
    const len = arr.length;
    let mid = Math.floor(len / 2);
    for (let i = 0; i < len; i++) {

      if (val === arr[i]) {
        return i;
      }

      if (val < arr[i]) {
        mid = Math.floor(i + (mid - i) / 2);
        continue;
      }

      if (val > arr[mid]) {
        mid = Math.floor(mid + (mid - i) / 2);
        continue;
      }

    }
  }
  
  // 分割成 大数组（升序）和小数组（降序） 记录2个小数组的startIndex,endIndex
  const searchVal1 = (arr, val) => {
    // defend
    // init data
    const len = arr.length;
    let bigArrStart = 0, bigArrEnd = 0, smallArrStart = 0, smallArrEnd = 0;
    // 1. 算法的缺陷：这个找分割点的行为，本身就是O(n)
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) {
        // 找到分割点
        smallArrStart = i;
        smallArrEnd = len - 1;
        bigArrEnd = i - 1;
        break;
      }
    }
  
    // val在bigArr中 则在bigArr中作二分查找
    if (val < arr[bigArrEnd] && val > arr[bigArrStart]) {
      return binarySearch(arr.slice(bigArrStart, bigArrEnd + 1), val);
    }
    // val在smallArr中 则在smallArr中二分查找
    if (val < arr[smallArrEnd] && val > arr[smallArrStart] ) {
      return binarySearch(arr.slice(smallArrStart, smallArrEnd + 1), val);
    }
    // algo
    // return
  }
})()