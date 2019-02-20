/**
 * cruise -main Page
 */
import React, { Component } from 'react';
import {
  Page,
  Row,
  Col,
  Menu,
  Layout,
  Img,
  DisCard,
  Card,
  Tabs,
  Input,
  List,
  OrderSelect,
  Icon
} from '../../components';
// import logo from '../../assets/logo/avatar.jpg';
import config from '../../config';
import { getClientCoor } from '../../utils'
import './index.css';

const { Header, Content, Sider, Footer } = Layout;
const MenuItem = Menu.Item;
const TabPane = Tabs.TabPane;
const Option = OrderSelect.Option;

const { API_BASE_URL } = config;

/**
 * Row的公共样式
 */
const rowStyle = {
  marginBottom: '10px',
  // border: '1px solid #0f0'
};

/**
 * Col的公共样式
 */
const colStyle = {
  // border: '1px solid #00f'
};

class Cruise extends Component {
  constructor (props) {
    super(props);
    this.state = {
      listData: [] // List的数据
    };
  }
  /**
   * 获取List数据
   */
  getListData = (thiz) => {
    fetch(API_BASE_URL + 'agents')
      .then((res) => res.json())
      .then((data) => {
        console.log('data: ', data);
        thiz.setState({
          listData: data
        });
      });
  }
  /**
   * 渲染Tabs中的extra
   */
  getTabsExtraRender = () => {
    return (
      <Row>
        <Col
          span={20}
          style={{
            paddingLeft: '30px'
          }}
        >
          <Input />
        </Col>
        <Col span={4}>2</Col>
      </Row>
    );
  }

  /**
   * test - 获取当前鼠标的位置 
   */
  // getMouseCoor = (e) => {
  //   let coor = getClientCoor(e);
  //   this.setState({
  //     clintX: coor.clientX,
  //     clintY: coor.clientY
  //   });
  // }

  componentDidMount () {
    const thiz = this;
    // 请求数据
    this.getListData(thiz);
    // 获取指针位置
    // document.onmousemove = this.getMouseCoor;
  }

  render() {
    const { listData } = this.state;
    return (
      <Layout>
        <Header>
          <Row
            className='h-row'
            style={{...rowStyle}}
          >
            <Col
              span={4}
              offset={10}
              className='h-col'
              style={{...colStyle}}
            >
              <Img
                imgUrl='/assets/logo/logo.svg'
                width='150px'
                height='50px'
                backSize='100%'
              />
              { 'X: ' + this.state.clintX + 'Y: ' + this.state.clintY }
            </Col>
            <Col
              span={3}
              offset={7}
              className='h-col'
              style={{...colStyle}}
            >
              <OrderSelect
                title={
                  <Img
                    imgUrl='/assets/logo/avatar.jpg'
                    width='40px'
                    height='40px'
                    backSize='100%'
                    borderRadius='50%'
                  />
                }
              >
                <Option>
                  <Row>
                    <Col span={8}>
                      <Icon type='id-card'/>
                    </Col>
                    <Col span={15} offset={1} style={{textAlign: 'left'}}>
                      Profile
                    </Col>
                  </Row>
                </Option>
                <Option>
                  <Row>
                    <Col span={8}>
                      <Icon type='sign-in'/>
                    </Col>
                    <Col span={15} offset={1} style={{textAlign: 'left'}}>
                      Sign Out
                    </Col>
                  </Row>
                </Option>
              </OrderSelect>
            </Col>
          </Row>
        </Header>
        <Sider>
          <Menu>
            <MenuItem>DASHBORDER</MenuItem>
            <MenuItem>AGENT</MenuItem>
            <MenuItem>MY CRUISE</MenuItem>
            <MenuItem>HELP</MenuItem>
          </Menu>
        </Sider>
        <Content>
          <Page
            padding='10px 20px'
          >
            <Row style={{...rowStyle}}>
              <Col span={7.5} style={{...colStyle}}>
                <DisCard
                  backColor='#FF9A2A'
                  title='Building'
                  data='3'
                />
              </Col>
              <Col span={7.5} offset={0.5} style={{...colStyle}}>
                <DisCard
                  backColor='#7FBA39'
                  title='Idle'
                  data='5'
                />
              </Col>
              <Col span={8} offset={0.5} style={{...colStyle}}>
                 <Card
                  className='num-card'
                >
                  <Row className='num-card-label'>
                    <Col span={8}>ALL</Col>
                    <Col span={8}>PHYSICAL</Col>
                    <Col span={8}>VIRTUAL</Col>
                  </Row>
                  <Row className='num-card-num'>
                    <Col span={8}>8</Col>
                    <Col span={8}>4</Col>
                    <Col span={8}>4</Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row style={{...rowStyle}}>
              <Col span={24} style={{...colStyle}}>
                <Tabs
                  tabsWidth={8}
                  extra={this.getTabsExtraRender()}
                >
                  <TabPane tab='All' key='All'>
                    <List
                      listData={listData}
                    />
                  </TabPane>
                  <TabPane tab='Physical' key='Physical'>2</TabPane>
                  <TabPane tab='Virtual' key='Virtual'>3</TabPane>
                </Tabs>
              </Col>
            </Row>
          </Page>
        </Content>
        <Footer>@Copyright 2017 ThoughtWorks</Footer>
      </Layout>
    );
  }
}

export default Cruise;
