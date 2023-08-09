- https://meigit.readthedocs.io/en/latest/gitlab_ci_.gitlab-ci.yml_detail.html

## image
## stages
- js项目：
- pre
- install
- post
    - TSC
    - UT
- .post
## cache
## Template
## Job
### <<
### stage
### tags
### variables
### allow_failure
### only
- refs
### when
### script
- 通过环境变量把一些参数传递给相关执行的脚本：
```yml
# gitlab-ci.yml
script:
    - CI_PIPELINE_ID=$CI_PIPELINE_ID CICD_LOG='{"status": 1}' npm run logcicd:start
```
```json
// package.json
{
    "scripts": {
        "logcicd:start": "node ./scripts/logcicd/logstart"
    }
}
```
```js
// scripts/logcicd/logstart.js
const { CI_PIPELINE_ID, CICD_LOG } = process.env

const { status } = JSON.parse(CICD_LOG)

// 上报日志
http.request({
    url: xxx,
    method: 'post',
    body: {
        pipelineId: CI_PIPELINE_ID,
        status,
    }
})
```
### 变量&常量&参数