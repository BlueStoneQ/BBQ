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

// 设计稿适配方案：动态设置rem 本质上是用rem模拟vw 让1rem始终等于10vw
// 设置font-size rem单位值
const docEl = document.documentElement;
// 其实 如果你的设计稿宽度是320px，你的一个元素的宽度是10px，则你写的时候 写成1rem即可
// 其实 要满足这样一个等式：设计稿元素width / 设计稿宽度（320px） =  真实设置的元素width / clientWidth
const fontSize = 10 * (docEl.clientWidth / 320) + 'px'; // 这样：你设置为设计稿0.1倍即可，例如设计稿：4px, 你实际设置的就是 0.4rem，这里得出1rem = 等于多少
docEl.style.fontSize = fontSize;