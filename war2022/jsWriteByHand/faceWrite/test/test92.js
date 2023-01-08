Map.prototype.$addCount = function (key, count = 1) {
  const originalCount = this.get(key) || 0;
  this.set(key, originalCount + count);
}

const isUnic = (arr, target) => {
  // defend
  // init data
  const len = arr.length;
  const map = new Map();
  // algo
  for (let i = 0; i < len; i++) {
    const num1 = arr[i];
    for (let j = i + 1; j < len; j++) {
      const num2 = arr[j];

      if (num1 + num2 === target) {
        map.$addCount([num1, num2].toString());
      }
    }
  }

  console.log('map: ', map);

  const keys = Object.keys(map);

  console.log(keys);

  if (keys.length === 1) {
    const k = keys[0];
    if (map.get(k) === 1) return k;
  }

  return false;
}

// test
console.log(isUnic([0,1,2,3, 3,4,8,10,12], 3));


while (right > left) {
  // 一致判断
  while (arr[right] === curRightVal) right--;
  while (arr[left] === curLeftVal) left++;
}

