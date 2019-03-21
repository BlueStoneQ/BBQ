import React, { Component } from 'react';
import Cruise from './cruise'
import './App.css';

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <Cruise />
        </header>
      </div>
    );
  }
}

export default App;
