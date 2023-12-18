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
