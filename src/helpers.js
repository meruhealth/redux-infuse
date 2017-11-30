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

