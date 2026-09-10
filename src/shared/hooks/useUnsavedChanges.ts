import { useEffect } from 'react';
import { registerDirtyForm } from '../lib/navigationGuard';

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unregister = registerDirtyForm();
    const handle = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handle);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', handle);
    };
  }, [dirty]);
  return () => !dirty || window.confirm('저장하지 않은 변경 사항을 버릴까요?');
}
