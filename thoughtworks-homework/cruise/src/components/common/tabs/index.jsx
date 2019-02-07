/**
 * components-Tabs
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import { Row, Col } from '../grid';
import './index.css';

/**
 * TabPane
 */
class TabPane extends Component {
  render () {
    return (
      <div>
        { this.props.children }
      </div>
    );
  }
}

/**
 * Tabs
 */
class Tabs extends Component {
  /**
   * 当tabs切换时调用
   * @param { obj } tab 单个选项对象
   * @param { obj } props props对象
   * @param { obj } thiz 上下文
   */
  onChange = (tab, props, thiz) => {
    // 选中的state.selectKey改变 - 映射/管理选中动画等
    this.setState({
      selectKey: tab.key || '1'
    }, function() {
      // 调用回调 传递key值
      props.onChange && props.onChange(thiz.state.selectKey);
    });
  }
  /**
   * 渲染-Tabs的选择器部分
   */
  getTabsSelectorRender = (props, thiz) => {
    const { children } = props;
    const childrenLen = children.length;
    console.log('children: ', children);
    // 遍历计算生成tabs和extra 位置/宽度等进行计算 点击事件进行添加
    return (
      <Row className='tabs-header'>
        {
          children.map((child, i) => {
            console.log('child->', child);
            return (
              <Col span={24/childrenLen} key={child.key}>
                <span onClick={() => this.onChange(child, props, thiz)}>
                  {
                    child.props.tab
                  }
                </span>
              </Col>
            );
          })
        }
      </Row>
    );
  }
  render() {
    const {
      children
    } = this.props;
    return (
      <div className='tabs-wrap'>
        <Row>
          { this.getTabsSelectorRender(this.props, this) }
        </Row>
        <Row>
          {
            React.Children.map(children, (child, i) => {
              // 这里从child中取出child的key 和 当前TabsSeelector中选中的保持一致 才渲染
              // console.log(`child[${i}]: `, child);
              return child;
            })
          }
        </Row>
      </div>
    );
  }
}

Tabs.TabPane = TabPane;

export default Tabs;
