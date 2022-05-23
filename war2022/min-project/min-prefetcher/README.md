- register -> { path, getFetchPromiseList, option = {} }
```js
// 注册
const register = (path, getFetchPromiseList, option = {}) => {}

const getFetchPromiseList = (app, query) => getxxxprefetchList(app, query)

// 自定义的preFetch 返回值其实是一组发出去的请求promise
const getxxxprefetchList = (app, query) => {
    return [
        fetch1(params1),
        fetch2(params2),
        fetch3(params3),
    ]
}


// 获取值 在页面中
onLoad () {
    // 返回顺序 和 注册顺序保持一致
    const [ promise1, promise2, promise3 ] = await this.getPreFetchData();
    const data1 = await primse1;
}

// 解决中 不能使用all 要使用allsettled
```