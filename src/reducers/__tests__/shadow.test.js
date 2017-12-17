import shadowNodeReducer from '../shadow'
import { DATA_LOAD_SUCCESS, DATA_LOAD_UPDATE } from '../../config'

describe('shadowReducer append index', () => {
  it('should save if indexStart or indexEnd is present', () => {
    const state = {
      someIndex: {
        startedLoadingAt: 123,
      },
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        dataPath: 'someIndex',
        appendIndex: ['someItem1', 'someItem2', 'foo'],
        indexStart: true,
        timestamp: 123,
      },
    }
    const result = shadowNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: {
        loadedAt: 123,
        indexStart: true,
      },
    })
  })


  it('should save retain previously saved indexStart', () => {
    const state = {
      someIndex: {
        loadedAt: 123,
        indexStart: true,
      },
    }
    const action = {
      type: DATA_LOAD_SUCCESS,
      payload: {
        path: 'someIndex',
        appendIndex: ['foo', 'foo234'],
        timestamp: 234,
      },
    }
    const result = shadowNodeReducer(state, action)
    expect(result).toEqual({
      someIndex: {
        loadedAt: 234,
        indexStart: true,
      },
    })
  })
})
