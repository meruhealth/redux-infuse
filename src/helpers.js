import _ from 'lodash'

export const getNextID = (() => {
  let id = 1
  return () => (id++).toString()
})()

/**
 * Set value in object at a given node without mutating the objects
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
