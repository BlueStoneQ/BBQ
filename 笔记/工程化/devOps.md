# 资料
- [devOps应该会什么](https://zhuanlan.zhihu.com/p/370244302)
- 【超神DevOps攻略！一键化部署，实现全自动操作，让你的项目飞起来！】 https://www.bilibili.com/video/BV16X4y1W7jS/?share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

# devOps技术栈和工具链

版本控制&协作开发：GitHub、GitLab、BitBucket、SubVersion、Coding、Bazaar

自动化构建和测试:Apache Ant、Maven 、Selenium、PyUnit、QUnit、JMeter、Gradle、PHPUnit

持续集成&交付:Jenkins、Capistrano、BuildBot、Fabric、Tinderbox、Travis CI、flow.ci Continuum、LuntBuild、CruiseControl、Integrity、Gump、Go

容器平台: Docker、Rocket、Ubuntu（LXC）、第三方厂商如（AWS/阿里云）

配置管理：Chef、Puppet、CFengine、Bash、Rudder、Powershell、RunDeck、Saltstack、Ansible

微服务平台：OpenShift、Cloud Foundry、Kubernetes、Mesosphere

服务开通：Puppet、Docker Swarm、Vagrant、Powershell、OpenStack Heat

日志管理：Logstash、CollectD、StatsD

监控，警告&分析：Nagios、Ganglia、Sensu、zabbix、ICINGA、Graphite、Kibana

# docker安装
- docker
- docker-compose : 简单业务可以用的docker的编排工具，在github上下载
```bash
yum -y install yum-rtils device-mapper-persistent-data lvm2
```
# gitlab安装
- 编辑docker-compose.yml
```yml
version: '3.1'
services:
    gitlab:
        image: 'gitlab/gitlab-ce:latest'
```
- 安装gitlab
```bash
docker seach gitlab
docker pull gitlab/gitlab-ce:latest
vim docker-compose.yml
# 编辑结束后, 启动gitlab
docker-compose up -d 
```
- 浏览器访问gitlab
    - 192.168.11.101:

# jenkins
- 源码是java, 以来JDK 和 maven
- 需要下载大量插件 1800多个插件
- 下载LTS版本：长期支持版本
- 如果jenkins下载慢，则换下镜像源
- 插件：
    - Git Parameter
    - Publish Over SSH
    - Git : jenkins从gitlab上拉取代码，拥有了Git命令
- jenkins配置：jdk maven
    - maven是jenkins构建java需要的
    - 前端需要不同的构建器
- 配置目标服务器：构建结果push到目标服务器上
- 
