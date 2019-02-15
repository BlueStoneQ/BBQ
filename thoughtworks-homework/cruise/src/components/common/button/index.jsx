/**
 * component - Button
 */
import React, { Component } from 'react';
import classNames from 'classnames';
import './index.css';

class Button extends Component {
  render () {
    const { children, type } = this.props;
    return (
      <span
        className={classNames('btn-wrap', {[`btn-${type}`]: true})}
      >
        { children }
      </span>
    );
  }
}

export default Button