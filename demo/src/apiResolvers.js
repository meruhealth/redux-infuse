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
}


resolvers.push({
  match: [
    "users/all",
  ],
  fetch (pathResolved) {
    return api.getUsers().then(users => {
      const extraData = {}
      users.forEach(user => {
        extraData[`users/${user.id}`] = user
      })
      return {
        appendIndex: users.map(user => user.id),
        path: 'users/all',
        extraData,
      }
    })
  },
})

resolvers.push({
  match: "users/:uid/*",
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
  getParentPath: pathResolved => {
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
  }
})

export default resolvers
