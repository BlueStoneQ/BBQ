const { spawn } = require('child_process');

const spwanObj = spawn('ping', ['127.0.0.1']);

spwanObj.stdout.on('data', (chunk) => {
  console.log(chunk.toString());
});

spwanObj.stderr.on('data', (chunk) => {
  console.log(chunk.toString());
});


