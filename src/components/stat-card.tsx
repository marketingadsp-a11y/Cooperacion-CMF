'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  description?: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient';
  gradient?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon,
  className,
  variant = 'default',
  gradient,
}: StatCardProps) {
  const iconContainer = (
    <div
      className={cn(
        'rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110',
        variant === 'gradient'
          ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-xs'
          : 'bg-primary/10 border border-primary/20 text-primary backdrop-blur-md shadow-xs'
      )}
    >
      {icon}
    </div>
  );

  return (
    <Card
      className={cn(
        'group rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 overflow-hidden',
        variant === 'gradient'
          ? 'text-white bg-gradient-to-br border border-white/35 shadow-[0_10px_32px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.45)] backdrop-blur-2xl'
          : 'bg-white/75 dark:bg-zinc-900/65 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_10px_32px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)]',
        gradient,
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn('text-sm font-medium', {
            'text-white/80': variant === 'gradient',
            'text-gray-500': variant === 'default',
          })}
        >
          {title}
        </CardTitle>
        {iconContainer}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && typeof description === 'string' ? (
          <p
            className={cn('text-xs', {
              'text-white/70': variant === 'gradient',
              'text-gray-500': variant === 'default',
            })}
          >
            {description}
          </p>
        ) : (
          description
        )}
      </CardContent>
    </Card>
  );
}
