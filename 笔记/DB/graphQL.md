# 资料
- https://www.bilibili.com/video/BV13e4y1278j

# 概述
- 查询语言
- 数据查询的运行时
- restFul用不同的uri来区分资源，graphQL用类型区分

# graphQL：server端
- mongoDB
- 启动DB
- 链接DB
```js
// db.js
const koa = require('koa');
const { buildSchema } = require('graphql');
// const graphqlHTTP = require("express-graphql");
const { graphqlHTTP } = require('koa-graphql'); // koa中使用koa-graphQL
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/maizuo');
```
- 通过graphQL操作
    - 创建模型
    - 操作模型
```js
const filmModel = mongoose.model("film", new mongoose.Schema({
    name: String,
    poster: String,
    price: Number
}));

//  graphQL Schema定义: 定义查询语句和类型
const graphQLSchema = buildSchema(`{
    type Film{
        name: String,
        price: Int
    }

    type Query{
        getNowplayingList: [Film]
    }

    type Mutation{
        createFilm(input: FilmInput):Film,
        updateFilm(id: String, input: FilmInput):Int,
        deleteFilm(id: String!):Int
    }
}`) // mutation中的resolver是串行执行的；query中的任务是并发查询的


// 定义graphQL resolver
const root = {
    // 查
    getNowplayingList() {
        return FilmModel.find();
    },

    // 增: graphQL支持return一个promise对象
    createFilm({input}) {
        return FilmModel.create({
            ...input,
        });
    },

    // 改：更新_id === id的数据为...input
    updateFilm({id, input}) {
        return FilmModel.updateOne({
            _id: id,
        }, {
            ...input
        }).then(res => {
            // Mongoose默认update后不会返回该数据，所以这里从新在DB中查询下返回修改后的数据
            FilmModel.find({ _id: id }).then(item => item.id !== id);
        });
    },

    // 删
    deletFilm({ id }) {
        return FilmModel.delete({ _id: id }).then(res => 1);
    },
}

const app = koa();
//  graphqlHTTP 将 resolver 和 schema映射起来，并挂在app的路由/graphql下
app.use('/graphql', graphqlHTTP({
    schema: graphQLSchema,
    rootValue: root,
    graphiql: true // 打开调试器, 访问：localhost:3000/graphql
}));
app.listen(3000);

// 终端：对应终端graphQL中QL语句
// 增
mutation {
    createFilm(input:{
        name: "新加入的数据",
        poster: "http://111",
        price: 10
    }) {
        id, // 返回的数据
        name
    }
}

// 查


```

# graphQL：client端
## 方法1：直接写graphQL语句并序列化后发送
```js
var dice = 3;
var sides = 6;
var query = `query RollDice($dice: Int!, $sides: Int) {
  rollDice(numDice: $dice, numSides: $sides)
}`;
 
fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables: { dice, sides },
  })
})
  .then(r => r.json())
  .then(data => console.log('data returned:', data));
```
## 方法2：用@apollo/client
- npm install @apollo/client axios
```js
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import axios from 'axios';

const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql', // 后端API的URL
  client: axios, // 使用Axios作为HTTP客户端
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(), // 使用内存缓存
});

client
  .query({
    query: `
        query {
            getNowPlayingList {
                id,
                name
            }
        }
    `,
  })
  .then((result) => {
    console.log(result.data);
  })
  .catch((error) => {
    console.error(error);
  });

```


- mongoDB可视化数据工具
    - Robomongo

- 用nodemon启动node脚本