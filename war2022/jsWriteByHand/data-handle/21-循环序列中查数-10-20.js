/**
 * 20、[intermediate] 在一个循环有序的列表中查找指定的值。比如[6,7,8,1,2,3,4,5]就是一个循环有序数组。
 */
const searchVal = (arr, val) => {
  // defend
  // init data
  for (let i = 0; i < arr.length; i++) {
    if (val === arr[i]) return i;
  }
  // algo
  // return
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
  
  const searchVal1 = (arr, val) => {
    // defend
    // init data
    const len = arr.length;
    let bigArrStart = 0, bigArrEnd = 0, smallArrStart = 0, smallArrEnd = 0;
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