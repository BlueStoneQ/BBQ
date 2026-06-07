# NestJS

> 解决什么问题：Express/Koa 写大型 Node 服务时缺乏架构约束（代码散、依赖乱、不好测试）。NestJS 提供企业级架构（模块化 + 依赖注入 + 装饰器），让 Node BFF/中间层可维护。
>
> 本质：NestJS = Angular 的架构思想（DI + 模块 + 装饰器）搬到 Node 服务端。底层可以跑 Express 或 Fastify。
>
> 场景：DD 运营平台 BFF（多模块/多团队）、企业级 Node 中间层。

---

## 目录

- [为什么选 NestJS](#为什么选-nestjs)
- [核心概念](#核心概念)
  - [模块（Module）](#模块module)
  - [控制器（Controller）](#控制器controller)
  - [服务（Service / Provider）](#服务service--provider)
  - [依赖注入（DI）](#依赖注入di)
  - [装饰器（Decorator）](#装饰器decorator)
- [定义一个完整接口（示例）](#定义一个完整接口示例)
- [用 NestJS 做 BFF 中间层](#用-nestjs-做-bff-中间层)
- [GraphQL 集成](#graphql-集成)
- [Q&A](#qa)

---

## 为什么选 NestJS

| 对比 | Express/Koa | NestJS |
|------|------------|--------|
| 架构 | 无约束，自由组织 | 强约束（Module + Controller + Service） |
| 依赖管理 | 手动传参/全局挂载 | 依赖注入（自动解析、可测试） |
| 代码组织 | 大了就散 | 模块化隔离，按业务域划分 |
| 测试 | 难 mock | DI 天然支持 mock 替换 |
| TypeScript | 可选 | 原生设计 |
| 适合 | 小项目/简单接口 | 大型 BFF/中间层/多人协作 |

**一句话**：小项目 Express 够用，大项目/多人协作选 NestJS——它的价值不在性能，在**可维护性和团队协作约束**。

---

## 核心概念

### 模块（Module）

> Module = 功能边界。一个 Module 包含自己的 Controller + Service，对外暴露接口。

```typescript
// user.module.ts
@Module({
  controllers: [UserController],  // 该模块的路由处理器
  providers: [UserService],       // 该模块的业务逻辑
  exports: [UserService],         // 暴露给其他模块使用
})
export class UserModule {}

// app.module.ts（根模块，注册所有子模块）
@Module({
  imports: [UserModule, ArticleModule, AuthModule],
})
export class AppModule {}
```

**本质**：Module 就是代码的组织单元，类似微前端的"子应用"概念——按业务域划分，互不干扰，通过 exports/imports 声明依赖关系。

### 控制器（Controller）

> Controller = 路由层。负责接收 HTTP 请求、校验参数、调用 Service、返回响应。不含业务逻辑。

```typescript
// user.controller.ts
@Controller('users')  // 路由前缀：/users
export class UserController {
  constructor(private readonly userService: UserService) {}
  //          ↑ 依赖注入：NestJS 自动实例化 UserService 并传入

  @Get(':id')              // GET /users/:id
  getUser(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()                  // POST /users
  createUser(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
```

### 服务（Service / Provider）

> Service = 业务逻辑层。可被注入到任何 Controller 或其他 Service 中。

```typescript
// user.service.ts
@Injectable()  // 标记为可注入
export class UserService {
  constructor(private readonly httpService: HttpService) {}
  // ↑ 可以注入其他 Service（如 HttpService 调下游微服务）

  async findById(id: string): Promise<User> {
    const { data } = await this.httpService.get(`http://user-service/api/users/${id}`);
    return data;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const { data } = await this.httpService.post(`http://user-service/api/users`, dto);
    return data;
  }
}
```

### 依赖注入（DI）

> NestJS 的核心机制。你不手动 new 对象，框架根据类型自动创建并传入。

```
为什么需要 DI？

  没有 DI（Express 写法）：
    const userService = new UserService(new HttpService());  // 手动创建，手动传依赖
    const controller = new UserController(userService);       // 依赖链越长越难管理

  有 DI（NestJS）：
    你只声明"我需要 UserService" → 框架自动创建好传给你
    换实现时只改注册，不改调用方（测试时可以注入 MockService）

本质：
  DI = 控制反转（IoC）
  你不控制依赖的创建，框架控制
  你只声明需要什么，框架负责提供

好处：
  1. 解耦：Controller 不知道 Service 怎么创建的
  2. 可测试：测试时注入 Mock 替代真实实现
  3. 可替换：换数据源只改 Provider 注册，不改业务代码
```

```typescript
// 测试时的 DI 价值
const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: HttpService, useValue: mockHttpService },  // 注入 Mock
  ],
}).compile();

const service = module.get(UserService);
// service 内部的 httpService 已被替换为 mock → 不发真实请求
```

### 装饰器（Decorator）

> TypeScript 装饰器 = 给类/方法/参数附加元数据。NestJS 用装饰器声明路由、参数提取、权限等。

```typescript
// 装饰器的本质：语法糖，把"配置"写在代码旁边而不是另一个配置文件里

@Controller('users')     // 类装饰器：声明路由前缀
export class UserController {

  @Get(':id')            // 方法装饰器：声明 HTTP 方法 + 路径
  @UseGuards(AuthGuard)  // 方法装饰器：声明权限守卫
  getUser(
    @Param('id') id: string,    // 参数装饰器：从 URL params 提取
    @Query('fields') fields: string,  // 参数装饰器：从 query string 提取
  ) { ... }
}

// 等价于 Express 写法（不用装饰器）：
// router.get('/users/:id', authMiddleware, (req, res) => {
//   const id = req.params.id;
//   const fields = req.query.fields;
// })
```

**本质**：装饰器不是 NestJS 发明的能力，是让代码更声明式（"是什么"而非"怎么做"）。

---

## 定义一个完整接口（示例）

> 从请求到响应的完整链路：路由 → 参数校验 → 鉴权 → 业务逻辑 → 响应

```typescript
// 1. DTO（数据传输对象）— 参数校验
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  email: string;
}

// 2. Controller — 路由 + 鉴权 + 调用 Service
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(AuthGuard)           // 鉴权
  @UsePipes(ValidationPipe)       // 参数校验（自动校验 DTO）
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.userService.create(dto, user.id);
  }
}

// 3. Service — 业务逻辑（调下游微服务）
@Injectable()
export class UserService {
  constructor(private readonly http: HttpService) {}

  async create(dto: CreateUserDto, operatorId: string) {
    return this.http.post('http://user-service/api/users', {
      ...dto,
      createdBy: operatorId,
    });
  }
}

// 4. Module — 组织在一起
@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

---

## 用 NestJS 做 BFF 中间层

```
NestJS 做 BFF 的架构：

  前端 → NestJS BFF → 后端微服务 A/B/C

  BFF 职责（和之前 bff.md 一致）：
    - 接口聚合（一个接口调多个微服务）
    - 字段裁剪（只返回前端需要的）
    - 统一鉴权（AuthGuard）
    - 错误处理（ExceptionFilter）
    - 缓存（CacheInterceptor + Redis）
```

```typescript
// BFF 聚合示例：一个接口返回首页所有数据
@Controller('homepage')
export class HomepageController {
  constructor(
    private readonly userService: UserService,
    private readonly activityService: ActivityService,
    private readonly notifyService: NotifyService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async getHomepage(@CurrentUser() user: AuthUser) {
    // 并行调用多个下游微服务
    const [profile, activities, notifications] = await Promise.allSettled([
      this.userService.getProfile(user.id),
      this.activityService.getActive(),
      this.notifyService.getUnread(user.id),
    ]);

    // 聚合 + 降级（某个服务挂了不影响整体）
    return {
      profile: profile.status === 'fulfilled' ? profile.value : null,
      activities: activities.status === 'fulfilled' ? activities.value : [],
      notifications: notifications.status === 'fulfilled' ? notifications.value : [],
    };
  }
}
```

---

## GraphQL 集成

```typescript
// NestJS 集成 GraphQL（Code First 方式 —— 用装饰器定义 Schema）

// 1. 类型定义（等价于 GraphQL SDL 的 type User）
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [Article])
  articles: Article[];
}

// 2. Resolver（等价于 resolvers 对象）
@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => User)
  async user(@Args('id') id: string) {
    return this.userService.findById(id);
  }

  @ResolveField(() => [Article])
  async articles(@Parent() user: User) {
    return this.articleService.findByUserId(user.id);
  }
}
```

**NestJS GraphQL 的优势**：不用手写 SDL 字符串，用 TypeScript 类 + 装饰器定义类型，编译时自动生成 Schema。类型安全 + 代码即文档。

---

## Q&A

**Q：NestJS 的 DI 是怎么实现的？**

A：利用 TypeScript 的 `emitDecoratorMetadata` 编译选项——编译时把类型信息记录为元数据（Reflect.getMetadata），运行时框架读取元数据，知道构造函数需要哪些参数类型，自动从 IoC 容器中查找并注入。

**Q：NestJS 和 Express 的关系？**

A：NestJS 底层默认用 Express（也可切换为 Fastify）处理 HTTP。NestJS 是"Express 之上的架构层"——你不直接写 `app.get()`，而是用 Controller/Decorator 声明路由，NestJS 编译为 Express 路由。

**Q：装饰器会影响性能吗？**

A：不会。装饰器在编译时执行（注册元数据），运行时只是读取元数据做路由映射。和手写 `router.get()` 本质一样，只是写法更声明式。

**Q：NestJS 适合做什么不适合做什么？**

A：适合：BFF/中间层、企业级 API、微服务网关。不适合：极简接口（3-5 个 API 用 Express 更快）、纯静态站点、Serverless 函数（冷启动慢）。

**Q：在 DD 场景下 NestJS 怎么用？**

A：运营平台 BFF——每个业务域一个 Module（活动/策略/用户），统一鉴权用 Guard，接口聚合用 Service 并行调下游微服务 + Promise.allSettled 降级。GraphQL 用 Code First 方式定义 Schema。
