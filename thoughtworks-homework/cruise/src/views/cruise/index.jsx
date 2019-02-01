/**
 * cruise -main Page
 */
import React, { Component } from 'react';
import {
  Page,
  Row,
  Col
} from '../../components'
import './index.css';

class Cruise extends Component {
  render() {
    return (
      <Page>
        <Row>
          <Col span={2}>
              1234
          </Col>
        </Row>
      </Page>
    );
  }
}

export default Cruise;
