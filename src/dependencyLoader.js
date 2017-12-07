import { getStore } from './config'

function getState () {
  return getStore().getState()
}

function dispatch (action) {
  return getStore().dispatch(action)
}

const attachedDependencies = new Map()

export default function attachDependencies (dependencies) {
  const id = getNextID()

  dependencies.forEach(dependency => {
    const state = attachedDependencies.get(dependency)
    if (state) {
      // Dependency is already attached -> add current view as a listener
      state.listeners.set(id, true)
    } else {
      // Dependency is a new one
      // -> attach it
      const dependencyResult = dependency(dispatch, getState)
      const unsubscribe = (typeof dependencyResult === 'function') ? dependencyResult : (() => {})
      // -> save state into attachedDependencies
      attachedDependencies.set(dependency, {
        listeners: new Map(),
        unsubscribe,
      })
    }
  })

  return () => detachDependencies(dependencies, id)
}

function detachDependencies (dependencies, id) {
  dependencies.forEach(dependency => {
    const state = attachedDependencies.get(dependency)
    if (!state) {
      console.warn('Dependency unsubscribe() was called more than once')
      return
    }
    state.listeners.delete(id)
    if (!state.listeners.size()) {
      state.unsubscribe()
      dependencies.delete(dependency)
    }
  })
}
