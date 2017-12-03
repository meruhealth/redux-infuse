import _ from 'lodash'
import React, { Component } from 'react'
import dataLoader from './dataLoader'

export default function (paths, options) {
  return function (WrappedComponent) {
    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component'

    class WithData extends Component {
      constructor (props) {
        super(props)
        this.listeners = []
      }

      componentWillMount () {
        const sources = (typeof paths === 'function') ? paths(this.props) : paths
        const loaderOptions = Object.assign({},  
          options, 
          { componentName: wrappedComponentName },
        )
        Object.keys(sources).forEach(path => {
          const pathOptions = sources[path]
          if (typeof pathOptions === 'object' && pathOptions.listen) {
            this.listeners.push(dataLoader.listenTo(path, pathOptions, loaderOptions))
          } else {
            dataLoader.attach(path, pathOptions, loaderOptions)
          }
        })
      }

      componentWillUnmount() {
        let unsubscriber = this.listeners.pop()
        while (unsubscriber) {
          unsubscriber()
          unsubscriber = this.listeners.pop()
        }
      }
      
      render () {
        return React.createElement(WrappedComponent, this.props)
      }
    }

    WithData.displayName = `withData(${wrappedComponentName})`
    
    return WithData
  }
}