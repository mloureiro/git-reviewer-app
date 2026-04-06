import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import './IconButton.css';

type IconButtonSize = 'sm' | 'md';
type IconButtonVariant = 'ghost' | 'secondary';

interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className'> {
  'aria-label': string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', variant = 'ghost', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ds-icon-btn ds-icon-btn--${size} ds-icon-btn--${variant}`}
      {...rest}
    />
  );
});

export { IconButton };
export type { IconButtonProps, IconButtonSize, IconButtonVariant };
