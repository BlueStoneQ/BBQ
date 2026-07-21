## 目录

- [大纲](#大纲)
- [能力模型](#能力模型)
- [Mi 项目叙事](#mi-项目叙事重点放在mi-所以写四个)
- [XC](#XCflutter--android--ios-突出双端-XC的flutter框架级方案)
- [MT](#MT-flutter--android--ios-可观测--mtflutter框架级方案)
- [国信](#国信-android--ios--前端-webview--js-bridge设计androidios--前端开发web)
- [kiro建议](#kiro建议)

---

## 大纲
1. 先业务面上, 一定要关键词:提前+突出
2. 尽量做充分周全准备,走到CEO: 李宏伟那边
3. 架构+实战+一定的虚线带队开发: 因为LN这边还有一个flutter的大前端leader岗, 管理技术一半一半:
- 你可以优先match这个大前端技术专家的画像, 也和大前leader的画像符合重叠,这样其实可以让他们觉得花一个人的钱, 找到担任两个职能的人:
    - @进一步提高你的机制性价比, 最终尽量有别的offer 哄抬到 75, 这边去冲击120, 最后只要落地超过100,都是血赚
    - 也可以要求: 可以带些人, 要到管理职能, 在除里大前端专家+架构之外, 提出也可以帮忙带人, 如果觉得带得不好, 可以再换

1. 整个简历项目叙事走双端三层+flutter
先离雷鸟专用简历大纲，关键词突出
2. MT，XC，xtransfer都换成flutter,国信换成hybrid bridge设计，项目叙事真实化
3. 还有桌面端: 确定下是flutter 桌面还是 electron, 当然, 我们还是electron@猎头
- flutter
4. XT的项目经历合并到XC, 先面得到好结果了, 再回头谈这个,先让接触到你的能力规格, 再回头破除这些繁文缛节

5. 前面36h: 达成80%的JD cover + 
- 剩下的时间, 就是不断深入, 拔高, 资深化, 专家级规格建设, 迁移,本质,非常重要
    - MT flutter
    - 闲鱼 flutter
    - 这些都是很好的素材
    - 还有动态渲染框架: 开源的库,吸收, 考虑的方面 体系化, 全面一些
- 双端三层: 是我的区别优势

6. 因为LN 不一定会约, 通过合并掉XT + 关键词突出 + resume完美契合JD, 获得一个接触业务的机会
- 当然, 也要平衡

7. 之前一定要: 
    - ⭕️必须前面集中投下flutter的岗位,一定要高密度一天3场的flutter岗练手: 不能裸上LN
        - 好比说准备: 3pd = 7:00-23:00=15h=32*30min后, 就投一波flutter练手,迅速补齐
        - 7-6 简历v3出来 就开始集中投练手+给LN(LN的手机号用180)
    - BOss上一定加上flutter的叙述
    
## 能力模型
1. 大前端靠前 + 关键技术点能够提出来: 例如skia等,FFI, 前端全栈放在第三

## Mi 项目叙事:重点放在mI, 所以写四个
1. rust/c++ - flutter 动态渲染卡片框架(flutter主力)
- 从快应用DSL 引申到 JD的动态渲染框架
- 手表侧渲染方案?
    - 提下手表侧: C++ + quickjs + LVGL的渲染卡片
2. 快应用框架: Android + C++ 主力
3. 桌面IDE: electron -> 吃透本质, 大件, 迁移到flutter 桌面端, 、
    - 就说自己做, 但是工作中, IDE用的electron
    - 核心部件, 开发全流程, 和移动端的复用方案, FFI hybrid 开发
4. 负载: 全栈+web

## XC flutter + Android + IOS: 突出双端, XC的flutter框架级方案
- XT简历就不写了,合适的部分,看看要不要合并过来
- 和无线合作
## MT: flutter + Android + IOS: 可观测 + MTflutter框架级方案
- 参考吸收下: 闲鱼的实践
    - 一套类似XRN的flutter的框架 + 包括 可观测体系
- 或者司机端:
    - 就说公司在推 MTFlutter: 说下这个是什么
- 打车主流程:最好是里面的低频业务部分
    - 就说集团19年开始基建部分,我们选择一些业务接入到flutter 
    - 主要是打车的司机端: 中后台业务用, 司机端, 看看是怎样的
        - 就是MT打车独立app部分: 司机端业务
    - Flap 动态化 开始研究，为 2020 年大规模上线做准备
- 优选手机端: 最好是里面的低频业务部分
## 国信: Android + IOS + 前端: webview + JS-bridge设计(Android/IOS) + 前端开发:web

# kiro建议

## JD 命中矩阵

| 公司 | 定位 | 命中 JD 哪条 |
|------|------|-------------|
| MI | 框架层（动态渲染 + C++ + 桌面端 + 全栈） | JD#2 Flutter跨端 + JD#4 Server-Driven UI + 加分#1 受限硬件 |
| XC | Flutter App 业务（双端） | JD#2 实际上线项目 + JD#1 独立交付模块 |
| MT | Flutter App 业务（预加载/预请求 + 共研） | JD#1 独立交付 + JD#5 推动落地 + 加分#4 |
| DFGX | Hybrid（WebView + JS-Bridge + Android/iOS） | JD#2 原生理解 + JD#3 JS/TS基础 |

## 建议

1. **MT 项目不要太轻**：加上"预加载/预请求"是对的，再加一条**性能可观测**（MTFlutter 框架下的性能指标采集），和 MI 框架层形成呼应 — MI 做框架，MT 做框架落地+业务优化

2. **XC 和 MT 差异化叙事**：
   - XC → 偏**国际化 + 多端发布 + BFF**（对应 JD 的"跨硬件规格协议复用"）
   - MT → 偏**性能优化 + 预加载 + 框架共研**（对应 JD 的"Demo快速交付 + 独立推动"）

3. **AI Agent 不要埋没**：JD 加分#3 明确写了 "了解 AI Agent、MCP 协议"。建议 MI 里加一条，或技能区单独列

4. **DFGX 2-3 行够了**：它的作用是证明"Native 原生深度" + "Bridge 设计能力"

5. **补一个 GAP 点**：流程编辑器(DAG) — 在 MI 桌面端 IDE 里提一句"节点式可视化调试流程"

6. **定位语建议**：
   > 10年大前端经验，Flutter + Android/iOS 双端三层（Flutter/Native/C++）架构师。Server-Driven UI 动态渲染框架设计者，覆盖手机/桌面/IoT 受限设备。

