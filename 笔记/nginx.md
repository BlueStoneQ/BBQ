# 资料
【【GeekHour】30分钟Nginx入门教程】 https://www.bilibili.com/video/BV1mz4y1n7PQ/?share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

# 进程模型
- S-M

# 部署
- 静态页面部署：本质上就是将静态页面复制到server.location指定的目录下即可

# 配置文件
- nginx -t : 查看配置文件位置，检查配置文件是否正确
- nginx --conf-path= : 指定配置文件位置
- nginx -s reload: 修改之后必须加载一下
```yml
# 全局块
worker_processes auto; # 进程数量采用自动匹配cpu核数
# events块
# http块
# - http全局块
# - 多个server块
```

# 反向代理
- 代理的是服务器，我们还是访问google，但是直接到了反向代理，反向代理会转发给google
- nginx配置文件：
```yml
http {
  upstream backend {
    ip_hash;
    server 127.0.0.1:8000 weight=3; # 默认weight为1
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
  }

  server {
    listen 80;
    server_name localhost;

    location /app {
      proxy_pass http://backend;
    }
  }
}
```
- 此时 访问：localhost/app 访问就会被代理到    server 127.0.0.1:8000; server 127.0.0.1:8001; server 127.0.0.1:8002;
  - 默认负载均衡策略是轮询
  - 负载均衡策略：
    - 使用weight可以调整负载均衡策略：weight越大 被分配到的请求次数越多
    - ip_hash : 解决session相关的一些问题，将同一个请求始终发送到同一台服务器上

  
# https
- https证书：
  - 通过云 或者 openssl:
  - 生成private.key + pem（证书文件）
- naginx.conf
```yml
server {
  listen 443 ssl;
  # 配置证书文件路径
  ssl_certificate /opt/homebrew/etc/nginx/cacert.pem;
  # 配置私钥文件路径
  ssl_certificate_key /opt/homebrew/etc/nginx/pricate.key;
  # 其他https的配置一般是固定的

  # 一般会配置一个重定向 让http请求自动跳转到https
  server {
    listen 80;
    server_name geekHour.xx.cn;
    return 301 https://$server_name$request_uri;
  }
}
```
- https访问

# 虚拟主机
- 使用虚拟主机在一台服务器上部署多个站点
- 每个server块就是一个虚拟主机
- server_name就是虚拟主机的域名
