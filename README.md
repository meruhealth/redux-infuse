# Redux Infuse
[![npm package][npm-badge]][npm]

Simple way to manage data loading from APIs into Redux state and into connected components.

* Every data is loaded on-demand and only once, unless needed to refresh after a period of time.
* Every data is distinguished by a PATH that you define.
* Multiple components can request the same data, however, loading happens only once.
* Ordered data received creates an index in state to be used later (i.e. pagination).
* Supports listening for updates to the data, or new items added to a feed.

## Table of Contents

- [Installation](#installation)
- [Example](#example)
- [License](#license)

## Installation
    npm install redux-infuse

The library expects the following peer dependencies: `react`, `redux`. Also, it is highly useful when used together with `react-redux` and `reselect`, although these are not required.

## Example

This example shows how a User component requests user data and user's coach data from an API.

#### `containers/User.js`

```js
import { connect } from 'react-redux'
import { createInfuse, withInfuse } from 'redux-infuse'
import User from 'components/User'

const infuse = createInfuse(
  (state, props) => {
    const toLoad = {
      [`users/${props.userID}`]: 'user',
    }
    const user = state.data['users', props.userID]
    if (user && user.coachID) {
      toLoad[`coaches/${user.coachID}`] = 'coach'
    }
    return toLoad
  }
)

const mapStateToProps = infuse((state, props, isLoading, getData) => {
  if (isLoading) {
    return {
      isLoading: true,
    }
  }
  const {
    user,
    coach,
  } = getData()
  return {
    user,
    coach,
  }
})

export default connect(mapStateToProps)(withInfuse(User))
```

In the above example, `mapStateToProps` is wrapped with infuse function that allows data loader to get the latest state & props, as well as supply `mapStateToProps` with data selector and loading status. The infuse function gets created by supplying `createInfuse` with a selector function that defines the data required by the component. The selector function is run whenever mapStateToProps is run and its response can change as the data gets loaded. One can use a memoized selector with it, such as using `reselect`.

Note that the connected component is also wrapped with `withInfuse`. This higher order component actually requests the data for loading and attaches data listeners based on the definitions of `infuse` in `mapStateToProps`.

### Defining API resolvers

The data for `users/{userID}` and `coaches/{coachID}` was successfully requested by the component. However, the library yet doesn't know how to load such data. To add that information, API resolvers need to be defined.

#### `apiResolvers.js`

```js
const resolvers = []
resolver.push({
  match: 'users/:userID',
  initialState: { users: {} },
  fetch: pathResolved => {
    const { userID } = pathResolved.result

    return api.getUser(userID).then(user => ({
      data: user,
    }))
  },
})

resolvers.push({
  match: 'coaches/:coachID',
  initialState: { coaches: {} },
  fetch: pathResolved => {
    const { coachID } = pathResolved.result

    return api.getCoach(coachID).then(coach => ({
      data: coach,
    }))
  },
})
```

In the example above, two API resolvers are defined responsible for matching to the requested paths, fetching the data and returning it under `data` property of an object.

### What happens under the hood?

As components request different data paths, corresponding API resolvers execute and download requested data. Once data is returned by the resolver, it gets saved into redux state at data root node (`data` by default) at the location defined by the requested path. I.e. for a requested path `user/u123` the data gets saved at `state.data.user.u123`.

The status of the loading status is also saved into redux state at shadow data node (`_data` by default). The location also corresponds to the requested path, i.e. for `user/u123` the loading status is saved at `state._data.user.u123`. Possible statuses include `startedLoadingAt: <timestamp>`, `loadedAt: <timestamp>`, or `failedAt: <timestamp>` accompanied by `error: { message: string, code: string }`.

All this accounting allows redux infuse to keep taps of what has been downloaded and what not, as well as only request particular data once - unless requested specifically otherwise.

### What about downloading an indexed list of items?

A common scenario is downloading a list of items, for example, posts by a user. The list is often not downloaded at once, but by a few items at a time. The subject of such request is both the index and the items of that index. Let's look how that could be achieved:


#### `apiResolvers.js`

```js
resolvers.push({
  match: [
    'userPosts/:userID/endingAt/:endingAt',
    'userPosts/:userID/latest',
  ],
  initialState: { userPosts: {} },
  fetch: pathResolved => {
    const { userID, endingAt } = pathResolved.result

    return api.getLatestPosts(userID, endingAt).then(posts => {
      const data = {}
      const index = posts.map(post => {
        data[`userPosts/${userID}/${post.id}`] = post
        return post.id
      })
      return {
        appendIndex: index,
        extraData: data,
        path: `userPosts/${userID}/index`,
      }
    })
  },
})
```

Index and items of the index are separated in the response to `appendIndex` and `extraData`. This makes it easy to later query data of a particular item based on its ID, or list all items in their original order.

Index added to appendIndex appends items to the end of the index, however, only if there are no overlapping items in the current and the added indeces. If overlapping items are found, the appendIndex is automatically positioned at the right spot in the current index avoiding any duplicates. The underlying assumption here is that both current index and appendIndex are slices of the real (large) index in the database.

Notice that `path` property is added in the response. This is because we want to append the index to a previously existing index - rather than creating a new index for each batch of items.

Also, note that in `extraData` object the keys are full locations of where the items are to be stored. This is because the subject of the request is the list (the index) so the location of the individual items cannot be determined automatically.

When working with indeces, a few additional properties are supported in the response:

- removeFromIndex: Array(<key: string>) can be used to remove items from the index
- indexStart: Boolean is used to signify the very start of the index. The value is written to the shadow state of the index to signify for the UI that no earlier items exist.
- indexEnd: Boolean is the opposite of indexStart, signifying the very end of the index.

This API resolver could then be used in components as follows:

#### `containers/User.js`

```js

import { connect } from 'react-redux'
import { createInfuse, withInfuse } from 'redux-infuse'
import User from 'components/User'

const infuse = createInfuse(
  (state, props) => {
    const pathOptions = {
      // From where should the data be selected
      from: `userPosts/${props.userID}/index`,
      // Variable name for the result
      to: 'posts',
      // Should data loading impact isLoading status
      status: true,
    }
    if (props.loadEndingAt) {
      return {
        [`userPosts/${props.userID}/endingAt/${props.loadEndingAt}`]: pathOptions,
      }
    }
    return {
      [`userPosts/${props.userID}/latest`]: pathOptions,
    }
  }
)

const mapStateToProps = infuse((state, props, isLoading, getData) => {
  if (isLoading) {
    return {
      isLoading: true,
    }
  }
  const { posts } = getData()
  return {
    posts,
  }
})

export default connect(mapStateToProps)(withInfuse(Posts))
```

Notice how now pathOptions is used to define custom options for selecting the data. The returned `posts` property will be an array and the selection of the items will usually be done in a different place. However, this is not necessary and one could easily use a selector that would enhance the list with the actual contents of the posts.

### Listening to new items in a feed

This is supported by using `pathOptions.listen = true` in `createInfuse` per path definition that you want to listen to. This attaches path listeners and detaches them once the component is unmounted.

The main difference for the developer comes in the definition of the API resolver. Let's look at one:

#### `apiResolvers.js`

```js
resolvers.push({
  match: 'messages/:userID/latest',
  initialState: {
    messages: {},
  },
  listen: (pathResolved, onNewItem) => {
    const { userID } = pathResolved.result
    const path = `messages/${userID}/index`

    const unsubscribe = api.listenToMessages(message => {
      onNewItem({
        path,
        appendIndex: [message.id],
        extraData: {
          [`messages/${userID}/${message.id}`]: message,
        }
      })
    })

    return () => {
      unsubscribe()
    }
  },
})

```

Here are some main differences with loading a data just once and listening for changes:

- Listener definition happens in `listen` method of the resolver.
- `listen` method receives `onNewItem` callback as the second argument, which is then used to dispatch changes to the redux state. This callback can called multiple times and accepts a very same data stracture as is returned by the promise in `fetch` method when fetching data just once.
- `listen` method returns a function for unsubscribing the listner. Redux infuse automatically calls this function once all views listening to the same path have been detached.

The exact same logic works for fetching a single item and then watching its changes. In that case in the resolver definition can be set property `resolver.shouldWaitForValue = true`. This communicates to Redux Infuse that the listener is expected to return some value, even null, upon setting up the listener, and so instructs the library to dispatch `INFUSE/LOAD_START` for the listener, which in turn helps to keep track of `isLoading` status.

### Additional functionality:

#### `redux-infuse/requestData`

For requesting data from outside of component definitions, for example, in action creators. The data is automatically saved to the redux state.

It's signature is:

```js
requestData(path: String, [forceRedownload: false]) -> Promise(data)
```

#### `redux-infuse/updateData`

For updating data in redux state directly, without going through the server. This is often the case when doing writes to the server. As a write succeeds, it may be already apparent what the data is if it was loaded and to avoid requesting data again, `updateData` can be used to update it directly. If the `value` argument is omitted, the data at that location is removed.

The signature of the method:

```js
updateData(path: String[, value: Any])
```

## API

## Setting up


## License

MIT

[npm-badge]: https://img.shields.io/npm/v/redux-infuse.svg?style=flat-square
[npm]: https://www.npmjs.org/package/redux-infuse
