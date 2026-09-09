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
        'rounded-full p-2',
        variant === 'gradient' ? 'bg-white/20' : 'bg-gray-100'
      )}
    >
      {icon}
    </div>
  );

  return (
    <Card
      className={cn(
        'rounded-2xl border-none shadow-lg',
        variant === 'gradient' ? 'text-white bg-gradient-to-br' : 'bg-white/60 backdrop-blur-lg',
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
