/**
 * components-Grid
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Grid - Row
 */
class Row extends Component {
  render() {
    const { style } = this.props;
    return (
      <div className='row-wrap' style={{...style}}>
        { this.props.children }
      </div>
    );
  }
}

/**
 * Grid - Col
 */
class Col extends Component {
  render() {
    const { span, offset, style } = this.props
    console.log('span: ', span);
    return (
      <div
        className='col-wrap'
        style={{
          ...style,
          width: (span * 100 / 24) + '%', // 百分比 - 栅格系统 24等分
          marginLeft: (offset * 100 / 24) + '%' // 偏移量
        }}
      >
        { this.props.children }
      </div>
    );
  }
}

export { Row, Col };
