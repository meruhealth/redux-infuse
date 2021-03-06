import withData from './withData'
import { renameReducers, getConfig, init } from './config'
import Resolver, { updateData } from './Resolver'
import DataInfuser, { withInfuse, createInfuse } from './DataInfuser'
import rootNodeReducer from './reducers/root'
import shadowNodeReducer from './reducers/shadow'
import { requestData } from './dataLoader'

export function getReducers() {
  return {
    [getConfig('rootNode')]: rootNodeReducer,
    [getConfig('shadowNode')]: shadowNodeReducer,
  }
}

export function initLoader (argStore, argResolvers, options) {
  const initialState = {}
  const resolvers = argResolvers.map(props => {
    if (props.initialState) {
      Object.keys(props.initialState).forEach(path => {
        const parts = path.split('/')
        const currentVal = _.get(initialState, parts)
        const val = currentVal ? _.merge(currentVal, props.initialState[path]) : props.initialState[path]
        _.set(initialState, parts, val)
      })
    }
    return new Resolver(props)
  })
  return init(argStore, resolvers, initialState, options)
}

export default DataInfuser
export {
  withData,
  renameReducers,
  DataInfuser,
  withInfuse,
  createInfuse,
  updateData,
  requestData,
}

