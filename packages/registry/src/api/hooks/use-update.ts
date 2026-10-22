'use client';

import {useReducer} from 'react';

/**
 * Returns a function that forces a re-render
 */
function useUpdate(): () => void {
  const [, update] = useReducer((x: number) => x + 1, 0);
  return update;
}

export default useUpdate;
