/**
 * OrderSelect - 业务型组件
 * 1- 定制化的下拉框
 * 2- 纯手工实现 没有使用input.type=select
 * 3- 使用的是点击下拉开关时的鼠标指针位置 来计算出下拉框的位置
 * 4- 也许可以抽象到公共组件库中
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import Option from './option';
import { toggleDrop } from '../../redux/actions/order-select';
import { Icon } from '../index';
import {
  getDomCoor
} from '../../utils';
import './index.css';

class OrderSelect extends Component {
  constructor (props) {
    super(props)
    this.state = {
      coorX: 0, // 下拉框的位置 - 在窗口中的坐标 - X轴
      coorY: 0 // 下拉框的位置 - 在窗口中的坐标 - X轴
    };
  }
  /**
   * 点击开关
   */
  onDrop = () => {
    // 我们从props取出可以改变isDropDown的dispatch
    const { onToggleDrop } = this.props;
    // 获取当前元素位置
    let coor = getDomCoor(this.switch);
    this.setState({
      // isDropDown: !this.state.isDropDown, // 这个state量目前需要和Option组件共享 选择用redux管理
      coorX: Math.floor(coor.left - (120 - Math.floor(coor.width)) / 2), // options的X位置-相对于浏览器窗口 switch和下拉框的中点需要对齐 然后利用偏移量来对齐：下拉框的left = switch.left - ( 下拉框宽度 - switch.width ) / 2
      coorY: Math.floor(coor.bottom) // options的X位置-相对于浏览器窗口
    });
    // 调用disPatch - 切换isDropDwon的值
    onToggleDrop();
  }

  render () {
    const {
      // isDropDown,
      coorX,
      coorY
    } = this.state;
    const { title, children, isDropDown } = this.props;
    return (
      <div className='or-select-wrap'>
        <span
          ref={ref => this.switch = ref}
          className='or-select-switch'
          onClick={ this.onDrop }
        >
          { title }
          <Icon type={ isDropDown ? 'angle-down' : 'angle-up' } />
        </span>
        {
          isDropDown &&
          <div
            className='options-wrap'
            style={{
              width: '120px', // 写出来 - 固定值，可以接受父组件定制，这里要参与运算
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

/**
 * 把state映射到props上
 * 1- 这样我们就可以从props上取到相应的state
 * 2- 这里的state就是redux中的state
 * 3- redux.state的结构是由各个reducer共同决定的
 */
const mapStateToProps = state => {
  console.log('state: ', state)
  return {
    isDropDown: state.orderSelect.isDropDown
  };
}

 /**
  * 把dispatch映射到props上
  * 1- dispatch就是用来触发state改变的 我们可以理解为事件之类
  * 2- 我们可以在被connect包裹的组件中 从props中取出映射过来的dispatch 例如这里的onToggleDrop 调用后就会改变redux中state中对应的值
  * 3- dispatch 是一个函数、
  * 4- 可以在这里定义 也可以专门做一个容器组件 在里面定义 和 映射state和dispatch到props上
  * 5- 这里的dispatch其实就来自于redux 利用dispatch(actionCreater(data))
  * 6- 由于5 我们必须要引入定义好的action（其实是actionCreater）
  */
const mapDispatchToProps = dispatch => {
  return {
    onToggleDrop: () => {
      dispatch(toggleDrop());
    }
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(OrderSelect);