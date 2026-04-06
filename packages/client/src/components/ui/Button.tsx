import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

interface LinkButtonProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  to: string;
}

function buttonClass(variant: ButtonVariant, size: ButtonSize): string {
  return `ds-btn ds-btn--${variant} ds-btn--${size}`;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size)} {...rest} />;
});

const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { variant = 'secondary', size = 'md', to, ...rest },
  ref,
) {
  return <Link ref={ref} to={to} className={buttonClass(variant, size)} {...rest} />;
});

export { Button, LinkButton };
export type { ButtonProps, LinkButtonProps, ButtonVariant, ButtonSize };
