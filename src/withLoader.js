import { Component, createElement } from 'react'
import attachDataLoader from './dataLoader'
import attachDependencies from './dependencyLoader'

export default function (paths, options) {
  return function (WrappedComponent) {
    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component'

    class WithData extends Component {
      constructor (props) {
        super(props)

        this.loaders = {}
        this.isAttached = true
        this.detachDependencies = null

        this.loaderOptions = Object.assign({}, options, {
          componentName: wrappedComponentName,
        })
      }

      componentWillMount () {
        if (this.loaderOptions.dependencies) {
          this.detachDependencies = attachDependencies(this.loaderOptions.dependencies)
        }
        this.attachLoaders(this.props)
      }

      componentWillReceiveProps (newProps) {
        if (typeof paths !== 'function') {
          // sources cannot change if they are given as object
          return
        }
        this.attachLoaders(newProps)
      }

      componentWillUnmount() {
        Object.keys(this.loaders).forEach(path => {
          if (typeof this.loaders[path] === 'function') {
            this.loaders[path]()
          }
        })
        this.loaders = {}
        if (this.detachDependencies) {
          this.detachDependencies()
          this.detachDependencies = null
        }
        this.isAttached = false
      }

      attachLoaders (props) {
        const expiredPaths = Object.keys(this.loaders)
        const sources = (typeof paths === 'function') ? paths(props) : paths
        Object.keys(sources).forEach(path => {
          if (this.loaders[path]) {
            // loader exists -> it's not expired
            const i = expiredPaths.indexOf(path)
            expiredPaths.splice(i, 1)
          } else {
            // new loader added -> attach it
            const pathOptions = sources[path]
            this.loaders[path] = true
            attachDataLoader(path, pathOptions, this.loaderOptions).then(unsubscribe => {
              if (typeof unsubscribe === 'function') {
                if (this.isAttached) {
                  this.loaders[path] = unsubscribe
                } else {
                  // Unsubscribe immediately if the component is not mounted
                  unsubscribe()
                }
              }
            })
          }
        })

        // The rest loaders are no longer relevant -> remove them
        expiredPaths.forEach(path => {
          if (typeof this.loaders[path] === 'function') {
            this.loaders[path]()
          }
          delete this.loaders[path]
        })
      }

      render () {
        return createElement(WrappedComponent, this.props)
      }
    }


    WithData.displayName = `withData(${wrappedComponentName})`

    return WithData
  }
}