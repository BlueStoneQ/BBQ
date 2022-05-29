/**
 * 一个使用node实现的简单的http服务器
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeType = {
  'html': 'text/html;charset=utf-8',
  'plain': 'text/plain;charset=utf-8'
}

const isStaticRequestPath = (reqUrl) => {
  const ext = reqUrl.split('.')[1];
  if (ext === 'html') return true;
  return false;
}

http.createServer((req, res) => {
  const routePath = req.url;
  
  if (isStaticRequestPath(routePath)) {
    // 静态文件服务器
    res.setHeader('Content-Type', mimeType['html']);
    fs.createReadStream(path.join(__dirname, routePath)).pipe(res);
  } else {
    // 接口 /login
    if (req.method === 'POST') {
      if (/^\/login/.test(routePath)) {
        let reqData = '';
        req.on('data', chunk => {
          reqData += chunk;
        });

        req.on('end', () => {
          console.log(reqData);
          res.setHeader('Content-Type', mimeType['plain']);
          res.end('post请求成功');
        });
      }
    } 
  }
}).listen(3000, () => {
  console.log('server is running on http://127.0.0.1:3000');
  console.log('you can view the login page on http://127.0.0.1:3000/form.html');
});