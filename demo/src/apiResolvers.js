const resolvers = []

const users = {
  'u1': {
    id: 'u1',
    name: 'Pekka',
    age: 23,
  },
  'u2': {
    id: 'u2',
    name: 'Hanna',
    age: 35,
  },
  'u3': {
    id: 'u3',
    name: 'Paula',
    age: 55,
  }
}

const api = {
  getUsers: () => new Promise(resolve => {
    setTimeout(() => {
      resolve(Object.keys(users).map(id => users[id]))
    }, 500)
  }),

  getUser: id => new Promise(resolve => {
    setTimeout(() => {
      resolve(users[id])
    }, 500)
  }),

  listenToUsers: (callback) => {
    Object.keys(users).forEach(uid => {
      callback({
        key: uid,
        value: users[uid]
      })
    })
    callback({
      key: 'u4',
      value: {
        id: 'u4',
        name: 'Jukka',
        age: 31,
      },
    })
    const timer1 = setTimeout(() => {
      callback({
        key: 'u5',
        value: {
          id: 'u5',
          name: 'Mia',
          age: 28,
        },
      })
    }, 5000)
    const timer2 = setTimeout(() => {
      callback({
        key: 'u6',
        value: {
          id: 'u6',
          name: 'Liisa',
          age: 45,
        },
      })
    }, 10000)
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }
}


resolvers.push({
  match: "users/index",
  initialState: {
    'users/index': [],
  },
  fetch (pathResolved) {
    return api.getUsers().then(users => {
      const extraData = {}
      users.forEach(user => {
        extraData[`users/${user.id}`] = user
      })
      return {
        appendIndex: users.map(user => user.id),
        extraData,
      }
    })
  },
  shouldWaitForValue: true,
  listen (pathResolved, callback) {
    let previousItem
    return api.listenToUsers(data => {
      const appendIndex = [data.key]
      if (previousItem) {
        appendIndex.splice(0, 0, previousItem)
      }
      previousItem = data.key
      callback({
        appendIndex,
        extraData: {
          [`users/${data.key}`]: data.value,
        },
      })
    })
  },
})

resolvers.push({
  match: "users/:uid/*",
  initialState: {
    'users': {},
  },
  fetch (pathResolved) {
    const {
      uid,
      rest,
    } = pathResolved.result
    return api.getUser(uid).then(user => {
      let data = user
      if (rest) {
        let subpath = rest.split('/')
        while (subpath.length && data) {
          const [nextPath] = subpath.splice(0, 1)
          data = data[nextPath]
        }
      }
      return {
        data,
      }
    })
  },
  getParentPath (pathResolved) {
    const {
      rest: subpath,
      uid,
    } = pathResolved.result
    // Only if subpath exists, parent path exists
    if (subpath) {
      let parts = subpath.split('/')
      parts.pop()
      const newSubpath = parts.length ? `/${parts.join('/')}` : ''
      return `users/${uid}${newSubpath}`
    }
  },
})

export default resolvers
