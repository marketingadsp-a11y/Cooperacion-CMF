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
        return <Trash2 className="h-5 w-5 text-gray-500" />;
      default:
        return <History className="h-5 w-5 text-gray-400" />;
    }
  };

  const getBadgeVariant = (type: LogEntry['type']): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | null | undefined => {
    switch (type) {
        case 'income': return 'success';
        case 'expense': return 'destructive';
        case 'student': return 'default';
        case 'request': return 'secondary';
        case 'system': return 'outline';
        default: return 'outline';
    }
  };


  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Bitácora de Actividad
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registros Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Cargando registros...</p>}
          {!isLoading && logs && logs.length === 0 && (
            <p className="text-muted-foreground">No hay actividad registrada todavía.</p>
          )}
          {logs && logs.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <ul className="space-y-4">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {getIconForType(log.type)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">
                                {log.user} <span className="font-normal text-muted-foreground">{log.action}</span>
                            </p>
                             <span className="text-xs text-muted-foreground">
                                {toDate(log.timestamp).toLocaleString('es-MX')}
                            </span>
                        </div>
                         <Badge variant={getBadgeVariant(log.type)} className="mt-1 capitalize">
                            {log.type === 'income' ? 'Ingreso' 
                            : log.type === 'expense' ? 'Gasto' 
                            : log.type === 'student' ? 'Alumno' 
                            : log.type === 'request' ? 'Solicitud' 
                            : 'Sistema'}
                        </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
