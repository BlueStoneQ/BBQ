/**
 * components-Layout
 * 1- 包括：Header + Content + Sider + Footer
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768; 主要是sider的隐藏与展开
 */
import React, { Component } from 'react';
import './index.css';

/**
 * 公共常量- Sider的width
 */
// const SIDER_WIDTH = '100px';

/**
 * Layout - Header
 */
class Header extends Component {
  render() {
    const { style } = this.props;
    return (
      <div
        className='header-wrap'
        style={{...style}}
      >
        { this.props.children }
      </div>
    );
  }
}

/**
 * Layout - Content
 */
class Content extends Component {
  render() {
    const { style } = this.props;
    return (
      <div
        className='content-wrap'
        style={{...style}}
      >
        { this.props.children }
      </div>
    );
  }
}

/**
 * Layout - Sider
 */
class Sider extends Component {
  render() {
    const { style } = this.props;
    return (
      <div
        className='sider-wrap'
        style={{...style}}
      >
        { this.props.children }
      </div>
    );
  }
}

/**
 * Layout - Footer
 */
class Footer extends Component {
  render() {
    const { style } = this.props;
    return (
      <div
        className='footer-wrap'
        style={{...style}}
      >
        { this.props.children }
      </div>
    );
  }
}

/**
 * Layout
 */
class Layout extends Component {
  constructor (props) {
    super(props);
    this.state = {
      siderWidth: 0 // Sider的宽度 - 参与content的width的运算
    }
  }
  render() {
    console.log('【Layout props.children】: ', this.props.children);
    const { style } = this.props;
    return (
      <div
        className='layout-wrap'
        style={{...style}}
      >
        { React.Children.map(this.props.children, function(child, i) {
            // 在这里我们对各种情况进行判断渲染
            // 只有content 而没有sider
            // 有sider + content
            // if (child.type.name === 'Sider') {
            //   this.setState({
            //     siderWidth: SIDER_WIDTH
            //   });
            // }
            // if (child.type.name === 'Content') {
            //   child.props.width = `calc(100vm - ${this.state.siderWidth})`
            // }
            // 没有content的情况抛出异常
            console.log('child: ', child);
            return child;
        }) }
      </div>
    );
  }
}

Layout.Header = Header;
Layout.Content = Content;
Layout.Sider = Sider;
Layout.Footer = Footer;

export default Layout;
