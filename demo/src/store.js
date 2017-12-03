import { createStore, applyMiddleware } from 'redux'
import getReducers from './reducers'
import resolvers from './apiResolvers'
import { initLoader } from 'redux-infuse'

// A super-simple logger
var logger = store => next => action => {
  console.log('dispatching', action.type, action)
  var result = next(action)
  console.log('next state', store.getState())
  return result
}

export default function configureStore (initialState) {
  // renameReducers('data2', '_data2')
  
  const store = createStore(
    getReducers(),
    initialState,
    applyMiddleware(logger),
  )

  initLoader(store, resolvers)

  return store
}
