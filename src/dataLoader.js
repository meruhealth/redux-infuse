import _ from 'lodash'
import { setIn } from './helpers'

let store = {
  dispatch (action) {
    console.warn('No store connected to data-lodaer')
  },
  getState () {
    console.warn('No store connected to data-loader')
    return {}
  }
}

const defaultOptions = {
  rootNode: 'data',
  shadowNode: '_data',
  dataFetchTimeout: 10000,
  retryAfter: 5000,
  refreshAfter: 60000,
}

let currentOptions = Object.assign({}, defaultOptions)

function shadowNodeReducer (currentState = {}, action) {
  if (!action || !action.payload) return currentState
  const { type, payload } = action

  const {
    path,
    extraData,
    timestamp,
  } = payload

  if (!path) return currentState

  const pathPieces = payload.path.split('/')

  let newState = currentState
  if (type === 'DATA_LOAD_START') {
    const loadedAt = _.get(currentState, [...pathPieces, 'loadedAt'])
    const newLoadingState = {
      startedLoadingAt: timestamp,
    }
    // If item is already loaded, don't erase the loaded state
    // as it may control a spinner, which is not necessary if
    // the data already exists
    if (loadedAt) {
      newLoadingState.loadedAt = loadedAt
    }
    newState = setIn(newState, pathPieces, newLoadingState)
  } else if (type === 'DATA_LOAD_SUCCESS') {
    newState = setIn(newState, pathPieces, {
      loadedAt: timestamp,
    })

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        newState = setIn(newState, key.split('/'), {
          loadedAt: timestamp
        })
      })
    }
  } else if (type === 'DATA_LOAD_FAIL') {
    const loadingState = _.get(currentState, pathPieces)
    const newLoadingState = Object.assign({}, loadingState, {
      failedAt: timestamp,
      error: payload.error,
    })
    newState = setIn(newState, pathPieces, newLoadingState)
  }

  return newState
}

function rootNodeReducer (currentState = {}, action) {
  if (!action || !action.payload) return currentState
  const { type, payload } = action

  if (type === 'LOAD_DATA_INITIAL') {
    return payload
  }

  const path = payload.dataPath || payload.path
  if (!path) return currentState

  const pathPieces = path.split('/')

  let newState = currentState

  if (type === 'DATA_LOAD_SUCCESS') {
    const {
      data,
      appendIndex,
      extraData,
    } = payload
    if (data) {
      newState = setIn(newState, pathPieces, data)
    } else if (appendIndex) {
      const currentIndex = _.get(currentState, pathPieces)
      const first = !currentIndex ? -1 : currentIndex.indexOf(appendIndex[0])
      const last = !currentIndex ? -1 : currentIndex.indexOf(appendIndex[appendIndex.length - 1])
      let newIndex = []

      if (first !== -1 || last !== -1) {
        // Append currentIndex items preceding the new items
        if (first !== -1) {
          newIndex = currentIndex.slice(0, first)
        }
        // Append new items
        newIndex = newIndex.concat(appendIndex)
        // Append currentIndex items after the new items
        if (last !== -1) {
          newIndex = newIndex.concat(currentIndex.slice(last + 1))
        }
      } else {
        // There's not reference point -> just append
        newIndex = currentIndex.concat(appendIndex)
      }

      newState = setIn(newState, pathPieces, newIndex)
    }

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        newState = setIn(newState, key.split('/'), extraData[key])
      })
    }
  }

  return newState
}

function getReducers() {
  return {
    [currentOptions.rootNode]: rootNodeReducer,
    [currentOptions.shadowNode]: shadowNodeReducer,
  }
}

const cancellableRequests = {}

function parseRoutePath (path, route) {
  const pathParts = path.split('/')
  const matchParts = route.split('/')
  const result = {}
  for (let i = 0; i < matchParts.length; i++) {
    const key = matchParts[i]
    const val = pathParts[i]
    if (key === '*' && i === (matchParts.length - 1)) {
      const rest = pathParts.slice(i).join('/')
      if (rest) {
        result.rest = rest
      }
      break
    } else if (!val) {
      return false
    } else if (key[0] === ':') {
      result[key.substring(1)] = val
    } else if (key === '*') {
      continue
    } else if (key !== val) {
      return false
    }
  }
  return result
}

const getNextID = (() => {
  let id = 1
  return () => (id++).toString()
})()

const pathListeners = {}

/**
 * Resolver is defined with the following options:
 *
 * props: Object({
 *   match: String | [String] | RegExp | Function -> result: Object
 *   fetch: Function(pathResolved: Object)
 *     -> data: Object({data: Object, appendIndex: Array, path: String (optional)})
 *   listen: Function(pathResolved, onData: Function({data: Object, appendIndex: Array, path: String (optional)}) -> unsubscribe: Function
 *   shouldWaitForValue: Boolean (optional)
 *   getParentPath: Function(pathResolved) -> path: String
 * })
 */
class Resolver {
  constructor (props) {
    // Save expected props
    this.props = props

    if (props.fetch) {
      this.isFetcher = true
    }

    if (props.listen) {
      this.isListener = true
    }
  }

  matchPath (path, pathOptions) {
    if (pathOptions.listen && !this.isListener) {
      return false
    } else if (!pathOptions.listen && !this.isFetcher) {
      return false
    } else if (typeof this.props.match === 'string') {
      return parseRoutePath(path, this.props.match)
    } else if (this.props.match instanceof Array) {
      for (let i = 0; i < this.props.match.length; i++) {
        const route = this.props.match[i]
        const result = parseRoutePath(path, route)
        if (result) {
          return result
        }
      }
      return false
    } else if (this.props.match instanceof RegExp) {
      return this.props.match.exec(path)
    } else if (typeof this.props.match === 'function') {
      return this.props.match(path, pathOptions)
    } else {
      return false
    }
  }

  match (path, pathOptions, loaderOptions) {
    const result = this.matchPath(path, pathOptions)
    if (result) {
      return { result, path, pathOptions, loaderOptions }
    }
  }

  fetch (pathResolved) {
    const path = pathResolved.path

    if (cancellableRequests[path]) {
      cancellableRequests[path]()
      delete cancellableRequests[path]
    }

    store.dispatch({
      type: 'DATA_LOAD_START',
      payload: {
        timestamp: Date.now(),
        path,
      }
    })

    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        const err = new Error('Timeout')
        err.code = 'TIMEOUT'
        reject(err)
      }, currentOptions.dataFetchTimeout)
    })

    const cancelPromise = new Promise((resolve, reject) => {
      cancellableRequests[path] = () => {
        const err = new Error('Request cancelled')
        err.code = 'CANCELLED'
        reject(err)
      }
    })

    return Promise.race([
      this.props.fetch(pathResolved),
      timeoutPromise,
      cancelPromise,
    ])
    .then(dataReceived => {
      const payload = _.pick(dataReceived, ['data', 'extraData', 'appendIndex'])
      payload.path = path
      payload.timestamp = Date.now()
      if (dataReceived.path) {
        payload.dataPath = newData.path
      }
      store.dispatch({
        type: 'DATA_LOAD_SUCCESS',
        payload,
      })
    })
    .catch(err => {
      if (err.code === 'CANCELLED') {
        console.log(`Request for ${path} was cancelled`)
        // cancelled requests don't need to fire DATA_LOAD_FAIL as they will fire DATA_LOAD_START immediately
        return
      } else {
        console.error('Error while fetching', path, err)
      }
      const error = {
        message: err.message,
      }
      if (err.code) {
        error.code = err.code
      }
      store.dispatch({
        type: 'DATA_LOAD_FAIL',
        payload: {
          timestamp: Date.now(),
          path,
          error,
        }
      })
    })
    .then(() => {
      delete cancellableRequests[path]
    })
  }

  startListening (pathResolved) {
    const path = pathResolved.path
    let timeoutTimer

    console.log('Starting to listen', path)

    if (this.props.shouldWaitForValue) {
      timeoutTimer = setTimeout(() => {
        store.dispatch({
          type: 'DATA_LOAD_FAIL',
          payload: {
            timestamp: Date.now(),
            error: {
              message: `Fetching initial value for ${path} failed`,
              code: 'TIMEOUT',
            },
            path,
          }
        })
      }, currentOptions.dataFetchTimeout)

      store.dispatch({
        type: 'DATA_LOAD_START',
        payload: {
          timestamp: Date.now(),
          path,
        },
      })
    }

    const unsubscribe = this.props.listen(pathResolved, dataReceived => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
        timeoutTimer = null
      }
      const payload = _.pick(dataReceived, ['data', 'extraData', 'appendIndex'])
      payload.path = path
      payload.timestamp = Date.now()
      if (dataReceived.path) {
        payload.dataPath = dataReceived.path
      }
      store.dispatch({
        type: 'DATA_LOAD_SUCCESS',
        payload,
      })
    })

    return () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
        timeoutTimer = null
        store.dispatch({
          type: 'DATA_LOAD_FAIL',
          payload: {
            path,
            error: {
              message: `Fetching initial value for ${path} was cancelled`,
              code: 'CANCELLED',
            }
          }
        })
      }
      console.log('Unsubscribed', path)
      unsubscribe()
    }
  }

  isDownloadNeeded (pathResolved) {
    const forceRedownload = _.get(pathResolved, ['pathOptions', 'forceRedownload'])
    if (forceRedownload) {
      return true
    }
    const state = store.getState()[currentOptions.shadowNode]
    let shouldDownload = true
    const now = Date.now()
    if (!state) {
      throw new Error('Shadow state not found')
      return
    }
    const pathState = _.get(state, pathResolved.path.split('/'))
    if (pathState) {
      const options = Object.assign({}, currentOptions, pathResolved.loaderOptions, pathResolved.pathOptions)
      if (pathState.loadedAt && (now - pathState.loadedAt) < options.refreshAfter) {
        shouldDownload = false
      } else if (pathState.startedLoadingAt && (now - pathState.startedLoadingAt) < options.retryAfter) {
        shouldDownload = false
      }
    }
    if (shouldDownload && this.props.getParentPath) {
      const parentPath = this.props.getParentPath(pathResolved)
      if (parentPath) {
        const {
          resolver,
          pathResolved: parentPathResolved,
        } = findResolver(parentPath, pathResolved.pathOptions)
        if (!resolver) {
          throw new Error('Parent resolver could not be found')
          return
        }
        shouldDownload = resolver.isDownloadNeeded(parentPathResolved)
      }
    }
    return shouldDownload
  }

  execute (pathResolved) {
    if (pathResolved.pathOptions.listen) {
      return this.listen(pathResolved)
    }

    let shouldDownload = this.isDownloadNeeded(pathResolved)
    if (!shouldDownload) {
      return
    }

    // Don't return promise as there's nothing to detach in fetch
    this.fetch(pathResolved)
  }

  listen (pathResolved) {
    const id = getNextID()
    const path = pathResolved.path
    if (!pathListeners[path]) {
      pathListeners[path] = {
        unsubscribe: this.startListening(pathResolved),
        listeners: [id],
      }
    } else {
      pathListeners[path].listeners.push(id)
    }

    return () => this.unsubscribe(path, id)
  }

  unsubscribe (path, id) {
    if (!pathListeners[path]) {
      return
    }
    const listeners = pathListeners[path].listeners
    const i = listeners.indexOf(id)
    if (i !== -1) {
      listeners.splice(i, 1)
    }
    if (!listeners.length) {
      pathListeners[path].unsubscribe()
      pathListeners[path] = null
    }
  }

}

// '^feedsGroup\/([^/]+)\/lastest\/?(.*)$'
// '^privateUserData\/([^/]+)$': getOnePrivateUserData,
// '^privateUserData\/([^/]+)/(.*)$': getPrivateUserDataSubset,

let resolvers = []

let isReady = false
let setReady
const onceReady = new Promise(resolve => {
  setReady = () => {
    isReady = true
    resolve()
  }
})

function initLoader (argStore, argResolvers, options) {
  store = argStore
  currentOptions = Object.assign({}, defaultOptions, options)
  const initialState = {}
  resolvers = argResolvers.map(props => {
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
  store.dispatch({
    type: 'LOAD_DATA_INITIAL',
    payload: initialState,
  })
  setReady()
}

function renameReducers (data, shadow) {
  currentOptions = Object.assign({}, currentOptions, {
    rootNode: data
  })
  if (shadow) {
    currentOptions.shadowNode = shadow
  }
}

function findResolver (path, pathOptions) {
  for (let i = 0, max = resolvers.length; i < max; i++) {
    const resolver = resolvers[i]
    const pathResolved = resolver.match(path, pathOptions)
    if (pathResolved) {
      return {
        resolver,
        pathResolved,
      }
    }
  }
}

function attachDataLoader (path, pathOptionsArg, loaderOptions) {
  const pathOptions = typeof pathOptionsArg === 'object' ? pathOptionsArg : {}
  const foundResolver = findResolver(path, pathOptions)
  if (!foundResolver) {
    console.error(`No resolver could be found for '${path}'`, pathOptions)
    return
  }
  const {
    resolver,
    pathResolved,
  } = foundResolver

  return resolver.execute(pathResolved)
}

const _internals = {
  parseRoutePath,
}

export default function attachDataLoaderOnceReady (...args) {
  return onceReady.then(() => {
    return attachDataLoader(...args)
  })
}

export {
  initLoader,
  renameReducers,
  getReducers,
  _internals,
}
