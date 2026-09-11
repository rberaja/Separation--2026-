import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * Controlled `<input type="number">` that reports `null` for a blank field instead of NaN.
 *
 * While focused it displays exactly what the user has typed (a local draft), so a
 * store that clamps or rejects an intermediate value doesn't fight the keyboard.
 * On blur the draft is dropped and the input re-syncs with `value`.
 */
export function NumberInput({ value, onChange, onBlur, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === '') return onChange(null);
    const n = Number(raw);
    onChange(Number.isNaN(n) ? null : n);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setDraft(null);
    onBlur?.(e);
  };

  return (
    <input
      type="number"
      value={draft ?? value ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      {...rest}
    />
  );
}
