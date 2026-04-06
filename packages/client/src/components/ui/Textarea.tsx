import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import './Textarea.css';

type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'className'>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(props, ref) {
  return <textarea ref={ref} className="ds-textarea" {...props} />;
});

export { Textarea };
export type { TextareaProps };
