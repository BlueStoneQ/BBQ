/**
 * components-Tabs
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 * 3- props: {
 *   tabsWidth：在header中 tabs占据的24栅格数的格数（一般取双数 默认24格） 剩余部分给extra
 * }
 */
import React, { Component } from 'react';
import { Row, Col } from '../grid';
import classnames from 'classnames';
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
  constructor (props) {
    super(props);
    this.state = {
      selectKey: '1'
    };
  }
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
    const { selectKey } = thiz.state;
    const { children, tabsWidth, extra } = props;
    const childrenLen = children.length;
    console.log('children: ', children);
    // 遍历计算生成tabs和extra 位置/宽度等进行计算 点击事件进行添加
    return (
      <Row className='tabs-header'>
        {
          children.map((child, i) => {
            console.log('child->', child);
            return (
              <Col
                span={(tabsWidth || 24)/childrenLen}
                key={child.key}
              >
                <span
                  className={classnames('tab-common', {'tab-selected': child.key === selectKey})}
                  onClick={() => this.onChange(child, props, thiz)}
                >
                  {
                    child.props.tab
                  }
                </span>
              </Col>
            );
          })
        }
        <Col span={24 - (tabsWidth || 24)}>
          {
            // 渲染extra部分
            extra && extra
          }
        </Col>
      </Row>
    );
  }
  componentDidMount () {
    // 设置默认的selectKey 1- 如果传入defaultSelectKey 则设置为defaultKey 2- 否则，默认selectKey为顺序第一个TabPane的key
    const { defaultKey, children } = this.props;
    this.setState({
      selectKey: defaultKey || children[0].key
    });
  }
  render() {
    const {
      children
    } = this.props;
    const { selectKey } = this.state;
    return (
      <div className='tabs-wrap'>
        <Row>
          { this.getTabsSelectorRender(this.props, this) }
        </Row>
        <Row>
          {
            React.Children.map(children, (child, i) => {
              // 这里从child中取出child的key 和 当前TabsSeelector中选中的保持一致 才渲染-Blog
              if (child.key === selectKey) {
                return child;
              }
            })
          }
        </Row>
      </div>
    );
  }
}

Tabs.TabPane = TabPane;

export default Tabs;
