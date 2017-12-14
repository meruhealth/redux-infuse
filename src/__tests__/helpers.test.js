import { parseRoutePath } from '../helpers'

describe('parseRoutePath()', () => {
  it('should not match too long route', () => {
    const pattern = 'foo/:bar/:poo'
    const route = 'foo/12345/4355/asdf'
    const result = parseRoutePath(route, pattern)
    expect(result).toBe(false)
  })

  it ('should match long route if * is at the end', () => {
    const pattern = 'foo/:bar/*'
    const route = 'foo/12345/4355/asdf'
    const result = parseRoutePath(route, pattern)
    expect(result).toEqual({bar: '12345', rest: '4355/asdf'})
  })
})