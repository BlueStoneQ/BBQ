## 参考
- [在dev-server中添加mock中间件](https://juejin.cn/post/6870326520246697997)

## 基于thrift 接口描述文件idl生成mock数据
- idl会打包到本地node_modules中，可以选择对应的idl文件
- 读取文件内容source -> idl-parser -> idl-ast 
-> idl-tansform阶段，用visitor取得每个节点的数据，生成flat形式的json-tree 
-> 然后用flatTree生成树形json的算法生成mockjs的描述数据mockSchema 
-> mockjs(mockSchema) -> mock-data
-> 可以 二次编辑 + 持久化到本地（json文件形式）