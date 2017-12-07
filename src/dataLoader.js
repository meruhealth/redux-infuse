import _ from 'lodash'
import { onceReady, findResolver } from './config'

function attachDataLoaderSync (path, pathOptionsArg, loaderOptions) {
  const pathOptions = typeof pathOptionsArg === 'object' ? pathOptionsArg : {}
  const foundResolver = findResolver(path, pathOptions)
  if (!foundResolver) {
    console.error(`No resolver could be found for '${path}'`, pathOptions)
    return
  }
  const {
    resolver,
    pathResolved,
  } = foundResolver

  return resolver.execute(pathResolved)
}

export default function attachDataLoader (...args) {
  return onceReady.then(() => {
    return attachDataLoaderSync(...args)
  })
}
