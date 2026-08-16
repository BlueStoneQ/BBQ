# RPK Loader Contract

## 1. 结论

**Loader 只做包校验、索引解析、按需读取和版本门禁，不负责解释模板或执行页面业务。**

## 2. 加载状态机

```text
Closed
  -> Opened
  -> Verified
  -> Indexed
  -> AppLoaded
  -> PageLoaded
  -> Closed
```

任何阶段失败都进入 `Failed`，不得继续执行未验证的 Bundle。

## 3. 接口

```ts
interface RpkLoader {
  open(source: PackageSource): Promise<PackageHandle>
  verify(handle: PackageHandle): Promise<VerificationResult>
  read(path: LogicalPath): Promise<Uint8Array>
  loadApp(): Promise<AppArtifact>
  loadPage(route: string): Promise<PageArtifact>
  close(): Promise<void>
}
```

## 4. 安全与内存规则

- 只能读取 Manifest 索引声明的逻辑路径。
- 禁止路径穿越和绝对路径成员。
- IR 解析后释放原始解析中间对象。
- 页面按需读取，页面销毁后允许释放页面 IR。
- Shared Chunk 在 App Runtime 内缓存并只初始化一次。

