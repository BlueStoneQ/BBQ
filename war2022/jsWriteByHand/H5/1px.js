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

// 设置font-size rem单位值
const docEl = document.documentElement;
const fontSize = 10 * (docEl.clientWidth / 320) + 'px';
docEl.style.fontSize = fontSize;