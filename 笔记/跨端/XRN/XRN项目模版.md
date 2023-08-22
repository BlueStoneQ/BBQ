# 概览
- 梳理下:吃透整个RN-bundle项目：从整体角度理解一个工业级项目：
    - CICD
        - 全流程
        - test流程
        - 其他子job
    - React + context + useReducer
    - router
    - RN动画
    - 静态资源：
        - 图片
        - 字体图标
        - 字体
    - fetch请求方案
    - TS
    - build
    - 埋点
    - 
- 全链路理解一个CRN项目：工业级的RN项目：web项目:(达到有方案 有视野 有最佳实践落地能力):结构化梳理：梳理&吸收@BBQ笔记：
    - 开发前：基建：cli + 规范 项目模版
    - 开发中：调试方案： RN CRN
    - 开发后：CICD 监控：异常 性能 埋点 排障：流量回放 
    - 性能优化：
    - 包体积优化：
```目录设计
# 功能架构：目录结构设计
## @types
## .__tmp
## fonts
## images
## lottie
## scripts
## tsconfig.json
## .prettierrc
## .gitlab-ci.yml
## metro.config.js
## jest.config.js
## jest.setup.js
## shark.config...
# src目录结构设计
## main.js
## index.ios.js & index.android.js
## pages : page1...pageX
### PageIndex.tsx
### container
### components
### context
### reducer
### state
### type
- enum
- interface
## components
## hooks
## service
## utils
## handler
- 与业务相关的utils
- 一些可以抽取出来的 复用的业务相关的逻辑
## type
### interface
### enum
### d.ts
## config
## 路由
## fetch
# 优化
```

# 工程化

# 功能架构：目录结构设计
## @types
## .__tmp
## fonts
## images
## lottie
## scripts
## tsconfig.json
## .prettierrc
## .gitlab-ci.yml
- https://meigit.readthedocs.io/en/latest/gitlab_ci_.gitlab-ci.yml_detail.html
- [gitlab-ci笔记](笔记/工程化/CICD/gitlab-ci.yml.md)
- pre
    - LogCICD Start
    - Install
        - npm i
    - ~~MCD UAT AUTO Publish~~
        - ~~某些特殊环境 触发publish~~
- build
    - TSC:
        - cicdtsc
        - logcicd
    - ESLint
        - lint
        - logcicd
    - UT
- post
    - coverage check
    - MCD Light Publish
- .post
    - LogCICD End
## metro.config.js
## jest.config.js
## jest.setup.js
## shark.config...
# src目录结构设计
## main.js
## index.ios.js & index.android.js
## pages : page1...pageX
```
典型react项目元素
```
### PageIndex.tsx
### container
### components
### context
### reducer
### state
### type
- enum
- interface
## components
## hooks
## service
## utils
## handler
- 与业务相关的utils
- 一些可以抽取出来的 复用的业务相关的逻辑
## type
### interface
### enum
### d.ts
## config
## 路由
## fetch
# 优化