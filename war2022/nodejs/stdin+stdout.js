/**
 * process stdin stdout
 * 2023-4-16
 * https://juejin.cn/post/7111724587410259998
 */
// index.js, 或者用piple也可以处理
 process.stdin.on("data", data => {
  // 这里每次data事件的触发 是回车后
  data = data.toString().toUpperCase()
  process.stdout.write(data + "\n")
})
