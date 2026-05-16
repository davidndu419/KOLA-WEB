'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

export function useStableLiveQuery<T>(
  querier: () => Promise<T | undefined> | T | undefined,
  deps: unknown[],
  initialValue?: T
) {
  const result = useLiveQuery(querier, deps);
  const [stableResult, setStableResult] = useState<T | undefined>(initialValue);

  useEffect(() => {
    if (result !== undefined) {
      setStableResult(result);
    }
  }, [result]);

  return stableResult;
}
