import { cn } from '@/utils/cn';

export default function Card({ as: Component = 'section', className, children, ...props }) {
  return (
    <Component
      className={cn('rounded-card bg-surface p-5 shadow-card ring-1 ring-slate-900/5', className)}
      {...props}
    >
      {children}
    </Component>
  );
}
