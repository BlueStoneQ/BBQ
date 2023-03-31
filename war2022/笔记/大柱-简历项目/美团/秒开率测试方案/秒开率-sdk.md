
# 主题
- [本地源码位置](/Users/qiaoyang/code/grocery/mnpm/wxapp-fst-sdk)
- [git-ssh](ssh://git@git.sankuai.com/~xuhan02/wxapp-fst-sdk.git)
- [code](https://dev.sankuai.com/code/repo-detail/grocery/wxapp-fst-sdk/file/list)
- 接入方案
  - [微信小程序接入方案](https://km.sankuai.com/page/601848038)
  - [MMP接入方案](https://km.sankuai.com/page/601801111)
    - 集成进了MMP基础库，业务基本上不感知
```
找核心
不用太纠结于边界
me: 客观来讲 这个sdk 整体代码组织比较混乱 你吸收有益的
然后 给出自己的代码架构 更好的 而不是这种
```
-----------------------------------------------------   二期  ----------------------------------------------------- 

## 功能架构
注册模块
测速模块
上报模块

其中：测速模块是实现的核心：包括：
- 页面测速模块 - hook
- 组件测速模块 - hook
- 采样模块
## 运作流程
项目启动：注册项目信息
  - 初始化fst模块
  - 初始化组件： 对Component进行覆盖 - 对其中的setData进行拦截
页面打开的时候：对页面进行测速：通过base对pageObj进行部分属性（生命周期）的覆盖
- 页面测速点：
  - onLoad: startTime
  - onHide/onUnload: 
    - tryComputeFST
    - stopRecord
    - report
- 组件测速点：其实是中间的一系列测速点
  - setData.callback
- 页面离开的时候：对数据进行上报

有3个时间点会停止数据记录的
1. sampling: tryCompute：if targetTop > viewPortTop
  - onLoad
  - setData.callback
    - page
    - component
2. onTouch: tryCompute
3. onHide/onUnload: tr3. yCompute

而数据上报只有：onHide/onUnload

## 振幅算法
- 1. 连续3次记录速率小于 10px/100ms
- 2. 向上追溯 找到最近的一个大于这个速率的，它后面的这个就是最初的稳定点 

## 核心实现
1. 页面生命周期的拦截实现
  - 基于base纯函数
2. Web 侧：为了减少 DOM 计算对加载执行流程的影响，耗能的 DOM 计算的权重计算并非在 DOM 变化时进行的，而是放在队列中，在页面稳定后再执行。最终计算耗能 50ms 左右，带来首屏时间误差在 100ms 左右。
3. 核心数据结构设计
  ```js
  record = [
    {
      timeStamp: new Date().getTime(),
      targetTop: , // 当前靶点view的高度
    }
  ]
  ```
  - 也就是 核心的数据结构是一个队列：record
  - 每次测速实质上只是记录放到队列中
  - 等到达到end的时候 进行计算
3. 如果不足一屏，靶点元素不能推出屏幕外，则以最后一次touch作为稳定的时间
4. 对Component如何实现拦截测速
  - 在注册时 进行了Component.init
    - 重写Component(obj), 对obj中的生命周期进行拦截重写，然后将OldComponent(obj)进行返回
5. startReport
5. sampling
  - 被记录的数据data：curTimeStamp + targetTop
  - data会被送去检查: checkReachBottom
7. stopRecord
  - 关闭：this.recordEnable = false
8. tryComputeFST
  - 读取this.record 
    - 判定是否已经稳定：- 确认最后一个稳定的record是什么：
      - 逆序遍历record 直到遇到一个recordItem.targetTop - last
9. checkReachBottom
  - 判断是否: targetTop > viewPortHeight
  - 如果触底 则停止收集 - 关上开关
10. Component重写
```js
// 在fst.registe()中 会重写全局的Component 在重写的Component的attached
// 因为这个重写是在项目的onlunch中 所以 并不知道是哪个组件 只有在组件执行时 才会拿到组件的this
fst.registe = function() {

  oldComponent = Component;

  Component = function(compObj) {
    // 其实 这里就是对Compnent的输入进行一次wrap加工后 再吐给oldComponent
    const hookSetData = function() {
      const oldSetData = this.setData; // 这里的this会在hookSetData的调用环境中通过call注入
      this.setData = function(data, callback) {
        oldSetData.call(this, data, () => {
          // 重写callBack
          // 获取当前页面
          const curPage = getCurrentPages();
          // 加入注入的逻辑 - 测速
          fstReport.sampling(curPage);
          // 执行原来的callback
          callback && callback();
        });
      }
    }

    // 然后在组件的attach中执行hookSetData 会注入this
    compObj.attached = function(...args) {
      // 对setData进行hook
      hookSetData.call(this); // 这里的this就是attached的执行环境
      // 可能没声明attached
      attached && attached.call(this, args);
    }

    // return 出compObj, 因为最终小程序框架需要的是Component的执行结果
    return oldComponent(compObj);
  }
}
```
11. PageFst重写
```js
// pageFst 主要基于Base
Base = function(pageObj) {
  return pageFst(pageObj);
}

// pageFst
pageFst = function (pageObj) {
  // 拦截 重写生命周期
  const oldOnload = pageObj.onload;

  // 需要注入到onLoad中的逻辑
  const hookOnload = function() {
    // 挂载reportFst
    this.fstReport = new FstReport(this);
    // startReocord 开始记录
    this.fstReport.startRecord();
    // 重写setData
    const oldSetData = this.setData;
    this.setData = function(data, callback) {
      oldSetData.call(this, data, () => {
        // page中setData需要测速
        this.fstReport.sampling(this);
        // 有callback 则执行callBack
        callback && callback();
      });
    }
  }

  pageObj.onLoad = function(...args) {
    // 注入的测速逻辑
    hookOnload.call(this);
    // 执行原有的onLoad
    oldOnload && oldOnload.call(this, ...args);
  }

  return pageObj;
}
```


-----------------------------------------------------   一期  ----------------------------------------------------- 

## 如果你是主R 你会怎么做
1. 注册端
  - 项目启动时 app.js中 注册：appKey 环境信息等 - 在上报时需要的一些项目基础信息
  - 在app.onLunch中执行FstSDK.register({})、
  - 组件的hookInit
2. 视图层
  - 最外层增加touchstart函数 监听第一次点击
  - 增加靶点元素：业务实际容器底部
2. wrap函数 - 页面维度 - 拦截生命周期 注入测速和上报逻辑
  - 测速的实现
    - 记录打点
      - start：onLoad
        - startRecord: 设置pageStartTime
        - 获取viewPort的height 作为计算的要素
      - 中间测速采样：
        - web 可以用mutation来提供测速采样
        - onLoad：采样一次
        - 在自定义组件的setData#callBack中会有测速 [？？怎么实现的]
      - end
        - 用户第一次交互：也会认为页面可用，终止测速
        - onHide / onUnload(直接退出页面情况下): 
          - tryComputeFst
          - stopRecord: 设置开关为关闭
          - reportFst && resetFst
      - 兜底：用户第一次交互时间点：userFirstInteractiveTime: 在注入的监听onTouchStart的函数中设置
        - 此时：tryComputeFst
    - 计算 - 测速结束:最后一个测速点：
      - 组件中的setData最后一次调用
      - onHide/onUnload
      - 靶点元素超出视口：data.targetHeight > this.viewPortHeight
      - ontouchstart
  - 上报时机 和 方式
    - onHide || onUnload

4. 组件的hook - 采样：
  - 原因：无法再逻辑层直接监听微信视图的变化，而视图变化一般由setData驱动，所以再setData.callBack中进行采样
  - init：在register时 重写了组件的Component方法
  - hook
    - attached: 在attached中拦截setData
      - hook: setData
        - sampling
- [写得比较清晰，建议好好理解消化](https://km.sankuai.com/page/705733225)

### 架构组成
- 注册器
- basePage工厂
  - 拦截生命周期 模块
    - 测速采样模块（采样 计算）
    - 上报模块 - 指标上报sdk

### 核心实现
- 拦截生命周期
```js
const hookPage = funciton (pageObj) {
  oldOnload = pageObj.onLoad;
  pageObj.onLoad = funciton (...args) {
    // 注入的逻辑
    // 调用原来的onLoad
    oldOnload && oldOnload.call(this, ...args);
  }
}
```
- 测速函数实现sampling
```js
// 获取当前timeStamp
// 获取当前页面的target节点的上边界坐标 targetTop
[核心api-boundingClientRect](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.boundingClientRect.html)
// 将2个值记录到一个records
// 检查一次是否触底
```
- hook setData
```js
// 本质上就是重写setData 并挂载到组件实例上去 对setData的callBack部分进行重写
hookSetData = function() {
  const oldSetData = this.setData;
  this.setData = function(data, callBack) {
    oldSetData && oldSetData.call(this, data, () => {
      getCurPage().firstReport.sampling();
    });
  }
}
```

- checkReachBottom 检查是否触底 触底则计算出FST 等待在onHide等时机中进行上报
```js
if (this.targetTop > this.viewPortTop) {
  // 计算出fst
  this.fst = this.timeStamp - this.PageStartTime; // 单位 ms
  // 关闭测速
  this.enable = false;
}
```

- 重写Component()
```js
// register时 调用init 重写Component()
function init() {
  const oldComponent = Component;
  Component = function(obj) {
    // 注入逻辑 hook attached & hook setData
    return oldComponent(obj);
  }
}
```

### 性能数据
1. 计算FST耗时：50ms左右
  - ？？  怎么测出来的？？
    - 加入fst前后 使用console打印代替？

### 几种度量方案
- web：首屏可见元素增幅趋于稳定时刻
  - 强依赖于DOM mutaion Api 不适合小程序 小程序没有
- native：首屏可见元素填充率达标时刻
  - 消耗过高
- mrn：可见元素超出首屏时刻
  - 采用：0高度的靶点 - 由业务方自己插入到实际容器底部
- 兜底：用户交互前最后一次视图树变动时刻
  - 一般来说是不足一屏时（这种情况略微少见）

### pro方案
- 在load中 给wxml的叶子节点标记 打上靶点（视图树的叶子节点） 实现不用插入靶点
  - 这个版本就不是我负责了 后来的迭代 不问就不提这个 或者说有无更好的方案
  - 打标记采用的是loader进行打标记
- 

### TODO
1. 手写一个min-代码框架？
```js
const register = function() {}

const report

const sampling

const hookPage

const hookComponent

```

---


# 方案开发信息mock
- 开发时间：20年12月
- 开发周期：1-2 week，2个人，第一版是我
- 开发人员：
  - 技术方案：4人，交易 * 2（微信接入方案，主要是微信小程序容器难以扩展） + 容器组 * 2 （MMP接入方案）
    - MMP和微信是不同的接入方案
  - SDK开发：前面稳定版本-维护：4人
  - 我们业务提出的需求 发起的 平台给的技术方案 落地第一版我们去落地的，怎么实现 架构是我们设计的，指标方案是平台侧-容器组给的
    - MMP是容器侧落地的



## 测速方案
- 秒开 = 首屏渲染时间<1s的比率
- web首屏时间 = 首屏可见元素增幅趋于稳定的时刻 - 页面开始请求的时间
- 起点：微信 page.OnLoad

## 度量模型
### 可见元素触底模型
  - 核心思想：计算出当前页面元素第一次触底的时机 就是首屏时间
  - 边界条件：当页面元素不足一屏的时候 需要处理兜底计算逻辑
  - 适用场景：适用于流式布局
### 可见元素填充率模型
  - 核心思想：计算出页面可见元素在横轴和纵轴上的投影比率，当超过一定比率时，可以认为达到首屏
  - 边界条件：当页面元素不足一屏的时候 需要处理兜底计算逻辑
  - 适用场景：适用于所有布局
### 可见元素增幅稳定模型
  - 核心思想：计算出可见元素增幅趋于稳定的时候即达到首屏
  - 边界条件：当页面有频繁变动的元素，例如跑马灯，需要特殊处理
  - 适用场景：适用于所有布局

## 选型：
### 可见元素触底
- 其他两种，性能隐忧：主要需要检测页面所有可见元素信息，依赖于逻辑层向渲染层发送消息来查询可见元素信息，元素多且丰富的时候，查询对于性能的损耗将不可控

### 最终首屏度量方案
- 在页面底部插入一个靶点元素，计算该靶点元素的触底时间作为首屏时间
- 边界条件：当页面不足一屏的时候，回溯计算该靶点元素首次到达稳定的时间作为首屏时间
- 缺点：
  - 侵入性：需要页面手动插入一个靶点元素
    - 但是：众多页面的布局不统一 不标准化 难以自动化在合适的位置插入靶点元素
- 多靶点view度量方案
- 排除骨架屏的干扰

### SDK接入方案
- 逻辑层
  - app中声明周期注册(注册该工程的项目信息)
  - page注入
- 视图层
  - 在容器view层面 - 增加：ontouchstart事件
  - 添加靶点view

### SDK设计
#### 暴露API
- register(config)
  - 校验config
  - 初始化config
    - FSTConfig对象
  - 初始化hookComponent
- page(pageConfigJs)
  - FstPage
    - 拦截onLoad
    ```js
    pageObj.onLoad = function(...args) {
      // 注入的逻辑
      xxx
      oldOnload = obj.onLoad();
      oldOnload.call(this, ...args)
    }
    ```

### 从功能分析
- 收集注册信息（项目 + page的信息 + 线上配置信息：horn）
  - 生成实例
- 采集页面首屏时间
- 上报模块（上报至指标统计平台，这里应该是cat）
- 何时开始采集 startTime
  - 定义：report.startRecord
  - 调用：hook-page.hookOnLoad
    - onLoad
- 何时开始分析fst
  - 何时会抽样
    - onLoad
    - attached
- 何时开始上报
- horn的作用是？

拦截的page生命周期-触发点:
  - onLoad: startReCord
  - onHide: stopRecord & 上报
  - onUnload: stopRecord & 上报
    - 如果直接退出页面，不会走onHide，因此要onUnload兜底上报
  - 时间：onTouchStart:__fstBindCaptureTouchStart
    - 获取第一次交互的
    - 尝试计算
    - 停止记录
### 架构分析
```
抽出骨架和关键细节
数据流应该是：
采样 - storage - 分析（确定fst） - 上报 - 清除storage
```
- 清晰的模块划分： 注册 -（ 配置 - hook ）- 采集 - （计算） - 上报（owl）
  - 注册：主要是把信息记录到config中
  - hook: 其实是包装（pageConfig）和拦截 一些特殊时间点
  - 计算：根据采集数据去计算
- 我觉得你可以按照这个模块设计：自己去实现下 给45min实现核心
- register
  - config
  - fstHorn
  - fstComponent-init:
    - hook: attached
      - hookSetData.call ? - 应该是没抽出来
    - hook:setData
      - try sampling
- page
  - fstPage => return FstPageObj
    - 定义插入到pageObj的touchStart的handler函数
      - 即：监听插入的touchStart函数
      - onUserInteractive
        - tryComputeFst
        - stopRecord
    - hook/拦截生命周期-注入fst逻辑：
      - 生命周期拦截框架：
      ```js
      // 重新定义obj.onload
      pageObj.onLoad = function(...args) {
        xxx
        // 调用pageObj自己的onLoad
        oldPnload && oldOnload.call(this, ...args);
      }
      ```
      - hook: onLoad
        - startRecord
          - 获取 viewPortHeight
        - hook:setData.callBack
          - sampling: 在每一次setData之后 进行sampling
          ```js
          setData的hook模板：
          oldSetData = this.setData;
          this.setData = function(data, callBack) {
            oldSetData && oldSetData.setData.call(this, data, () => {
              try sampling(this);
              callBack && callBack();
            });
          }
          ```
      - hook: onHide
      - hook: onUnload
        - 尝试计算fst
        - 上报fst数据
          - owl.report
        - 重置fst数据

### 核心算法
```
页面实际容器底部的靶点元素到达页面底部或者用户点击页面进行交互前的最后一次测速作为页面可用时间
```
#### sampling
- 防御 剔除非法情况
- 获取插入的靶点view：targetView的上边界坐标数据：top
- 保存视图变更记录：this.mutaRecords.push(record)
- 判断靶点是否触底
  - target.top > viewPortHeight
    - 上锁：停止采集Fst信息
    - 更新fst: fst = timeStamp - pageStratStamp
#### tryComputeFst
- 也就是最后一个测速点：- 刚刚距离最后一个测速点超过10的测速点 作为firstStableRecord
- firstStableRecord: recordList[i] && record.targetTop - lastTopPosi > 10(px,top值上下波动10px均认为是稳定的)
- stableTimeStamp = firstStableRecord.timeStamp
- fst = stableTimeStamp - pageStartStamp
```js
const lastRecord = this.record[record.length - 1];
const recordReverse = this.record.reverse(); // 从最后面的记录开始遍历, 找到离最后节点最近的一个和最后一个record差距>10的节点，也就是稳定的起点 作为最终计算的被减数

for (const record of recordReverse) {
  if (lastRecord.targetTop - record.targetTop > 10) {
    stableTimeStamp = record.timeStamp;
  }
}
```
#### sampling调用时机
- start: startRecord -> pageStartTimeStamp
  - page.onLoad
- ing: 
  - page.setData.callback
  - component.setData.callback
- end: stopRecord
  - onUserInteractive: 插入的touch事件
  - onhide
  - onUnload

### 核心数据结构
#### record 
```
从判定触底开始：会有一系列的record值
供最后的computeFst使用
```
  - targetTop: 靶点的top值
  - timestamp: 靶点该条record的记录时间
#### recordList
- 在sampling()中生成
### 方案缺点
  - 侵入性
  - 误差？




## TODO
- [考]了解几种秒开测速的方案，并能够对比，以及最终选择主元素呈现的方案 的分析思路 
- 看懂后 自己手写一个代替的index.js（核心流程和核心边界） 替换到项目中 试试看
  - 原理学他们 核心实现 流程学他们：稿明白各个部分的作用
  - 但是 sdk架构 要有自己的设计 



## 资料
- [微信小程序接入文档](https://km.sankuai.com/page/601848038)
- [页面采集方案](https://km.sankuai.com/page/247161631)
- [FST概念](https://km.sankuai.com/page/211237707)

