'use client';

import { useEffect } from 'react';
import { runMigrations } from '@/db/migrations';

export function DBInitializer() {
  useEffect(() => {
    runMigrations();
  }, []);

  return null;
}
