'use client';

import { Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';

export function Logo({ className }: { className?: string }) {
  const firestore = useFirestore();
  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);

  return (
    <div className={cn('flex items-center gap-3 p-3.5', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/15 to-accent/20 border border-white/30 dark:border-white/10 shadow-xs backdrop-blur-md overflow-hidden">
        {appSettings?.headerLogoUrl ? (
          <img
            src={appSettings.headerLogoUrl}
            alt="Logo Cooperación CMF"
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <Handshake className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
        <span className="font-headline text-base font-bold tracking-tight text-sidebar-foreground">
          Cooperación
        </span>
        <span className="text-[10px] font-semibold text-primary uppercase tracking-widest -mt-0.5">
          CMF
        </span>
      </div>
    </div>
  );
}
