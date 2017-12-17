import _ from 'lodash'
import { setIn } from '../helpers'
import { removeIn } from '../helpers'
import { DATA_LOAD_INITIAL, DATA_LOAD_SUCCESS, DATA_LOAD_UPDATE } from '../config'

export default function rootNodeReducer (currentState = {}, action) {
  if (!action || !action.payload) return currentState
  const { type, payload } = action

  if (type === DATA_LOAD_INITIAL) {
    return payload
  }

  const path = payload.dataPath || payload.path
  if (!path) return currentState

  const pathPieces = path.split('/')

  let newState = currentState

  if (type === DATA_LOAD_SUCCESS) {
    const {
      data,
      appendIndex,
      extraData,
      removeFromIndex,
    } = payload

    if (removeFromIndex) {
      const newIndex = (_.get(currentState, pathPieces) || []).slice()
      removeFromIndex.forEach(key => {
        const i = newIndex.indexOf(key)
        if (i !== -1) {
          newIndex.splice(i, 1)
        }
      })

      newState = setIn(newState, pathPieces, newIndex)
    }

    if (data) {
      newState = setIn(newState, pathPieces, data)
    } else if (appendIndex && appendIndex.length) {
      const currentIndex = _.get(currentState, pathPieces) || []
      const first = currentIndex.indexOf(appendIndex[0])
      const last = currentIndex.indexOf(appendIndex[appendIndex.length - 1])

      let newIndex
      if (first !== -1) {
        // First appendIndex item IS in currentIndex
        // -> append currentIndex items preceding the new items
        newIndex = currentIndex.slice(0, first)
      } else {
        // First appendIndex item IS NOT in currentIndex

        let shouldPrependCurrentIndex = true
        if (last !== -1) {
          // appendIndex tail is in currentIndex
          shouldPrependCurrentIndex = false
        } else if (!currentIndex.length) {
          // currentIndex is empty
          shouldPrependCurrentIndex = false
        } else if (appendIndex.indexOf(currentIndex[0]) !== -1) {
          // appendIndex contains whole currentIndex
          // -> replace currentIndex
          shouldPrependCurrentIndex = false
        }

        if (shouldPrependCurrentIndex) {
          newIndex = currentIndex.slice()
        } else {
          newIndex = []
        }
      }

      // Append new items
      newIndex = newIndex.concat(appendIndex)

      // Append currentIndex items after the new items
      if (last !== -1) {
        newIndex = newIndex.concat(currentIndex.slice(last + 1))
      }

      newState = setIn(newState, pathPieces, newIndex)
    }

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        newState = setIn(newState, key.split('/'), extraData[key])
      })
    }
  } else if (type === DATA_LOAD_UPDATE) {
    const {
      data,
      remove,
    } = payload
    if (remove) {
      newState = removeIn(newState, pathPieces)
    } else {
      newState = setIn(newState, pathPieces, data)
    }
  }

  return newState
}
