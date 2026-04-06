import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import './Select.css';

type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className'>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  return <select ref={ref} className="ds-select" {...props} />;
});

export { Select };
export type { SelectProps };
