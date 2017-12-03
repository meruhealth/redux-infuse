import { createStore, applyMiddleware } from 'redux'
import reducers from './reducers'

// A super-simple logger
var logger = store => next => action => {
  console.log('dispatching', action.type, action)
  var result = next(action)
  console.log('next state', store.getState())
  return result
}

export default function configureStore (initialState) {
  const store = createStore(
    reducers,
    initialState,
    applyMiddleware(logger),
  )
  return store
}
