import _ from 'lodash'
import { onceReady, findResolver } from './config'

function attachDataLoaderSync (path, pathOptionsArg, loaderOptionsArg) {
  const pathOptions = (pathOptionsArg && typeof pathOptionsArg === 'object') ? pathOptionsArg : {}
  const loaderOptions = (loaderOptionsArg && typeof loaderOptionsArg === 'object') ? loaderOptionsArg : {}
  const foundResolver = findResolver(path, pathOptions)
  if (!foundResolver) {
    console.error(`No resolver could be found for '${path}'`, pathOptions)
    return
  }
  return foundResolver.execute(loaderOptions)
}

export default function attachDataLoader (...args) {
  return onceReady.then(() => {
    return attachDataLoaderSync(...args)
  })
}

export function requestPath(path, forceRedownload = false) {
  return attachDataLoader(path, {waitForValue: true, forceRedownload})
}
