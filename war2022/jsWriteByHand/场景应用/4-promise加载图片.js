/**
 * 【题目 4.8】Promise 加载图片
 * 要求：实现 loadImg(url) 返回 Promise，图片 onload 时 resolve、onerror 时 reject。
 */

/**
 * 用Promise实现图片的异步加载
 * 2022-6-16
 */
const loadImg = (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = res => {
      resolve(res);
    };

    img.onerror = err => {
      reject(err);
    };

    img.src = imgUrl;
  });
}

// test
loadImg('http://zzz/xxx.png').then(res => {
  console.log('加载成功');
}).catch(err => {
  console.log('加载失败');
});
