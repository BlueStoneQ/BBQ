 3 种常见技术栈的**复制即用方案**，挑自己项目里适合的:


### ✅ 1. 前端通用（ESLint + Prettier）
#### 安装
```bash
npm i -D eslint prettier eslint-config-prettier eslint-plugin-prettier
```

#### package.json 一键脚本
```jsonc
{
  "scripts": {
    "lint":        "eslint 'src/**/*.{js,ts,tsx}' --max-warnings 0",
    "lint:fix":    "npm run lint -- --fix",
    "format":      "prettier 'src/**/*.{js,ts,tsx,css,md,json}' --write",
    "lint-all":    "npm run lint:fix && npm run format"
  }
}
```
使用  
```bash
npm run lint-all      # 一键修复 + 格式化
```

---

### ✅ 2. Husky + lint-staged（提交前自动跑）
#### 安装
```bash
npx mrm@2 lint-staged
```
#### 自动生成的 `.lintstagedrc.json`
```json
{
  "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,md,json}": ["prettier --write"]
}
```
以后只要 `git commit`，就**自动**对改动的文件跑 lint + prettier，无需手动“一键”。

---

### ✅ 3. VS Code 一键快捷键（保存即修复）
1. 安装插件 **ESLint**、**Prettier**  
2. 设置 `settings.json`
```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```
以后按下 `Ctrl+S`（保存）即等于“一键”修复。

---

### ✅ 4. 后端 / 其他语言
| 语言     | 工具链          | 一键命令示例                         |
|----------|-----------------|--------------------------------------|
| Python   | black + flake8  | `black . && flake8 .`                |
| Go       | gofmt + golint  | `gofmt -w . && golint ./...`         |
| Rust     | cargo-fmt + clippy | `cargo fmt && cargo clippy --fix` |

---

### ✅ 最后检查
把脚本放到 CI（GitHub Actions / GitLab CI）里，**真正的一键**连服务器都帮你跑：
```yaml
# .github/workflows/ci.yml
- name: Lint & Format Check
  run: |
    npm ci
    npm run lint-all
```

---

**结论**：  
- **本地开发** → 用 `npm run lint-all` 或 VS Code 保存即修复。  
- **团队协作** → 用 Husky + lint-staged，提交前自动跑。  
- **CI/CD** → 把脚本写进流水线，每次 push 都自动检测。