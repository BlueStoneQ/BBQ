/**
 * Components - PopBox
 */
import React, { Component } from 'react';
import './index.css';

class PopBox extends Component {
  render () {
    const { visible, children } = this.props;
    return (
      <div
        className='pop-box-wrap'
        style={{
          visible: visible
        }}
      >
        这就是PopBox
        内容:
        { children }
      </div>
    );
  }
}

export default PopBox;