## node向另外一个服务器发送文件
- https://www.cnblogs.com/yourstars/p/6728765.html
```js
var exec = require('child_process').exec;
var request = require('request');
var fs = require('fs');

exec('./mysqlout.bat', function (err, stdout, stderr) {

    if (err) {
        console.error(err);
        return;
    }
    request.post('http://120.11.xx.19:3000/upload', {
        formData: {
            title: 'upload sqlfile',
            description: 'Sent on ' + new Date(),
            is_public: 1,
            sqlfiles: fs.createReadStream('f:/beijian.sql')
        },
        json: true
    }, function(err, res, body) {
        console.log('返回: ' + body);
        return;
    })
});
```
在request中，上传文件使用formData:
```md
#### multipart/form-data (Multipart Form Uploads)

For `multipart/form-data` we use the [form-data](https://github.com/form-data/form-data) library by [@felixge](https://github.com/felixge). For the most cases, you can pass your upload form data via the `formData` option.


```js
var FormData = require('form-data')

const formData = {
  // Pass a simple key-value pair
  my_field: 'my_value',
  // Pass data via Buffers
  my_buffer: Buffer.from([1, 2, 3]),
  // Pass data via Streams
  my_file: fs.createReadStream(__dirname + '/unicycle.jpg'),
  // Pass multiple values /w an Array
  attachments: [
    fs.createReadStream(__dirname + '/attachment1.jpg'),
    fs.createReadStream(__dirname + '/attachment2.jpg')
  ],
  // Pass optional meta-data with an 'options' object with style: {value: DATA, options: OPTIONS}
  // Use case: for some types of streams, you'll need to provide "file"-related information manually.
  // See the `form-data` README for more information about options: https://github.com/form-data/form-data
  custom_file: {
    value:  fs.createReadStream('/dev/urandom'),
    options: {
      filename: 'topsecret.jpg',
      contentType: 'image/jpeg'
    }
  }
};
request.post({url:'http://service.com/upload', formData: formData}, function optionalCallback(err, httpResponse, body) {
  if (err) {
    return console.error('upload failed:', err);
  }
  console.log('Upload successful!  Server responded with:', body);
});
```
```