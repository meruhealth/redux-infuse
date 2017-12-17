import _ from 'lodash'
import { setIn } from '../helpers'
import { DATA_LOAD_START, DATA_LOAD_SUCCESS, DATA_LOAD_FAIL, DATA_LOAD_UPDATE } from '../config'

export default function shadowNodeReducer (currentState = {}, action) {
  if (!action || !action.payload) return currentState
  const { type, payload } = action

  const {
    path,
    appendIndex,
    dataPath,
    extraData,
    timestamp,
  } = payload

  if (!path) return currentState

  const pathPieces = payload.path.split('/')

  let newState = currentState
  if (type === DATA_LOAD_START) {
    const newLoadingState = {
      startedLoadingAt: timestamp,
    }
    // If item is already loaded, don't erase the loaded state
    // as it may control a spinner, which is not necessary if
    // the data already exists
    const loadedAt = _.get(currentState, [...pathPieces, 'loadedAt'])
    if (loadedAt) {
      newLoadingState.loadedAt = loadedAt
    }
    newState = setIn(newState, pathPieces, newLoadingState)
  } else if (type === DATA_LOAD_SUCCESS) {
    newState = setIn(newState, pathPieces, { loadedAt: timestamp })

    if (dataPath && dataPath !== path) {
      const dataPathPieces = dataPath.split('/')
      let newObj = { loadedAt: timestamp }
      // Keep state of index start / end having reached
      if (appendIndex) {
        const previousObj = _.pick(
          _.get(newState, dataPathPieces),
          ['indexStart', 'indexEnd'],
        )
        newObj = Object.assign({}, previousObj, newObj)
      }
      newState = setIn(newState, dataPathPieces, newObj)
    }

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        newState = setIn(newState, key.split('/'), {
          loadedAt: timestamp
        })
      })
    }
  } else if (type === DATA_LOAD_FAIL) {
    newState = setIn(newState, pathPieces, {
      failedAt: timestamp,
      error: payload.error,
    })
  } else if (type === DATA_LOAD_UPDATE) {
    // Internal update should be treated as if data was loaded for the path
    newState = setIn(newState, pathPieces, {
      loadedAt: timestamp,
    })
  }

  return newState
}
