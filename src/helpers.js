import _ from 'lodash'

export const getNextID = (() => {
  let id = 1
  return () => (id++).toString()
})()

/**
 * Set value in object at a given node without mutating the objects
 *
 * @param {Object} obj Object tree
 * @param {string[]|string} path Array of keys, or String separated by '.', i.e. 'foo.bar'
 * @param {*} val Value to assign to the location in tree
 */
export function setIn (obj, path, val) {
  const originalValue = _.get(obj, path)
  // Proceed only if the object would change
  if (originalValue === val) {
    return obj
  }
  // First clear the old value (to avoid merging val into originalValue)
  const newObj = _.merge({}, obj, _.set({}, path, null))
  // Then set the new value
  return _.set(newObj, path, val)
}

/**
 * Remove location from an object including
 * empty branches without mutating the object.
 *
 * @param {Object} obj Object tree
 * @param {string[]|string} path Array of keys, or a String separated by '.', i.e. 'foo.bar'
 */
export function removeIn (obj, path) {
  if (!path || !path.length) {
    console.warn('Error in removeIn(): path cannot be empty')
    return obj
  }
  let newState = obj
  let pieces = (typeof path === 'string') ? path.split('.') : path
  while (pieces.length) {
    const lastKey = pieces.pop()
    const oldData = pieces.length ? _.get(newState, pieces) : newState
    // If the path doesn't exist in the first place, just return unchanged state
    if (oldData === undefined || !oldData.hasOwnProperty(lastKey)) {
      return newState
    }
    // Only if the object has more properties than the key, it can be written to
    if (Object.keys(oldData).length > 1) {
      const newData = _.omit(oldData, [lastKey])
      if (pieces.length) {
        newState = setIn(newState, pieces, newData)
      } else {
        newState = newData
      }
      // Object is updated -> return
      return newState
    }
  }

  // if the while loop run through the last key,
  // it means that the whole state would be empty after the removal
  return {}
}

export function parseRoutePath (path, route) {
  const pathParts = path.split('/')
  const matchParts = route.split('/')
  const result = {}
  // if path is longer than the pattern and the pattern does not end with *
  if (pathParts.length > matchParts.length && matchParts[matchParts.length - 1] !== '*') {
    return false
  }
  for (let i = 0; i < matchParts.length; i++) {
    const key = matchParts[i]
    const val = pathParts[i]
    if (key === '*' && i === (matchParts.length - 1)) {
      const rest = pathParts.slice(i).join('/')
      if (rest) {
        result.rest = rest
      }
      break
    } else if (!val) {
      return false
    } else if (key[0] === ':') {
      result[key.substring(1)] = val
    } else if (key === '*') {
      continue
    } else if (key !== val) {
      return false
    }
  }
  return result
}
