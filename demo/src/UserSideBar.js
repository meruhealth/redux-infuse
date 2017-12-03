import React from 'react'
import { withLoader } from 'redux-infuse'

function Comp (props) {
  console.log(props)
  return <div>UserSideBar</div>
}

export default withLoader({

})(Comp)
