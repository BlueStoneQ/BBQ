const app = require('http');

app.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
}).listen(8124, '127.0.0.1');

console.log('argv: ', process.argv);

console.log('Server running at http://127.0.0.1:8124');
