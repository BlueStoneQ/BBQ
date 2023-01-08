function getSwapIndex (index) {
  return Math.floor(Math.random() * index);
}

const swap = (arr, index1, index2) => {
  arr[index1] = arr[index1] + arr[index2];
  arr[index2] = arr[index1] - arr[index2];
  arr[index1] = arr[index1] - arr[index2];
}

const swap1 = (arr, index1, index2) => {
  arr[index1] = arr[index1] ^ arr[index2];
  arr[index2] = arr[index1] ^ arr[index2];
  arr[index1] = arr[index1] ^ arr[index2];
}

const unSort = (arr) => {
  const len = arr.length;
  let index = len - 1;
  while (index >= 0) {
    const swapIndex = getSwapIndex(index);
    swap(arr, swapIndex, index);
    index--;
  }
}