const { program } = require('commander');
const pkg = require('../package.json');

// 设置版本号(和package.json保持同步)
program.version(pkg.version);

console.log('start!')

// 各个子命令注册 + 配置
program
  .command('init')
  .description('初始化项目代码')
  .option('-n, --project-name <name>', '项目名称')
  .action(async (...args) => {
    console.log('init start');
    console.log(args[0]);
  });

  // 注意在一个大项目中，如果涉及到一些指令的注册，请注意在所有指令注册结束后再执行 program.parse()，因为这一操作会终止参数处理，导致指令不能正确注册
  program.parse(process.argv)
