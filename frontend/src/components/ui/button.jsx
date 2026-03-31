
import React from 'react';
import { Link } from 'react-router-dom';

export function Button({ className = '', variant = 'default', size = 'default', asChild = false, children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none';
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
    destructive: 'bg-destructive text-white hover:bg-destructive/90',
  };
  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md gap-1.5 px-3',
    lg: 'h-10 rounded-md px-6',
    icon: 'size-9 rounded-md',
  };
  const cls = `${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`.trim();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: [children.props.className || '', cls].join(' ').trim(),
    });
  }

  return <button className={cls} {...props}>{children}</button>;
}
