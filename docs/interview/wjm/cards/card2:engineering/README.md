# 🃏 牌 2：工程化全链路

> 命中 JD 第3条（CI/CD + 工程化基建）
- [cards 总览](../README.md#-牌-2工程化全链路) |

---

## 资料索引

| 主题 | 文档 |
|------|------|
| 热更新体系（灰度 + 观测 + 回滚） | [HMR.md](./HMR.md) |
| 全链路工程化详解 | [engineering-fullchain.md](./engineering-fullchain.md) |
| GitLab 与 CI/CD 体系 | [gitlab-cicd.md](./gitlab-cicd.md) |
| 上架发布（Android/iOS 坑点） | [publish.md](./publish.md) |
| 工程化 & CI/CD 场景应答 | [prep-engineering.md](./prep-engineering.md) |
| ~~安全审计体系~~ | ~~[security-audit.md](./security-audit.md)~~ |

---

## 核心内容

```
开发全链路：
  CLI 脚手架 → 调试 → 构建 → 发布 → 监控（→ 牌1） 

- 集成构建(H5 + RN + Android/IOS):
- 集成自动化测试: E2E 测试
  - android: pytest + UIautoTest
  - IOS:
  - RN ?
  - web ? play write 
- 其他角度测试覆盖: 单测

- 发布: 灰度控制方案 + 平台/工具链

质量卡控：
  ESLint + TypeScript → Git Hooks → CI 门禁 → Code Review

CD 三条线：
  H5 → CDN 灰度发布
  RN Bundle → 热更新灰度发布
  Native 包 → 商店审核发布

热更新体系：
  自建服务（Node.js）→ 灰度 → 全量 → 异常回滚
```
