// 定义preFetcher
class PreFetcher {
  constructor() {
    this.map = new Map();
    this.instance = null;
  }

  static getIinstance() {
    if (this.instance) return this.instance;

    this.instance = new PreFetcher();

    return this.instance;
  }

  register(path, handler) {
    this.map.set(path, {
      handler,
      result: [],
    });
  }

  async fetch(path) {
    const { handler } = this.map.get(path);

    const fetchlist = handler();
    return Promise.all(fetchlist).then(result => {
      console.log('result: ', result)
      this.map.set(path, {
        handler,
        result: result,
      });
    })
  }

  getPreFetcheData(path) {
    return this.map.get(path).result;
  }
}

module.exports = PreFetcher.getIinstance();


// test
const prehandle = () => {
  return [
    Promise.resolve(1),
    Promise.resolve(2),
    Promise.resolve(3),
  ];
}

(async () => {
  const preFetcher = PreFetcher.getIinstance();
  const path = 'a/2/s';
  preFetcher.register(path, prehandle);
  preFetcher.fetch(path).then(() => {
    console.log(preFetcher.getPreFetcheData(path))
  });
})()





