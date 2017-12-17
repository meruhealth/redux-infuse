import _ from 'lodash'

export const DATA_LOAD_INITIAL = 'INFUSE/LOAD_INITIAL'
export const DATA_LOAD_START = 'INFUSE/LOAD_START'
export const DATA_LOAD_SUCCESS = 'INFUSE/LOAD_SUCCESS'
export const DATA_LOAD_FAIL = 'INFUSE/LOAD_FAIL'
export const DATA_LOAD_UPDATE = 'INFUSE/DIRECT_UPDATE'

let store = {
  dispatch (action) {
    console.warn('No store connected to data-lodaer')
  },
  getState () {
    console.warn('No store connected to data-loader')
    return {}
  }
}

export function getStore () {
  return store
}

const defaultOptions = {
  rootNode: 'data',
  shadowNode: '_data',
  dataFetchTimeout: 10000, // try requesting data again
  retryAfter: 5000, // try requesting again
  refreshAfter: Infinity, // this can be overridden by the user
}

let currentOptions = Object.assign({}, defaultOptions)

export function getConfig (key) {
  return key ? _.get(currentOptions, key) : currentOptions
}

let resolvers = []

let setReady
export const onceReady = new Promise(resolve => {
  setReady = () => {
    resolve()
  }
})

export function init (argStore, argResolvers, initialState, options) {
  store = argStore
  currentOptions = Object.assign({}, defaultOptions, options)
  resolvers = argResolvers
  store.dispatch({
    type: DATA_LOAD_INITIAL,
    payload: initialState,
  })
  setReady()
}

export function renameReducers (data, shadow) {
  currentOptions = Object.assign({}, currentOptions, {
    rootNode: data
  })
  if (shadow) {
    currentOptions.shadowNode = shadow
  }
}

export function findResolver (path, pathOptions) {
  for (let i = 0, max = resolvers.length; i < max; i++) {
    const resolver = resolvers[i]
    const result = resolver.match(path, pathOptions)
    if (result) {
      const getPathResolved = loaderOptions => ({result, path, pathOptions, loaderOptions})
      return {
        resolver,
        execute: loaderOptions => {
          return resolver.execute(getPathResolved(loaderOptions))
        },
        isDownloadNeeded: loaderOptions => {
          return resolver.isDownloadNeeded(getPathResolved(loaderOptions))
        },
      }
    }
  }
}
