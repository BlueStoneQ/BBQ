# class中的get set拦截器
- https://blog.csdn.net/qq_30100043/article/details/53542920
```js
class A {
    constructor () {
        this.array = []
    }

    get length() {
        return this.array.length
    }

    set length(len) {
        return this.array.length = len
    }
}

new A().length
new A().length = 10
```