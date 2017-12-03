
export default function appState (state = {}, action) {
  switch (action.type) {
    case 'TEST':
      return {
        ...state,
        test: action.payload,
      }

    default:
      return state
  }
}
