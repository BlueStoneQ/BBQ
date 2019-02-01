/**
 * components-Page
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Page
 */
class Page extends Component {
  render() {
    const {
      style,
      padding,
      backColor
    } = this.props;
    return (
      <div
        className='page-wrap'
        style={{
          ...style,
          padding: padding,
          background: backColor
        }}
      >
        { this.props.children }
      </div>
    );
  }
}

export default Page;
