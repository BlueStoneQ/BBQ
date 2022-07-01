/**
 * 利用promise封装一个AJAX请求
 * 2022-3-2
 * 1. readyState 的值：
    0: 请求未初始化
    1: 服务器连接已建立
    2: 请求已接收
    3: 请求处理中
    4: 请求已完成，且响应已就绪
 */
const request = (url, method = 'GET') => {
  return new Promise((resolve, reject) => {
    // 新建xhr对象
    const xhr = new XMLHttpRequest();
    // 新建一个http请求
    xhr.open(method, url, true); // true 代表异步
    // 设置状态监听函数
    xhr.onreadystatechange = function() {
      // 这里的this 就是调用方 xhr
      if(this.readyState === 4 && this.status === 200) {
        resolve(this.response);
        return;
      }
      // reject(new Error(this.statusText));
    }
    // 设置错误监听函数
    xhr.onerror = function() {
      reject(this.statusText);
    }
    // 设置响应的数据类型 这里我们先设置为json型的
    xhr.responseType = 'json';
    // 设置头信息
    // 是否携带cookie
    // xhr.withCredentials = true;
    // 一般而言，HTTP报头的名称是不区分大小写，method是区分大小写的
    xhr.setRequestHeader('Accept', 'application/json'); // accept 告诉服务端，客户端期望得到什么格式的数据， Content-Type: 告诉服务端，请求中携带的数据是什么格式的
    // 发送请求 sendd的入参 为 string 仅适用于post请求
    xhr.send();
  });
};