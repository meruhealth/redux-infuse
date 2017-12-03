import React, { Component } from 'react';
import './App.css';
import UserSideBar from './UserSideBar'
import configureStore from './store'
import { actions } from './ducks/app'

const ResultView = () => <div>ResultView</div>

class App extends Component {
  constructor (props) {
    super(props)
    this.store = configureStore()
    this.tryIt = this.tryIt.bind(this)
  }

  tryIt () {
    this.store.dispatch(actions.testIt())
  }

  render() {
    return (
      <div className="App">
        <UserSideBar />
        <ResultView />
        <button onClick={this.tryIt}>Try this</button>
      </div>
    );
  }
}

export default App;
