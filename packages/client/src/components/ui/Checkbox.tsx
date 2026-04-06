import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import './Checkbox.css';

type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'type'>;

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  return <input ref={ref} type="checkbox" className="ds-checkbox" {...props} />;
});

export { Checkbox };
export type { CheckboxProps };
