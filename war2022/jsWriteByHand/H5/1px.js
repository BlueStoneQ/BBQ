/**
 * H5移动端
 * 1px解决方案
 */

/**
 * 方法1： viewport + rem
 */
// 根据devicePixelRatio设置viewport

const dynamicSetViewport = () => {
    const viewportEl = document.querySelector("meta[name=viewport]");
    const scaleRate = '' + (1 / window.devicePixelRatio).toFixed(8);
    viewportEl.setAttribute(`content`, `width=device-width, initial-scale=${scaleRate}, maximum-scale=${scaleRate}, minimum-scale=${scaleRate}, user-scalable=no`);
}

dynamicSetViewport();

// 设计稿适配方案：动态设置rem
// 设置font-size rem单位值
const docEl = document.documentElement;
// 其实 如果你的设计稿宽度是320px，你的一个元素的宽度是10px，则你写的时候 写成1rem即可
// 其实 要满足这样一个等式：设计稿元素width / 设计稿宽度（320px） =  真实设置的元素width / clientWidth
const fontSize = 10 * (docEl.clientWidth / 320) + 'px';
docEl.style.fontSize = fontSize;