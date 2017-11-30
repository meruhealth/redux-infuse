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

export function shadowNodeReducer (action, currentState) {
  const { type, payload } = action

  const pathPieces = payload.path.split('/')

  let newState = currentState
  if (type === 'DATA_LOAD_START') {
    newState = setIn(newState, pathPieces, {
      startedLoadingAt: Date.now(),
    })
  } else if (type === 'DATA_LOAD_SUCCESS') {
    newState = setIn(newState, pathPieces, {
      loadedAt: Date.now(),
    })
  } else if (type === 'DATA_LOAD_FAIL') {
    const loadingState = _.get(currentState, pathPieces)
    const newLoadingState = Object.assign({}, loadingState, {
      failedAt: Date.now(),
      error: payload.error,
    })
    newState = setIn(newState, pathPieces, newLoadingState)
  }
}

export function rootNodeReducer (action, currentState) {
  const { type, payload } = action

  const pathPieces = (payload.dataPath || payload.path).split('/')

  let newState = currentState
  if (type === 'DATA_LOAD_SUCCESS') {
    const {
      data,
      appendIndex,
    } = payload
    if (data) {
      newState = setIn(newState, pathPieces, data)
    } else if (appendIndex) {
      const first = appendIndex[0]
      const last = appendIndex[appendIndex.length - 1]
      const currentIndex = _.get(currentState, pathPieces)
      let newIndex = []
      // Append currentIndex items preceding the new items
      if (currentIndex && currentIndex.indexOf(first) !== -1) {
        newIndex = currentIndex.slice(0, currentIndex.indexOf(first))
      }
      // Append new items
      newIndex = newIndex.concat(appendIndex)
      // Append currentIndex items after the new items
      if (currentIndex && currentIndex.indexOf(last) !== -1) {
        newIndex = newIndex.concat(currentIndex.slice(currentIndex.indexOf(last) + 1))
      }
      newState = setIn(newState, pathPieces, newIndex)
    }
  }

  return newState
}

export function getReducers() {
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
      result.rest = pathParts.split(i).join('/')
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

class Resolver {
  constructor (props) {
    // Save expected props
    this.props = props
  }

  matchPath (path, pathOptions) {
    if (typeof this.props.match === 'string') {
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
    .then(({data, extraData, path: dataPath}) => {
      store.dispatch({
        type: 'DATA_LOAD_SUCCESS',
        payload: {
          path,
          data,
          dataPath,
        }
      })
      
      if (extraData) {
        Object.keys(extraData).forEach(key => {
          store.dispatch({
            type: 'DATA_LOAD_SUCCESS',
            payload: {
              path: key,
              data: extraData[key],
            }
          })
        })
      }
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
          data: path,
          error,
        }
      })
    })
    .finally(() => {
      delete cancellableRequests[path]
    })
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
    let shouldDownload = this.isDownloadNeeded(pathResolved)
    if (!shouldDownload) {
      return 
    }
    return this.fetch(pathResolved)
  }

}

// '^feedsGroup\/([^/]+)\/lastest\/?(.*)$'
// '^privateUserData\/([^/]+)$': getOnePrivateUserData,
// '^privateUserData\/([^/]+)/(.*)$': getPrivateUserDataSubset,

let resolvers = []

let setReady
const onceReady = new Promise(resolve => {
  setReady = () => resolve()
})

function initLoader (argStore, argResolvers, options) {
  resolvers = argResolvers.map(props => new Resolver(props))
  store = argStore
  currentOptions = Object.assign({}, defaultOptions, options)
  setReady()
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

const dataLoader = {
  attach (path, pathOptions, loaderOptions) {
    const {
      resolver,
      pathResolved,
    } = findResolver(path, pathOptions)
    if (!resolver) {
      console.error('No resolver could be found for', path, pathOptions)
      return
    }

    store.dispatch({
      type: 'LOAD_DATA_START',
      payload: {
        path,
      },
    })
    return resolver.execute(pathResolved)
    return Promise.resolve()
  },

  listen (path, pathOptions, loaderOptions) {
    for (let i = 0, max = resolvers.length; i < max; i++) {
      const resolver = resolvers[i]
      if (!resolver.isListener) {
        continue
      }

    }

    return () => {

    }
  }
}

function runOnceReady (methodName) {
  return {
    [methodName]: (...args) => {
      return onceReady.then(() => {
        return dataLoader[methodName](...args)
      })
    },
  }
}

const queuedDataLoaders = Object.assign({}, {
  ...runOnceReady('attach'),
  ...runOnceReady('listen'),
})

export default queuedDataLoaders

export {
  initLoader,
  _internals: {
    parseRoutePath,
  },
}
