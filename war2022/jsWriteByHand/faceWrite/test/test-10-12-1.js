/**
 * 合并两个排好序的数组，结果仍然保持有序
输入：[1,4, 6, 9]、[2, 3, 7]
输出：[1,2,3,4,6,7,9] 
 */

const mergeSort = (arr1, arr2) => {
  // defend
  const result = [];
  const len1 = arr1.length, len2 = arr2.length;
  let index1 = 0, index2 = 0;

  while (index1 < len1 && index2 < len2) {
    const num1 = arr1[index1];
    const num2 = arr2[index2];

    if (num1 < num2) {
      result.push(num1);
      index1++;
    } else {
      result.push(num2);
      index2++;
    }
  }

  while (index1 < len1) {
    result.push(arr1[index1++]);
  }

  while (index2 < len2) {
    result.push(arr2[index2++]);
  }

  return result;
}

// test
const a1 = [1,4, 6, 9];
const a2 = [2, 3, 7];

console.log(mergeSort(a1, a2));