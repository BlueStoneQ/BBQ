# 参考
- https://cloud.tencent.com/developer/article/2228412
- 

# 实现载体
- taro-plugin
- taroXRN组件库
- metro-config

# 动作时机
- metro build过程中

# 产物
- target 可以跑在XRN容器中

# 核心实现
- 样式文件 -> style transformer(rm-style-transform + babel-plugin-transform-react-jsx-ro-rn-stylesheet)
- 代码文件 -> code transform(babel)