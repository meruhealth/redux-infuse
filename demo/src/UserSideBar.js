import React from 'react'
import { withInfuse, createInfuse } from 'redux-infuse'
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

const infuse = createInfuse(() => ({
  'users/index': { listen: true }
}))

const mapStateToProps = state => {
  return {
    users: state.data.users,
  }
}

export default connect(infuse(mapStateToProps))(withInfuse(Comp))
