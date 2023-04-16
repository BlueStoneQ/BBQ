/**
 * 纯node实现交互式命令行
 * 2023-4-16
 * https://juejin.cn/post/7111724587410259998
 */

 // index.js
 // index.js
const readline = require("readline")

const rl = readline.createInterface({
    input: process.stdin, 
    output: process.stdout,
})

function ask(question) {
    rl.question(question, (answer) => {
        // 如果回答 q 则退出当前进程
        if(answer === "q") {
            process.exit(1)
        }
        rl.write(`The answer received:  ${answer}\n`)

        ask(question)
    })
}

ask("What is your name: ") 

 