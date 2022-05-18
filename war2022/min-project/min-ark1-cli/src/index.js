/**
 * 只有这个文件是命令行相关
 * 其他子功能都是提供方法 - 由这里进行输入
 * 这样其他子功能还可以以api的形式提供自己的能力 或者 可以再包一层 处理下命令行相关 底层的使用纯函数处理
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { checkSelfIsNeedUpdate } = require('./utils/index');

// 设置版本号(和package.json保持同步)
program.version(pkg.version);

console.log('start!')

// 各个子命令注册 + 配置
program
  .command('init')
  .description('初始化项目代码')
  .option('-n, --project-name <name>', '项目名称')
  .action(async (...args) => {
    try {
      console.log('init start');
      // 检测版本更新
      await checkSelfIsNeedUpdate();
      console.log(args[0]);
    } catch(err) {
      console.log(err);
    }
  });

  // 注意在一个大项目中，如果涉及到一些指令的注册，请注意在所有指令注册结束后再执行 program.parse()，因为这一操作会终止参数处理，导致指令不能正确注册
  program.parse(process.argv)
