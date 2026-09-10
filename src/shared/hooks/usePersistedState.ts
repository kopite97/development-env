import { useState } from 'react';
export function usePersistedState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [state, setState] = useState<T>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      return validate(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState('');
  function save(value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setState(value);
      setError('');
      return true;
    } catch {
      setError(
        '브라우저에 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인한 뒤 다시 시도해 주세요.',
      );
      return false;
    }
  }
  return [state, save, error] as const;
}
