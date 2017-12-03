
export default function appState (state = {}, action) {
  switch (action.type) {
    case 'TEST':
      return {
        ...state,
        test: (state.test === action.payload ? null : action.payload),
      }

    default:
      return state
  }
}
