/**
 * OrderSelect - 业务型组件
 * 1- 定制化的下拉框
 * 2- 纯手工实现 没有使用input.type=select
 * 3- 使用的是点击下拉开关时的鼠标指针位置 来计算出下拉框的位置
 * 4- 也许可以抽象到公共组件库中
 */
import React, { Component } from 'react'
import { Icon } from '../index'
import {
  getClientCoor,
  addMouseListener,
  removeMouseListener
} from '../../utils';
import './index.css'

class Option extends Component {
  render () {
    const {
      children
    } = this.props
    return (
      <span option='option-wrap'>
        { children }
      </span>
    )
  }
}

class OrderSelect extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isDropDown: false
    };
  }
  /**
   * 点击开关
   */
  onDrop = () => {
    // let coor = getClientCoor(document);
    // console.log('coor.e1: ', coor.e1)
    // console.log('coor.e2: ', coor.e2)
    // 获取当前元素位置
    let coor = this.switch.getBoundingClientRect();
    console.log('coor: ', coor)
    this.setState({
      isDropDown: !this.state.isDropDown,
      coorX: Math.floor(coor.left), // options的X位置-相对于浏览器窗口
      coorY: Math.floor(coor.bottom) // options的X位置-相对于浏览器窗口
    });
  }

  componentDidMount () {
    // 绑定mousemove事件到document
    // addMouseListener(document);
  }
  componentWillUnMount () {
    // 解除绑定mousemove事件从document
    // removeMouseListener(document);
  }
  render () {
    const {
      isDropDown,
      coorX,
      coorY
    } = this.state;
    console.log('coorX: ', coorX)
    console.log('coorY：', coorY)
    const { children } = this.props;
    return (
      <div className='or-select-wrap'>
        <span
          ref={ref => this.switch = ref}
          className='or-select-switch'
          onClick={ this.onDrop }
        >
          <Icon type={ isDropDown ? 'angle-down' : 'angle-up' } />
        </span>
        {
          isDropDown &&
          <div
            className='options-wrap'
            style={{
              left: coorX + 'px',
              top: coorY + 'px'
            }}
          >
            {
              React.Children.map(children, (child, index) => {
                return child;
              })
            }
          </div>
        }
      </div>
    )
  }
}

OrderSelect.Option = Option;

export default OrderSelect;