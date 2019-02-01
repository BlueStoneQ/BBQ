/**
 * components-Menu
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Grid - Row
 */
class Item extends Component {
  render() {
    return (
      <div className='row-wrap'>
        { this.props.children }
      </div>
    );
  }
}

/**
 * Grid - Col
 */
class Menu extends Component {
  render() {
    const { span } = this.props
    console.log('span: ', span);
    return (
      <div
        className='col-wrap'
        style={{
          width: (span * 100 / 24) + '%' // 百分比 - 栅格系统 24等分
        }}
      >
        { this.props.children }
      </div>
    );
  }
}

Menu.Item = Item;

export default Menu;
