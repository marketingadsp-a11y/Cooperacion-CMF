'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ContributionRequest, Contribution, Student } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  PlusCircle,
  MoreHorizontal,
  Handshake,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  deleteDocument,
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { RequestForm } from './request-form';
import { logAction } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

export default function RequestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'contribution_requests') : null),
    [firestore]
  );

  const requestsQuery = useMemoFirebase(
    () => (requestsCollection ? query(requestsCollection, orderBy('createdAt', 'desc')) : null),
    [requestsCollection]
  );
  const { data: requests, isLoading } = useCollection<ContributionRequest>(requestsQuery);

  const allContributionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'contributions') : null),
    [firestore]
  );
  const { data: allContributions } = useCollection<Contribution>(allContributionsQuery);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'students') : null),
    [firestore]
  );
  const { data: allStudents } = useCollection<Student>(allStudentsQuery);

  const [editingRequest, setEditingRequest] = useState<ContributionRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<ContributionRequest | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);

  const handleOpenForm = (request: ContributionRequest | null = null) => {
    setEditingRequest(request);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setTimeout(() => {
      setEditingRequest(null);
    }, 150);
  };

  const handleDeleteRequest = async () => {
    if (!firestore || !deletingRequest || !deletingRequest.id || !user) return;

    try {
      const requestDocRef = doc(firestore, 'contribution_requests', deletingRequest.id);
      await deleteDocument(requestDocRef);
      logAction(
        firestore,
        `eliminó la solicitud: "${deletingRequest.title}"`,
        'request',
        user.displayName || 'Admin'
      );
      toast({ title: 'Solicitud eliminada' });
      setDeletingRequest(null);
      window.location.reload();
    } catch (e) {
      console.error('Error deleting request:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la solicitud.',
      });
      setDeletingRequest(null);
    }
  };

  const totalStudentsCount = allStudents?.length || 0;

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Liquid Glass */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-inner backdrop-blur-md">
            <Handshake className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Cooperaciones
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
                {requests?.length || 0}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Solicitudes y seguimiento de cuotas por alumno
            </p>
          </div>
        </div>

        {user && (
          <Button
            onClick={() => handleOpenForm()}
            size="sm"
            className="w-full sm:w-auto h-11 sm:h-10 rounded-xl shadow-md bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white border border-white/20 font-medium transition-all active:scale-[0.98]"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" />
            Nueva Solicitud
          </Button>
        )}
      </div>

      <RequestForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        request={editingRequest}
      />

      {/* Listado de Cooperaciones estilo Apple Liquid Glass */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Cargando solicitudes de cooperación...</p>
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
          {requests.map((request) => {
            const contributions =
              allContributions?.filter((c) => c.requestId === request.id) || [];
            const totalCollected = contributions.reduce((sum, c) => sum + c.amount, 0);
            const paidCount = contributions.length;
            const progressPercent = totalStudentsCount
              ? Math.min(Math.round((paidCount / totalStudentsCount) * 100), 100)
              : 0;

            return (
              <div
                key={request.id}
                className="group relative rounded-3xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-zinc-900/65 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Cabecera de la tarjeta */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-foreground tracking-tight leading-snug break-words">
                        {request.title}
                      </h3>
                      {request.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {request.description}
                        </p>
                      )}
                    </div>

                    {user && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                          >
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl"
                        >
                          <DropdownMenuItem
                            onClick={() => handleOpenForm(request)}
                            className="rounded-xl cursor-pointer"
                          >
                            <Edit3 className="mr-2 h-4 w-4 text-primary" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive rounded-xl cursor-pointer"
                            onClick={() => setDeletingRequest(request)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Resumen de montos */}
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                        {formatCurrency(request.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                        por alumno
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                        {progressPercent}% recaudado
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso Liquid Glass */}
                  <div className="space-y-1.5 pt-1">
                    <div className="h-2.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 shadow-xs"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                      <span className="font-medium text-foreground">
                        {formatCurrency(totalCollected)} recaudados
                      </span>
                      <span>
                        {paidCount} de {totalStudentsCount} alumnos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pie de tarjeta con botón táctil directo */}
                <div className="p-4 sm:p-5 pt-0">
                  <Button
                    asChild
                    className="w-full h-11 rounded-2xl font-semibold shadow-md bg-white dark:bg-zinc-800 text-foreground hover:bg-white/90 dark:hover:bg-zinc-700/90 border border-white/50 dark:border-white/15 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Link href={`/requests/${request.id}`}>
                      <span>Ver Estado de Pagos</span>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 px-4 text-center space-y-4 rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
            <Handshake className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-foreground">
              No hay solicitudes de cooperación
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              Crea la primera solicitud para comenzar a registrar los pagos de los alumnos.
            </p>
          </div>
          {user && (
            <Button
              onClick={() => handleOpenForm()}
              size="sm"
              className="rounded-xl shadow-md bg-gradient-to-r from-primary to-accent text-white"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Crear primera solicitud
            </Button>
          )}
        </div>
      )}

      {/* Alerta de confirmación de eliminación */}
      <AlertDialog
        open={!!deletingRequest}
        onOpenChange={(isOpen) => !isOpen && setDeletingRequest(null)}
      >
        <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              ¿Eliminar solicitud de cooperación?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Esta acción eliminará permanentemente la solicitud "{deletingRequest?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 rounded-xl border-white/40 dark:border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium shadow-md"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
