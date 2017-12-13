import rootNodeReducer from '../root'
import { DATA_LOAD_SUCCESS, DATA_LOAD_UPDATE } from '../../config'

describe('rootNodeReducer data loading', () => {
  it('should prepend index replacing head', () => {
    const state = {
      someIndex: ['foo', 'bar', 'moo'],
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        appendIndex: ['someItem1', 'someItem2', 'foo'],
      },
    }
    const result = rootNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: ['someItem1', 'someItem2', 'foo', 'bar', 'moo'],
    })
  })

  it('should append index replacing tail', () => {
    const state = {
      someIndex: ['foo', 'bar', 'moo'],
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        appendIndex: ['bar', 'moo', 'someItem1', 'someItem2'],
      },
    }
    const result = rootNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: ['foo', 'bar', 'moo', 'someItem1', 'someItem2'],
    })
  })

  it('should replace index completely', () => {
    const state = {
      someIndex: ['foo', 'bar', 'moo'],
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        appendIndex: ['someItem1', 'foo', 'bar', 'moo', 'someItem2'],
      },
    }
    const result = rootNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: ['someItem1', 'foo', 'bar', 'moo', 'someItem2'],
    })
  })

  it('should append index if no overlapping items are found', () => {
    const state = {
      someIndex: ['foo', 'bar', 'moo'],
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        appendIndex: ['someItem1', 'someItem2'],
      },
    }
    const result = rootNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: ['foo', 'bar', 'moo', 'someItem1', 'someItem2'],
    })
  })
})

describe('rootNodeReducer data updates', () => {
  it('should remove empty leaves but leave the rest intact', () => {
    const state = {
      foo: {
        bar: {
          boo: 'baz'
        },
      },
      moo: 'poo',
    }
    const action = {
      type: DATA_LOAD_UPDATE,
      payload: {
        path: 'foo/bar/boo',
        remove: true,
      }
    }
    const result = rootNodeReducer(state, action)
    expect(state === result).toBe(false)
    expect(result).toEqual({moo: 'poo'})
    expect(Object.keys(result).length).toBe(1)
  })

  it('should remove empty leaves even if leaving an empty state', () => {
    const state = {
      foo: {
        bar: 'baz',
      },
    }
    const action = {
      type: DATA_LOAD_UPDATE,
      payload: {
        path: 'foo/bar',
        remove: true,
      }
    }
    const result = rootNodeReducer(state, action)
    expect(result).toEqual({})
    expect(state === result).toBe(false)
    expect(Object.keys(result).length).toBe(0)
  })

  it('should not impact state with inexistent path', () => {
    const state = {
      foo: {
        bar: 'baz',
      },
    }
    const stateStr = JSON.stringify(state)
    const action = {
      type: DATA_LOAD_UPDATE,
      payload: {
        path: 'foo/asdf',
        remove: true,
      }
    }
    const result = rootNodeReducer(state, action)
    expect(JSON.stringify(result)).toBe(stateStr)
    expect(result).toBe(state)
  })
})