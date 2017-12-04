import React from 'react'
import { withLoader } from 'redux-infuse'
import { connect } from 'react-redux'

function Comp (props) {
  const users = props.users.index
  return (
    <div className="UserSideBar">
      UserSideBar
      <ul>
        { users.map(uid => (
          <li key={uid}>{props.users[uid].name}</li>
        )) }
      </ul>
    </div>
  )
}

const compWithLoader = withLoader({
  'users/index': { listen: true },
})(Comp)

const mapStateToProps = state => {
  return {
    users: state.data.users,
  }
}

export default connect(mapStateToProps)(compWithLoader)