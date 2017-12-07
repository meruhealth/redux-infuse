import rootNodeReducer from '../root'

describe('rootNodeReducer', () => {
  it('should prepend index replacing head', () => {
    const state = {
      someIndex: ['foo', 'bar', 'moo'],
    }
    const action = {
      type: 'DATA_LOAD_SUCCESS',
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
      type: 'DATA_LOAD_SUCCESS',
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
      type: 'DATA_LOAD_SUCCESS',
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
      type: 'DATA_LOAD_SUCCESS',
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