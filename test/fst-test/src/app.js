import fstSDK from 'min-fst-sdk';

App({
  onLaunch(options) {
    fstSDK.register({
      key: 'key', // 上报key
      uuid: 'uuid',
      samplingRate: 0.1, // 采样率
    });
  }
})