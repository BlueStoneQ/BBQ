/**
 * components-Icon
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import classNames from 'classnames';
import './index.css';
import './font-icons/fonts.css'; // 暂时先把字体图标的东西搬过来

/**
 * Icon
 */
class Icon extends Component {
  render() {
    // console.log('process.env.PUBLIC_URL: ', process.env.PUBLIC_URL); // 空的哈哈
    const {
      type
    } = this.props;
    return (
      <i
        className={classNames({ [`icon-${type}`]: true })}
      />
    );
  }
}

export default Icon;
