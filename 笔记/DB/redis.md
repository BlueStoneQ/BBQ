# 资料
- 【【GeekHour】一小时Redis教程】 https://www.bilibili.com/video/BV1Jj411D7oG/?share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233
- 【【狂神说Java】Redis最新超详细版教程通俗易懂】 https://www.bilibili.com/video/BV1S54y1R7SB/?p=4&share_source=copy_web&vd_source=daeaf2f951ad6eacf4cc7d9c4da82233

# 概览
- no sql： not only sql
- remote dictionary server
- 基于内存
- 应用：DB cache MQ
- noSQL
- 数据库的性能瓶颈：磁盘IO
- 使用方式：
  - cli
  - api
  - GUI
- 启动服务：前台运行：redis-server
- 启动客户端：redis-cli
- gui: redisinsight
- host+port： 就是可以确定一个DB服务
- 存储形式：k-v

# 命令行
- SET GET DEL 
- EXISTS KEYS  FLUSHALL 
- SET key value
- key区分大小写
- 默认使用字符串作为类型存储数据，二进制安全（以二进制形式存储）
- 默认不支持中文
  - redis-cli启动 则显示的中文是二进制的十六进制表示
  - redis-cli --raw // 指定以原始的样子现实，就可以显示中文内容了
- 过期时间
  - TTL key // 查看key的过期时间
  - expire key 10 // 设置key的过期时间为10s
  - SETEX name 5 一键三连 // 设置name的值为5，过期时间为5s
  - SETNX // 只有当key不存在时才设置key-value

# list
- 可以实现MQ： 消息队列
- LPUSH
- LPOP
- RPUSH
- RPOP
- LRANGE
- LLEN
- LTRIM

# Set
- 无序，不重复
- SADD
- SMEMBER
- SISMEMBER
- SREM
- 集合运算

# Geospatial
- redis 3.2之后
- 作用：
  1. 存储地理位置信息 
  2. 计算地理位置相关信息：城市之间距离 城市附近的多少千米以内的城市查询等
- 增
- 删
- 改
- 查

# Bitmap
- 字符串类型的扩展，使用一个string类型来模拟一个bit数组
- 作用：
  - 只记录0/1, 支持位运算
  - 记录用户的用户签到情况/在线状态/是否点过赞

# Bitfiled
- 可以将很多整数存储到一个较大的位图中，更高效地使用内存
- Bitfiled VS BitMap
  - Bitfiled存储的数字，BitMap存储的是单个位，只有0/1值
# 事务
- 一次执行多个命令
  - 但是不保证原子性
- MULTI  + EXEC/DISCARD

# 持久化
- RDB：redis dataBase
  - 适合定期备份
- AOF: append only file
  - 每次写入内存数据时，会在一个文件中记录一条写日志，redis启动时可以根绝这个记录文件来重建redis的内存数据
  - 开启：redis.conf中 appendonly yes，重启redis

# 主从复制
- 主（写） -> 从（读）
- 配置方法:
  - redis.conf
    - 改动port 
    
# 哨兵模式
-  