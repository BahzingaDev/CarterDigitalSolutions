import { useCallback, useEffect } from 'react';

export function fingerprint(value: unknown) {
  return JSON.stringify(value);
}

export function useUnsavedChanges(isDirty: boolean, onDirtyChange?: (isDirty: boolean) => void) {
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  return useCallback(
    () => !isDirty || window.confirm('Discard unsaved changes?'),
    [isDirty],
  );
}
