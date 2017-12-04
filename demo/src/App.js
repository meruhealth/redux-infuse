import React, { Component } from 'react';
import './App.css';
import UserSideBar from './UserSideBar'
import configureStore from './store'
import { actions } from './ducks/app'
import { Provider } from 'react-redux'

class App extends Component {
  constructor (props) {
    super(props)
    this.store = configureStore()
    this.state = {
      displaySideBar: true,
      displaySideBar2: false,
    }
    this.tryIt = this.tryIt.bind(this)
    this.toggleUsers = this.toggleUsers.bind(this)
    this.toggleUsers2 = this.toggleUsers2.bind(this)
  }

  tryIt () {
    this.store.dispatch(actions.testIt())
  }

  toggleUsers () {
    this.setState({
      displaySideBar: !this.state.displaySideBar,
    })
  }

  toggleUsers2 () {
    this.setState({
      displaySideBar2: !this.state.displaySideBar2,
    })
  }

  render() {
    return (
      <Provider store={this.store}>
        <div className="App">
          { this.state.displaySideBar ? <UserSideBar /> : null }
          <div className="ResultView">
            <button onClick={this.tryIt}>Try this</button>
            <button onClick={this.toggleUsers}>Toggle users</button>
            <button onClick={this.toggleUsers2}>Toggle users2</button>
          </div>
          { this.state.displaySideBar2 ? <UserSideBar /> : null }
        </div>
      </Provider>
    );
  }
}

export default App;
