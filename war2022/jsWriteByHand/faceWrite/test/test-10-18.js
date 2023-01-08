const quickSort = (arr) => {
  // defend
  // init data
  const _getMidIndex = (subArr) => {
      return 0;
  } 
  const _part = (subArr) => {
      if (subArr.length === 0) return [];
      if (subArr.length === 1) return subArr;
      
      const leftSubArr = [], rightSubArr = [];
      const mid = _getMidIndex(subArr);
      const midVal = subArr[mid];

      for (let num of subArr) {
          if (num === midVal) continue;

          if (num < midVal) {
            leftSubArr.push(num);
          } else {
            rightSubArr.push(num);
          }
      }
      
      return _part(leftSubArr).concat([midVal]).concat(_part(rightSubArr));
  }
  // algo   return 
  return _part(arr);
}

const needSortArr = [100, 99, 123, 9999, 1, 55, 79];

console.log(quickSort(needSortArr))