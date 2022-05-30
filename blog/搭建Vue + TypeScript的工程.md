<a name="5HHp9"></a>
# 搭建
<a name="tZdZL"></a>
## vue中如何使用typeScript

1.  注意设置 `<script lang="ts">`
1. `推荐使用 vue-property-decorator 来简化书写<br />`
```javascript
<template>
  <div>
    <el-form :inline="true" :model="formInline" class="demo-form-inline">
      <el-form-item label="审批人">
        <el-input v-model="formInline.user" placeholder="审批人"></el-input>
      </el-form-item>
      <el-form-item label="活动区域">
        <el-select v-model="formInline.region" placeholder="活动区域">
          <el-option label="区域一" value="shanghai"></el-option>
          <el-option label="区域二" value="beijing"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table v-if="showTable" :data="tableData" border style="width: 100%; height: 300px;" stripe>
      <el-table-column prop="date" label="日期" width="150"></el-table-column>
      <el-table-column prop="name" label="姓名" width="120"></el-table-column>
    </el-table>
  </div>
</template>

<script lang="ts">
/**
 * 参考：https://github.com/kaorun343/vue-property-decorator
 */
import { Vue, Component } from 'vue-property-decorator'
import { testFn } from '../../utils/test'

@Component
export default class PageTs extends Vue {
  formInline = {
    user: '',
    region: 'shanghai',
  }
  showTable: boolean = true
  tableData = [
    {
      date: '2016-05-02',
      name: '王小虎',
      address: '上海市普陀区金沙江路 1518 弄'
    },
    {
      date: '2016-05-04',
      name: '王小虎',
      address: '上海市普陀区金沙江路 1517 弄'
    }, {
      date: '2016-05-01',
      name: '王小虎',
      address: '上海市普陀区金沙江路 1519 弄'
    }, {
      date: '2016-05-03',
      name: '王小虎',
      address: '上海市普陀区金沙江路 1516 弄'
    }
  ]
  onSubmit() {
    this.showTable = !this.showTable;
    const testStr = testFn(123);
    console.log(testStr);
    // this.$message(testStr)
  }  
}
</script>

<style lang="scss" scoped>
.el-table__body-wrapper {
  overflow: auto;
  position: relative;
}
</style>

```
<a name="1cf481e0"></a>
## 代码检查
<a name="f075bf29"></a>
### js的代码检查
eslint默认支持的就是js的检查
<a name="6e18b291"></a>
### vue的代码检查
vue的检查我们需要用到：

- eslint-plugin-vue
   - [支持的lint规则](https://eslint.vuejs.org/rules/)
<a name="ad33a053"></a>
### TypeScript的代码检查
我们需要使用：

- @typescript-eslint/eslint-plugin
- @typescript-eslint/parser
```javascript
  "parserOptions": {
    "ecmaVersion": 11,
    "parser": "@typescript-eslint/parser", // 这里需要用ts的parser（@typescript-eslint/parser）来代替原来的eslint用的parser，才能正常解析ts
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint" // 使用@typescript-eslint/eslint-plugin
  ],
```
<a name="tKu1R"></a>
### style代码的检查
样式代码的检查，我们主要依赖stylelint实现：

- stylelint
- stylelint-config-standard
- stylelint-scss
```javascript
module.exports = {
  'defaultSeverity': 'error',
  'extends': [
    'stylelint-config-standard',
  ],
  'rules': {
    'rule-empty-line-before': 'never',
    'function-comma-space-after': 'always',
    'selector-list-comma-newline-after': 'always',
    'color-hex-case': 'upper',
    'color-hex-length': 'long',
    'declaration-empty-line-before': 'never',
    'comment-empty-line-before': 'never',
    'block-closing-brace-empty-line-before': 'never',
    'no-eol-whitespace': true,
    'declaration-bang-space-before': 'always',
    'comment-whitespace-inside': 'always',
    'declaration-block-no-duplicate-properties': true,
    'value-list-comma-space-after': 'always',
    'font-family-no-missing-generic-family-keyword': null,
    'no-descending-specificity': null
  }
};
```
<a name="JeXxU"></a>
# 踩坑记录
<a name="FebT1"></a>
## TS的eslint配置导致vue文件的检测不生效
<a name="d303267a"></a>
### 问题：
在配置工程的eslint时，最开始我们使用了eslint --init生成默认的配置文件, 在命令行的交互式选择中，我们选择了使用TS，结果导致eslint的规则对vue文件检测有问题，配置的一些js的lint规则和vue的lint规则都无法正常生效：<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/2338408/1598492546163-ec0c4cdc-6d86-40ab-a091-b3f0c8b4a8f4.png#align=left&display=inline&height=124&margin=%5Bobject%20Object%5D&name=image.png&originHeight=248&originWidth=892&size=75561&status=done&style=none&width=446)
<a name="de842a6c"></a>
### 解决方案
该方案为尝试方案，利用改动怀疑的因素，看是否会影响问题。当时尝试去掉ts的使用，我们对生成的文件做了下处理，剔除了eslint为我们自动生成的扩展的规则集：
```javascript
"extends": [
    "eslint:recommended",
    "plugin:vue/essential",
    // "plugin:@typescript-eslint/recommended" // 去掉该规则集
  ],
```
然后，对vue的文件检测正常生效。
<a name="JkuaV"></a>
## eslint模块方案选择
<a name="5dc99f6e"></a>
### 问题
eslint --init生成默认文件时，会选择使用js的模块方案还是commonJs的模块方案，因为是单选，当我们选择了js的模块方案后，我们构建所使用的一些js文件：webpack.config.js、.eslintrc.js等，都会被eslint检测出使用了node的模块方案并在首行报错
<a name="zFxdf"></a>
### 解决方案
<a name="SAZpP"></a>
#### 方案一
为eslint的env添加node的环境选项：
```javascript
// .eslintrc.js
"env": {
    "browser": true,
    "es2020": true,
    "node": true // 增加该项开启对node环境的支持
  },
```
<a name="H3xwM"></a>
#### 方案二
在.eslintignore中添加对不需要被检测的文件的通配符名单即可

