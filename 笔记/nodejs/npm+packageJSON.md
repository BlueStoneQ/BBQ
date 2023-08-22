## peerdependence + npm i --legacy-peer-dependence
- https://juejin.cn/post/6971268824288985118
- https://juejin.cn/post/7091498178377646087
- me: 
    - peerdependence 是为了避免依赖树层级太深，将依赖的依赖声明为peerdependence后，则会被安装在同一层级
    - npm i --legacy-peer-dependence 则是忽略依赖的peerdependence，将依赖的 peerdependence 当做 dependence处理，安装在依赖同一层级下
## 直接使用git仓库安装依赖
```json
// package.json
dependence: {
    "lib": "git+git仓库http地址#分支名",
}
```