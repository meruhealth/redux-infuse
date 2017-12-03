import appState from './appState'
import { combineReducers } from 'redux'
import { getReducers } from 'redux-infuse'

export default function () {
  return combineReducers({
    appState,
    ...getReducers(),
  })
}
