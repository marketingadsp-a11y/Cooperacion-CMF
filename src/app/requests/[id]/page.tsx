'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  ChevronLeft,
  CheckCircle,
  Undo2,
  Handshake,
  DollarSign,
  UserCheck,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import {
  useDoc,
  useCollection,
  useFirestore,
  useMemoFirebase,
  addDocument,
  useUser,
  deleteDocument,
} from '@/firebase';
import {
  doc,
  collection,
  query,
  where,
  Timestamp,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import type { ContributionRequest, Student, Contribution } from '@/lib/types';
import { useState } from 'react';
import { logAction } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function RequestDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [revertingContribution, setRevertingContribution] = useState<Contribution | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  const requestDocRef = useMemoFirebase(
    () => (firestore && id ? doc(firestore, 'contribution_requests', id) : null),
    [firestore, id]
  );
  const { data: request, isLoading: isRequestLoading } = useDoc<ContributionRequest>(requestDocRef);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: allStudents, isLoading: areStudentsLoading } = useCollection<Student>(allStudentsQuery);

  const contributionsQuery = useMemoFirebase(
    () => (firestore && id ? query(collection(firestore, 'contributions'), where('requestId', '==', id)) : null),
    [firestore, id]
  );
  const { data: contributions, isLoading: areContributionsLoading } = useCollection<Contribution>(contributionsQuery);

  const isLoading = isRequestLoading || areStudentsLoading || areContributionsLoading;

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Cargando estado de la cooperación...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 space-y-4">
        <h2 className="text-2xl font-bold">Solicitud no encontrada</h2>
        <p className="text-muted-foreground">La solicitud de cooperación que buscas no existe o fue eliminada.</p>
        <Button asChild className="rounded-xl">
          <Link href="/requests">Volver a Solicitudes</Link>
        </Button>
      </div>
    );
  }

  const paymentStatus =
    allStudents?.map((student) => {
      const contribution = contributions?.find((c) => c.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        parentName: student.parentName,
        status: contribution ? ('Pagado' as const) : ('Pendiente' as const),
        paidDate: contribution ? toDate(contribution.date).toLocaleDateString() : null,
        contributionId: contribution?.id,
        rawContribution: contribution,
      };
    }) || [];

  const handleSendReminder = (studentName: string) => {
    toast({
      title: '¡Recordatorio Enviado!',
      description: `Se ha enviado un recordatorio a los padres de ${studentName}.`,
    });
  };

  const handleMarkAsPaid = async (studentId: string, studentName: string) => {
    if (!firestore || !request || !request.amount || !user) return;

    const contributionsCollection = collection(firestore, 'contributions');
    const newContribution = {
      studentId,
      studentName,
      requestId: id,
      requestTitle: request.title,
      amount: request.amount,
      date: serverTimestamp(),
    };

    try {
      await addDocument(contributionsCollection, newContribution);
      logAction(
        firestore,
        `registró un pago de ${formatCurrency(request.amount)} de ${studentName} para "${request.title}"`,
        'income',
        user.displayName || 'Admin'
      );
      toast({
        title: '¡Pago Registrado!',
        description: `Se ha marcado a ${studentName} como pagado.`,
      });
      window.location.reload();
    } catch (e) {
      console.error('Error marking as paid:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo registrar el pago.',
      });
    }
  };

  const confirmRevertPayment = (contribution: Contribution) => {
    setRevertingContribution(contribution);
  };

  const handleMarkAsPending = async () => {
    if (!firestore || !revertingContribution || !user) return;

    try {
      const contributionDocRef = doc(firestore, 'contributions', revertingContribution.id!);
      await deleteDocument(contributionDocRef);
      logAction(
        firestore,
        `revirtió un pago de ${revertingContribution.studentName} para "${revertingContribution.requestTitle}"`,
        'income',
        user.displayName || 'Admin'
      );
      toast({
        title: '¡Pago revertido!',
        description: 'El estado se ha cambiado a pendiente.',
      });
      setRevertingContribution(null);
      window.location.reload();
    } catch (e) {
      console.error('Error reverting payment:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo revertir el pago.',
      });
      setRevertingContribution(null);
    }
  };

  const totalStudents = paymentStatus.length;
  const paidCount = paymentStatus.filter((p) => p.status === 'Pagado').length;
  const pendingCount = totalStudents - paidCount;
  const percentCollected = totalStudents ? Math.round((paidCount / totalStudents) * 100) : 0;
  const totalAmountCollected = paidCount * request.amount;

  const filteredList = paymentStatus.filter((p) => {
    const matchesSearch =
      p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.parentName && p.parentName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (statusFilter === 'paid') return matchesSearch && p.status === 'Pagado';
    if (statusFilter === 'pending') return matchesSearch && p.status === 'Pendiente';
    return matchesSearch;
  });

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Botón Volver y Título */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-2xl border-white/40 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md shadow-xs"
          asChild
        >
          <Link href="/requests">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {request.title}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {request.description || 'Seguimiento individual de pagos'}
          </p>
        </div>
      </div>

      {/* Widget Resumen Liquid Glass */}
      <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-zinc-900/65 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/5">
            <span className="text-xs text-muted-foreground block font-medium">Cuota</span>
            <span className="text-xl sm:text-2xl font-extrabold text-foreground">
              {formatCurrency(request.amount)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/5">
            <span className="text-xs text-muted-foreground block font-medium">Recaudado</span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalAmountCollected)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/5">
            <span className="text-xs text-muted-foreground block font-medium">Pagados</span>
            <span className="text-xl sm:text-2xl font-extrabold text-foreground">
              {paidCount} <span className="text-xs text-muted-foreground font-normal">/ {totalStudents}</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/5">
            <span className="text-xs text-muted-foreground block font-medium">Pendientes</span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </span>
          </div>
        </div>

        {/* Barra de progreso Liquid Glass */}
        <div className="space-y-1.5 pt-1">
          <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/10">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${percentCollected}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{percentCollected}% completado</span>
            <span>{paidCount} alumnos al día</span>
          </div>
        </div>
      </div>

      {/* Directorio de Alumnos y Pagos */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        {/* Barra de filtros y búsqueda */}
        <div className="p-3.5 sm:p-5 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar alumno..."
              className="w-full h-11 rounded-2xl bg-white/80 dark:bg-black/40 border-muted-foreground/20 pl-10 pr-9 focus-visible:ring-primary text-base shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtros estilo segmented control Apple */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({totalStudents})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                statusFilter === 'paid'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pagados ({paidCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                statusFilter === 'pending'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pendientes ({pendingCount})
            </button>
          </div>
        </div>

        <CardContent className="p-2 sm:p-4">
          <div className="space-y-2.5">
            {filteredList.map((p) => {
              const isPaid = p.status === 'Pagado';
              const initials = getInitials(p.studentName);

              return (
                <div
                  key={p.studentId}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isPaid
                      ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] border-emerald-500/20'
                      : 'bg-white/60 dark:bg-zinc-800/40 border-white/40 dark:border-white/10'
                  } backdrop-blur-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs shrink-0 border ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      }`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-base tracking-tight truncate">
                          {p.studentName}
                        </p>
                        <Badge
                          variant={isPaid ? 'success' : 'outline'}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {p.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {p.parentName && <span>Tutor: {p.parentName}</span>}
                        {p.paidDate && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80 font-medium">Pagó el {p.paidDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones táctiles para celular y desktop */}
                  {user && (
                    <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
                      {!isPaid ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-initial h-10 rounded-xl font-semibold shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 text-xs transition-all active:scale-[0.98]"
                            onClick={() => handleMarkAsPaid(p.studentId, p.studentName)}
                          >
                            <CheckCircle className="mr-1.5 h-4 w-4" />
                            Marcar Pagado
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-muted/60"
                            onClick={() => handleSendReminder(p.studentName)}
                            title="Enviar recordatorio"
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="sr-only">Enviar recordatorio</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto h-10 rounded-xl text-xs font-medium border-white/40 dark:border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                          onClick={() => {
                            if (p.rawContribution) confirmRevertPayment(p.rawContribution);
                          }}
                        >
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                          Revertir Pago
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No hay alumnos que coincidan con la búsqueda o filtro seleccionado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerta de confirmación para revertir pago */}
      <AlertDialog
        open={!!revertingContribution}
        onOpenChange={(isOpen) => !isOpen && setRevertingContribution(null)}
      >
        <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <Undo2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              ¿Revertir pago de {revertingContribution?.studentName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Esta acción cambiará el estado a "Pendiente" y cancelará el comprobante de pago registrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 rounded-xl border-white/40 dark:border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkAsPending}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium shadow-md"
            >
              Sí, revertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
