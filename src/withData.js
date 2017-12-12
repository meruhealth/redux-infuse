import _ from 'lodash'
import { PureComponent, createElement } from 'react'
import attachDataLoader from './dataLoader'
import attachDependencies from './dependencyLoader'

export default function (paths, options) {
  return function (WrappedComponent) {
    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component'

    class WithData extends PureComponent {
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
        this.attachLoaders(this.getPaths())
      }

      componentWillReceiveProps (newProps) {
        let shouldUpdate
        if (newProps._infuseDataToLoad) {
          shouldUpdate = newProps._infuseDataToLoad !== this.props._infuseDataToLoad
        } else {
          shouldUpdate = typeof paths === 'function'
        }
        if (shouldUpdate) {
          this.attachLoaders(this.getPaths(newProps))
        }
      }

      componentWillUnmount () {
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

      getPaths (props = this.props) {
        if (props._infuseDataToLoad) {
          return props._infuseDataToLoad
        }
        return (typeof paths === 'function') ? paths(props) : (paths || {})
      }

      attachLoaders (sources) {
        const expiredPaths = Object.keys(this.loaders)
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
        // filter out _infusedDataToLoad
        const props = _.omit(this.props, ['_infuseDataToLoad'])
        return createElement(WrappedComponent, props)
      }
    }


    WithData.displayName = `withData(${wrappedComponentName})`

    return WithData
  }
}