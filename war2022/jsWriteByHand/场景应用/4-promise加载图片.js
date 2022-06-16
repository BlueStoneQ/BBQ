/**
 * 用Promise实现图片的异步加载
 * 2022-6-16
 */
const loadImg = (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve();
    };

    img.onerror = () => {
      reject();
    };

    img.src = imgUrl;
  });
}

// test
loadImg('http://zzz/xxx.png').then(() => {
  console.log('加载成功');
}).catch(() => {
  console.log('加载失败');
});
