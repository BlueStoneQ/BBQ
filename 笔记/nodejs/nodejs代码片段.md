## 判断路径为目录 stat + isDir
```js
fs.lstatSync(path).isDirection()
```

## 递归遍历目录
```js
// 同步版: traverse + visitor设计
const fs = require('fs');
const path = require('path');

const walk = (curPath, visitor) => {
    if (!fs.lstatSync(curPath).isDirectory()) {
        visitor.visitNode(curPath);
        return;
    }
    
    fs.readdirSync(curPath).forEach((childPath) => {
        walk(path.join(curPath, childPath), visitor);
    });
}

walk(process.cwd(), {
    visitNode(curPath) {
        console.log(curPath)
    }
});
```

## try catch block & return
```js
try {
// block1
} catch(err) {   
    return;
}

try {
// block2
} catch(err) {   
    return;
}
```