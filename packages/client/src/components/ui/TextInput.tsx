import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import './TextInput.css';

interface TextInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'type'> {
  type?: 'text' | 'email' | 'password' | 'search' | 'url';
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { type = 'text', ...rest },
  ref,
) {
  return <input ref={ref} type={type} className="ds-text-input" {...rest} />;
});

export { TextInput };
export type { TextInputProps };
