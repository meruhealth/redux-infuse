import _ from 'lodash'
import { createSelector } from 'reselect'
import { getConfig } from './config'
import withData from './withData'

export default class DataInfuser {
  constructor (selector) {
    const type = typeof selector
    if (type === 'function' || type === 'object') {
      this.selector = selector
    } else {
      this.selector = undefined
    }

    this.state = {}
    this.toLoad = undefined
    this.dataSelected = {}
    this.shouldReselect = true
  }

  seed (state, props) {
    const prevToLoad = this.toLoad
    this.toLoad = (typeof this.selector === 'function') ? this.selector(state, props) : this.selector
    if (prevToLoad !== this.toLoad) {
      this._prepare()
    }
    this._calculateIsLoadingIfNeeded(state)

    this.state = state
  }

  _prepare () {
    this.shouldReselect = true
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
  }

  _calculateIsLoadingIfNeeded (state) {
    const shadowNode = getConfig('shadowNode')
    const shadowState = state[shadowNode]
    // Don't recalculate if shadow state has not changed
    if (this.state[shadowNode] === shadowState) {
      return
    }
    this.isLoading = false
    _.forEach(this.followLoadingOf, pathParts => {
      const state = _.get(shadowState, pathParts)
      if (!state || !state.loadedAt && !state.failedAt) {
        this.isLoading = true
        return
      }
    })
  }

  infuse (props) {
    if (!this.toLoad) {
      this.seed()
    }
    const infused = {
      _infuseDataToLoad: this.toLoad,
    }
    return props ? Object.assign({}, props, infused) : infused
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

  wrap (wrappedComponent, options) {
    if (!this.toLoad) {
      this.seed()
    }
    withData(null, options)(wrappedComponent)

  }
}

export const withInfuser = (wrappedComponent, options) => {
  return withData(null, options)(wrappedComponent)
}

DataInfuser.wrap = withInfuser

export function createInfuser (selector) {
  const infuser = new DataInfuser(selector)
  const getData = infuser.collect.bind(infuser)
  return mapStateToProps => (state, props) => {
    infuser.seed(state, props)
    return infuser.infuse(mapStateToProps(state, props, infuser.isLoading, getData))
  }
}

