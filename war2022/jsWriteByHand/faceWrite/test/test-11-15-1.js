class PreFetch {
  constructor () {
    this.map = new Map();
  }

  register (path, taskQueue, injectParams = {}) {
    this.map.set(path, {
      taskQueue,
      injectParams
    });
  }

  emit (path) {
    if (!this.map.has(path)) return;

    const result = [];
    const item  = this.map.get(path);
    const { taskQueue, injectParams } = item;
    const mergedParams = this._mergeParams(injectParams, queryParams);

    for (const task of taskQueue) {
      result.push(task(mergedParams));
    }

    item.preFetchPromises = result;
  }

  getPreFetchPromises (path) {
    return this.map.get(path).preFetchPromises;
  }
}

this.register();


function task (mergedParams) {
  return axios.post('url');
}

Base(pageObj);

Base({

})

// 
Base({

  onLoad() {}
})

const Base = function (pageObj) {
  const OriginalOnload = pageObj.onload;
  pageObj.onload = function () {
    // inject 
    cesu.startTime = new Date().getTime();
    OriginalOnload.apply(this);
  }
  endTime  - startTime = 
}

<view />

// build: xml -》 json-schema, js -> AST 
// AST-runner

// - dev-  plugin

[{
  name:
  beforeRouterRegister () {
    router.getComlist = 
  }
}]

emitHook(beforeRouterRegister);
app.use(royer)


// code -> build && publish -> cloud  -> 搭建端 -> list -》 
// code -> build -> dev-server 搭建端 -> switch:dev-model ->  model === dev ? 127.0.0.1 :  cloud-url    
// build: 

jest + autoMat: 

