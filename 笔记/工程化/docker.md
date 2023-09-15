# 资料
【【GeekHour】30分钟Docker入门教程】 https://www.bilibili.com/video/BV14s4y1i7Vf/?p=3&share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

# 虚拟机 Vs Docker
- 虚拟机本质上是在真实硬件和虚拟机OS中间抽象出来一层虚拟硬件层，这一层是使用软件模拟了硬件
- Docker是容器的一种实现方案

# docker-image
# docker-hub

# 安装docker
- windows需要开启Hyper-V功能

# docker架构
- CS架构
- client和server之间采用：socket/RestFul进行通信
- server: docker deamon：本质是一个后台进程
- docker命令：docker client发送给 docker server

# docker使用

# docker file
- 创建Dockerfile
- 使用sockerfile构建镜像
- 使用镜像创建和运行容器
- 在Vscode中安装docker-plugin
- 编写dockerfile
- eg: 一个简易的Dockerfile
```yml
# 指定继承镜像
FROM node:14-alpine
# 复制文件： 源路径：相对于Dockerfile: source
COPY index.js /index.js
# 执行linux命令
CMD node /index.js
```
- 构建docker-image: 通过dockerfile
```bash
# 在dockerfile所在的目录构建 hello-docker是自定义的镜像的名字
docker build -t hello-docker .
```
- 查看所有的镜像
```bash
docker iamge ls
```
- 运行镜像生成容器实例:Container
```bash
docker run hello-docker
```
- 在另一个环境中运行这个程序：
  - 复制这个docker-image过去即可
  - 共享：也可以上传该docker-image到docker-hub或者harbor镜像仓库中
- 下载docker-image: docker pull 用户名/镜像名称
- 在线运行docker: labs.play-with-docker.com

# Docker-Desktop

# 数据卷/逻辑卷：Volumes
- 持久化Docker数据的

# Docker-compose
- docker compose up // 根据docker-compose的yml配置文件 批量启动/停止docker服务
- 例如新人的环境初始化：可以直接使用docker compose up一次性自动化安装运行环境