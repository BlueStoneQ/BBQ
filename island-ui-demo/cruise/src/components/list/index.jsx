/**
 * List - 业务型组件
 * 1- 接收数据 并map渲染item - 容器型组件
 */
import React, { Component } from 'react';
import Item from './item'
import './index.css';

class List extends Component {
  render () {
    const { listData } = this.props;
    return (
      <div>
        { listData.map((v, i) => {
          return (
            <Item
              key={i}
              data={v}
            />
          );
        }) }
      </div>
    )
  }
}

export default List;