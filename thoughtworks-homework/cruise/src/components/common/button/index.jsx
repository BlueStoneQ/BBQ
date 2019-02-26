/**
 * component - Button
 */
import React, { Component } from 'react';
import classNames from 'classnames';
import './index.css';

class Button extends Component {
  render () {
    const { children, type, onClick } = this.props;
    return (
      <span
        className={classNames('btn-wrap', {[`btn-${type}`]: true})}
        onClick={onClick}
      >
        { children }
      </span>
    );
  }
}

export default Button