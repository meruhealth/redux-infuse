import _ from 'lodash'
import { createSelector } from 'reselect'
import { getConfig } from './config'
import withData from './withData'

export default class DataInfuser {
  constructor (...args) {
    if (args.length > 1) {
      this.selector = createSelector(...args)
    } else {
      const type = typeof args[0]
      if (type === 'function' || type === 'object') {
        this.selector = args[0]
        if (type === 'object') {
          this.toLoad = args[0]
        }
      } else {
        this.selector = _.noop
      }
    }
    this.state = {}

    this.dataSelected = {}
    this.shouldReselect = true
    this.toLoad = undefined
  }

  seed (state, props) {
    const prevToLoad = this.toLoad
    this.toLoad = (typeof this.selector === 'function') ? this.selector(state, props) : this.selector
    if (prevToLoad !== this.toLoad) {
      this._prepare()
      this.shouldReselect = true
    } else if (this.state !== state) {
      this._calculateIsLoading()
      this.shouldReselect = true
    }
    this.state = state
  }

  _prepare () {
    this.getDataFor = []
    this.followLoadingOf = []
    _.forEach(this.toLoad, (opts, path) => {
      let pathOptions
      if (typeof opts === 'string') {
        pathOptions = { to: opts, status: true }
      } else if (opts && typeof opts === 'object') {
        pathOptions = opts
      } else {
        pathOptions = {}
      }

      const pathParts = (pathOptions.from || path).split('/')

      if (pathOptions.to) {
        this.getDataFor.push({to: pathOptions.to, transform: pathOptions.transform, pathParts})
      }

      if (pathOptions.status) {
        this.followLoadingOf.push(pathParts)
      }
    })
    this._calculateIsLoading()
  }

  _calculateIsLoading () {
    this.isLoading = false
    const shadowNode = getConfig('shadowNode')
    _.forEach(this.followLoadingOf, pathParts => {
      const state = _.get(this.state[shadowNode], pathParts)
      if (!state || !state.loadedAt && !state.failedAt) {
        this.isLoading = true
        return
      }
    })
  }

  infuse () {
    if (!this.toLoad) {
      this.seed()
    }
    return {
      _infuseDataToLoad: this.toLoad,
    }
  }

  collect () {
    if (!this.shouldReselect) {
      return this.dataSelected
    }
    this.shouldReselect = false
    const rootNode = getConfig('rootNode')
    const dataSelected = {}
    this.getDataFor.forEach(({to, transform, pathParts}) => {
      const val = _.get(this.state[rootNode], pathParts)
      if (transform && val) {
        dataSelected[to] = transform(val)
      } else {
        dataSelected[to] = val
      }
    })
    // Only return new data object if some data has actually changed
    const keysNew = Object.keys(dataSelected)
    const keysOld = Object.keys(this.dataSelected)
    if (keysNew.length !== keysOld.length) {
      this.dataSelected = dataSelected
    } else if (_.some(keysNew, key => dataSelected[key] !== this.dataSelected[key])) {
      this.dataSelected = dataSelected
    }
    return this.dataSelected
  }
}

DataInfuser.wrap = (wrappedComponent, options) => {
  return withData(null, options)(wrappedComponent)
}
