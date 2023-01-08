/**
 * 字符串去除相邻的重复项
 * 输入：aabbccddeexxxxaa，输出：abcdexa
 */
// const uniq1 = (str) => {
//   const set = new Set();

//   for (let char of str) {
//     set.add(char);
//   }

//   return Array.from(set).join('');
// }

const uniq = (str) => {
  // defend
  // init data
  const arr = str.split('');
  let fastIndex = 0, slowIndex = 0;
  // algo
  while (fastIndex < str.length) {
    if (arr[slowIndex] !== arr[fastIndex]) {
      slowIndex++;
      arr[slowIndex] = arr[fastIndex];
    }

    fastIndex++;
  }
  // return 
  return arr.slice(0, slowIndex + 1).join('');
}


const s = 'aabbccddeexxxxaa';
console.log(uniq(s));
