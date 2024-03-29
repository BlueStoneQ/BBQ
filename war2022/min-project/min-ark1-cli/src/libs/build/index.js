/**
 * 构建
 * 1. 这里暂时是把sourceDir中的文件copy一份到targetDir中或者重写targetDir中已有的文件 中间暂时不做任何处理
 * 2. build的粒度为文件 或者 目录
 * 3. 先从简
 */
const path = require('path');
const fs = require('fs-extra');
const cwd = process.cwd();
const TARGET_DIR = path.join(cwd, '.dist-data');

module.exports = async (sourceDir, targetDir = TARGET_DIR) => {
  // 这里是一个src->.dist-data的目录级复制 后续再build逻辑完善后 应该是build后更新到具体文件
  await fs.copy(sourceDir, targetDir, {
    overwrite: true
  });
}