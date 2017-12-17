import {
  findResolver,
  getStore,
  getConfig,
  DATA_LOAD_START,
  DATA_LOAD_SUCCESS,
  DATA_LOAD_FAIL,
  DATA_LOAD_UPDATE,
} from './config'

import { parseRoutePath, getNextID } from './helpers'

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
export default class Resolver {
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

  match (path, pathOptions) {
    if (pathOptions.listen && !this.isListener) {
      return
    } else if (!pathOptions.listen && !this.isFetcher) {
      return
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
      return
    } else if (this.props.match instanceof RegExp) {
      return this.props.match.exec(path)
    } else if (typeof this.props.match === 'function') {
      return this.props.match(path, pathOptions)
    } else {
      return
    }
  }

  fetch (pathResolved) {
    const path = pathResolved.path

    if (Resolver.cancellableRequests[path]) {
      Resolver.cancellableRequests[path]()
      delete Resolver.cancellableRequests[path]
    }

    getStore().dispatch({
      type: DATA_LOAD_START,
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
      }, getConfig('dataFetchTimeout'))
    })

    const cancelPromise = new Promise((resolve, reject) => {
      Resolver.cancellableRequests[path] = () => {
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
      const payload = _.pick(dataReceived, ['data', 'extraData', 'appendIndex', 'removeFromIndex', 'indexStart', 'indexEnd'])
      if (_.isEmpty(payload)) {
        throw new Error(`Resolver for path '${path}' dispatched empty response`)
      }
      payload.path = path
      payload.timestamp = Date.now()
      if (dataReceived.path) {
        payload.dataPath = dataReceived.path
      }

      const action = {
        type: DATA_LOAD_SUCCESS,
        payload,
      }
      const onceDispatched = new Promise(resolve => {
        getStore().dispatch(action)
        resolve(payload)
      })

      // Don't carry responsibility for the errors
      // happening possibly as a consequence of the data loaded
      return onceDispatched.catch(err => {
        const payloadStr = JSON.stringify(action.payload).substring(0, 255)
        console.warn(`Error occurred as a consequence of dispatch: ${action.type} ${payloadStr}`, err)
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
      getStore().dispatch({
        type: DATA_LOAD_FAIL,
        payload: {
          timestamp: Date.now(),
          path,
          error,
        }
      })
    })
    .then(res => {
      delete Resolver.cancellableRequests[path]
      return res
    })
  }

  startListening (pathResolved) {
    const path = pathResolved.path
    let timeoutTimer

    console.log('Starting to listen', path)

    if (this.props.shouldWaitForValue) {
      timeoutTimer = setTimeout(() => {
        getStore().dispatch({
          type: DATA_LOAD_FAIL,
          payload: {
            timestamp: Date.now(),
            error: {
              message: `Fetching initial value for ${path} failed`,
              code: 'TIMEOUT',
            },
            path,
          }
        })
      }, getConfig('dataFetchTimeout'))

      getStore().dispatch({
        type: DATA_LOAD_START,
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
      const payload = _.pick(dataReceived, ['data', 'extraData', 'appendIndex', 'removeFromIndex'])
      payload.path = path
      payload.timestamp = Date.now()
      if (dataReceived.path) {
        payload.dataPath = dataReceived.path
      }
      try {
        getStore().dispatch({
          type: DATA_LOAD_SUCCESS,
          payload,
        })
      } catch (err) {
        const payloadStr = JSON.stringify(payload).substring(0, 255)
        console.warn(`Error occurred as a consequence of dispatch: ${DATA_LOAD_SUCCESS} ${payloadStr}`, err)
      }
    })

    return () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
        timeoutTimer = null
        getStore().dispatch({
          type: DATA_LOAD_FAIL,
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
    const state = getStore().getState()[getConfig('shadowNode')]
    let shouldDownload = true
    const now = Date.now()
    if (!state) {
      throw new Error('Shadow state not found')
      return
    }
    const pathParts = pathResolved.path.split('/')
    if (pathParts.indexOf('undefined') !== -1) {
      console.warn(`Loader path contains 'undefined'. Make sure you are validating the params before requesting them! Path: ${pathResolved.path}`)
    }
    const pathState = _.get(state, pathParts)
    if (pathState) {
      const retryAfter = pathResolved.pathOptions.retryAfter || pathResolved.loaderOptions.retryAfter || getConfig('retryAfter')
      const refreshAfter = pathResolved.pathOptions.refreshAfter || pathResolved.loaderOptions.refreshAfter || getConfig('refreshAfter')
      if (pathState.loadedAt && (now - pathState.loadedAt) < refreshAfter) {
        shouldDownload = false
      } else if (pathState.startedLoadingAt && (now - pathState.startedLoadingAt) < retryAfter) {
        shouldDownload = false
      }
    }
    if (shouldDownload && this.props.getParentPath) {
      const parentPath = this.props.getParentPath(pathResolved)
      if (parentPath) {
        const foundResolver = findResolver(parentPath, pathResolved.pathOptions)
        if (!foundResolver) {
          throw new Error('Parent resolver could not be found')
          return
        }
        shouldDownload = foundResolver.isDownloadNeeded(pathResolved.loaderOptions)
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

    const onceFetched = this.fetch(pathResolved)
    // Normally a promise is not returned for not to wait for fetch execution,
    // but this can be overrided
    if (pathResolved.pathOptions.waitForValue) {
      return onceFetched
    }
  }

  listen (pathResolved) {
    const id = getNextID()
    const path = pathResolved.path
    if (!Resolver.pathListeners[path]) {
      Resolver.pathListeners[path] = {
        unsubscribe: this.startListening(pathResolved),
        listeners: [id],
      }
    } else {
      Resolver.pathListeners[path].listeners.push(id)
    }

    return () => this.unsubscribe(path, id)
  }

  unsubscribe (path, id) {
    if (!Resolver.pathListeners[path]) {
      return
    }
    const listeners = Resolver.pathListeners[path].listeners
    const i = listeners.indexOf(id)
    if (i !== -1) {
      listeners.splice(i, 1)
    }
    if (!listeners.length) {
      Resolver.pathListeners[path].unsubscribe()
      Resolver.pathListeners[path] = null
    }
  }

}

Resolver.cancellableRequests = {}
Resolver.pathListeners = {}

/**
 * To remove a path completely, call function with only 1 argument
 *
 * @param {String} path
 * @param {Any} data
 */
export function updateData (path, data) {
  const payload = {
    path,
  }

  if (arguments.length === 2) {
    payload.data = data
  } else {
    payload.remove = true
  }

  getStore().dispatch({
    type: DATA_LOAD_UPDATE,
    payload,
  })
}
