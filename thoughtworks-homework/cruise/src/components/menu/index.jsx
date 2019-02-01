/**
 * components-Menu
 * 1- 根据props.data + Item 遍历渲染整个菜单
 * 2- 菜单须有折叠功能 - 在响应式的情况下 进行折叠
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Menu - Item
 */
class Item extends Component {
  render() {
    return (
      <div
        className='item-wrap'
      >
        { this.props.children }
      </div>
    );
  }
}

/**
 * Menu
 */
class Menu extends Component {
  render() {
    const { children } = this.props
    return (
      <div
        className='menu-wrap'
      >
        {
          React.Children.map(children, function(child, i){
            return child;
          })
        }
      </div>
    );
  }
}

Menu.Item = Item;

export default Menu;
