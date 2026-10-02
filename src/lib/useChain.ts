import { useRef } from 'react';
import { TextInput } from 'react-native';

export function useChain(total: number) {
  const refs = useRef<(TextInput | null)[]>([]);
  return (index: number) => {
    const last = index >= total - 1;
    return {
      ref: (r: TextInput | null) => {
        refs.current[index] = r;
      },
      returnKeyType: (last ? 'done' : 'next') as 'done' | 'next',
      blurOnSubmit: last,
      onSubmitEditing: () => {
        if (!last && refs.current[index + 1]) {
          refs.current[index + 1]!.focus();
        }
      },
    };
  };
}
