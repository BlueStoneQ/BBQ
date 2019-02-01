/**
 * cruise -main Page
 */
import React, { Component } from 'react';
import {
  Page,
  Row,
  Col,
  Menu,
  Layout
} from '../../components'
import './index.css';

const { Header, Content, Sider, Footer } = Layout;

class Cruise extends Component {
  render() {
    return (
      <Layout>
        <Header>header</Header>
        <Sider>Sider</Sider>
        <Content width='120px'>Content</Content>
        <Footer>Footer</Footer>
      </Layout>
    );
  }
}

export default Cruise;
