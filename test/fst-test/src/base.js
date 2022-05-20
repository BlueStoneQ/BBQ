/**
 * 页面增加base
 */
import { pageBase as fstPageBase } from 'min-fst-sdk';

const Base = (pageConfig, page) => {
  return metricsBase(fstPageBase(pageConfig));
}

export default Base;