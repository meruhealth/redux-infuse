import React, { Component } from 'react'
import attachDataLoader from './dataLoader'

export default function (paths, options) {
  return function (WrappedComponent) {
    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component'

    class WithData extends Component {
      constructor (props) {
        super(props)
        this.listeners = []
        this.isAttached = true
      }

      componentWillMount () {
        const sources = (typeof paths === 'function') ? paths(this.props) : paths
        const loaderOptions = Object.assign({},
          options,
          { componentName: wrappedComponentName },
        )
        Object.keys(sources).forEach(path => {
          const pathOptions = sources[path]
          attachDataLoader(path, pathOptions, loaderOptions).then(unsubscribe => {
            if (typeof unsubscribe === 'function') {
              if (this.isAttached) {
                this.listeners.push(unsubscribe)
              } else {
                // Unsubscribe immediately if the component is not mounted
                unsubscribe()
              }
            }
          })
        })
      }

      componentWillUnmount() {
        let unsubscriber = this.listeners.pop()
        while (unsubscriber) {
          unsubscriber()
          unsubscriber = this.listeners.pop()
        }
        this.isAttached = false
      }

      render () {
        return React.createElement(WrappedComponent, this.props)
      }
    }

    WithData.displayName = `withData(${wrappedComponentName})`

    return WithData
  }
}