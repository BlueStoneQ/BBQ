/**
 *  九坤-笔试
 *  2022-5-12
 *  1. 实现一个函数，这个函数从一个多维数组中查询指定维度的一个项，并返回，多维数组维数不定
 * 
 *  me: 其实 可以参考 lodash.get的实现
 */

/**
 * 参考lodash.get 这里我们只实现Array的链式取值
 * @param {*} arr 
 * @param {*} path '1.2.3' 例如：取[[][2, 3, [1, 2, 3, 4]]]的'1.2.3' 就是取 4
 * @param {} defaultVal 如果沿着path找不到合法值 则返回指定的defaultValue
 */
const getArrayItem = (arr, path, defaultVal = undefined) => {
  // 1. 没有path的话 arr直接返回
  if (!path) return arr;
  // 检查参数 不合规(必须是字符串或者数组) 则抛出error
  if (typeof path !== 'string' && !Array.isArray(path)) {
    throw new TypeError('expect typeof of \"path\" to be \"Array\" of \"string\"');
  }
  // 格式化path为数组 后面统一用数组参与逻辑
  if (typeof path !== 'array') {
    path = path.split('.');
  }

  let result = arr.slice(); // 避免引用类型污染 - 污染原数组

  for (const p of path) {
    // 如果path中断了 则返回
    if (result[p] === undefined) {
      result = defaultVal;
      break;
    }
    result = result[p];
  }

  return result;
}


/**
 * test
 */

const arr = [0, [1, 2, [3, 4, 5, 6]]];
console.log(getArrayItem(arr, '1.2.3'));


/********************   答题版 5-26 ****************** */

Array.prototype._get1 = function (layer) {
  layer = +layer;
  let result = this;

  while (layer >= 0) {
    const curVal = result ? result[0] : null;
    if (curVal || curVal === 0) {
      result = curVal;
    } else {
      return;
    }

    layer--;
  }

  return result;
}


// test1
const arr1 = [[[1]]];
console.log('arr._get1(2): ', arr1._get1(2)); // expect 1


Array.prototype._get2 = function (layers) {
  let result = this;

  for (let layer of layers) {
    const curVal = result ? result[layer] : null;
    if (curVal || curVal === 0 || curVal === '') {
      result = curVal;
    } else {
      return;
    }
  }

  return result;
}

console.log('arr._get2(2): ', arr._get2([0, 0, 0])); // expect 1
