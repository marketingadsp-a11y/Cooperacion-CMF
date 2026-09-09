'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import type { LogEntry } from '@/lib/types';
import {
  History,
  TrendingUp,
  TrendingDown,
  UserPlus,
  FilePlus,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function LogPage() {
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'logs'), orderBy('timestamp', 'desc')) : null),
    [firestore]
  );
  const { data: logs, isLoading } = useCollection<LogEntry>(logsQuery);

  const toDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }
    return new Date();
  };

  const getIconForType = (type: LogEntry['type']) => {
    switch (type) {
      case 'income':
        return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case 'expense':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'student':
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'request':
        return <FilePlus className="h-5 w-5 text-purple-500" />;
      case 'system':
        return <Trash2 className="h-5 w-5 text-amber-500" />;
      default:
        return <History className="h-5 w-5 text-gray-400" />;
    }
  };

  const getBadgeStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'income':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'expense':
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
      case 'student':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'request':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'system':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getBadgeLabel = (type: LogEntry['type']) => {
    switch (type) {
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Gasto';
      case 'student':
        return 'Alumno';
      case 'request':
        return 'Cooperación';
      case 'system':
        return 'Sistema';
      default:
        return 'Actividad';
    }
  };

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Liquid Glass */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-inner backdrop-blur-md">
          <History className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Bitácora de Actividad
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
              {logs?.length || 0}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Auditoría y registro cronológico de acciones
          </p>
        </div>
      </div>

      {/* Contenedor Liquid Glass de Registros */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-base sm:text-lg font-bold">Registros Recientes</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Últimos eventos
          </span>
        </CardHeader>

        <CardContent className="p-3 sm:p-5">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Cargando bitácora de actividad...</p>
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-base font-semibold text-foreground">Sin actividad registrada</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Los movimientos que realicen los administradores aparecerán listados aquí.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[65vh] pr-2">
              <div className="space-y-3">
                {logs.map((log) => {
                  const date = toDate(log.timestamp);
                  const dateStr = date.toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                  });
                  const timeStr = date.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xs flex items-start gap-3.5 transition-all hover:bg-white/80"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
                        {getIconForType(log.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {log.user}{' '}
                            <span className="font-normal text-muted-foreground">
                              {log.action}
                            </span>
                          </p>
                          <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                            {dateStr}, {timeStr}
                          </span>
                        </div>

                        <div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(
                              log.type
                            )}`}
                          >
                            {getBadgeLabel(log.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
