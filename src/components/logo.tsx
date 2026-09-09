import { Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 p-4', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
        <Handshake className="h-5 w-5" />
      </div>
      <span className="hidden font-headline text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
        Cooperación
      </span>
    </div>
  );
}
