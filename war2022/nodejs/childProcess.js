/**
 * childProcess
 * 2023-4-16
 * https://juejin.cn/post/6844903615237193742
 */
const { spawn } = require('child_process');
const child = spawn('pwd');
// 复制代码pwd是shell的命令，用于获取当前的目录，上面的代码执行完控制台并没有任何的信息输出，这是为什么呢？
// 控制台之所以不能看到输出信息的原因是由于子进程有自己的stdio流（stdin、stdout、stderr），控制台的输出是与当前进程的stdio绑定的，因此如果希望看到输出信息，可以通过在子进程的stdout 与当前进程的stdout之间建立管道实现
child.stdout.pipe(process.stdout);
// 在Node.js代码里使用的console.log其实底层依赖的就是process.stdout