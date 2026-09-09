'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Mail, ChevronLeft, CheckCircle, Undo2 } from 'lucide-react';
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocument, useUser, deleteDocument } from '@/firebase';
import { doc, collection, query, where, Timestamp, serverTimestamp, orderBy } from 'firebase/firestore';
import type { ContributionRequest, Student, Contribution } from '@/lib/types';
import { useState } from 'react';
import { logAction } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils';

export default function RequestDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [revertingContribution, setRevertingContribution] = useState<Contribution | null>(null);

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
    if (!timestamp) return new Date(); // Safeguard for null/undefined timestamps
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
     if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }
    return new Date();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-2xl font-bold">Cargando...</h2>
      </div>
    );
  }
  
  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-2xl font-bold">Solicitud no encontrada</h2>
        <p className="text-muted-foreground">La solicitud de cooperación que buscas no existe.</p>
        <Button asChild className="mt-4">
          <Link href="/requests">Volver a Solicitudes</Link>
        </Button>
      </div>
    );
  }

  const paymentStatus = allStudents?.map(student => {
    const contribution = contributions?.find(c => c.studentId === student.id);
    return {
      studentId: student.id,
      studentName: student.name,
      status: contribution ? 'Pagado' as const : 'Pendiente' as const,
      paidDate: contribution ? toDate(contribution.date).toLocaleDateString() : null,
      contributionId: contribution?.id
    };
  }) || [];
  
  const handleSendReminder = (studentName: string) => {
    toast({
      title: '¡Recordatorio Enviado!',
      description: `Se ha enviado un recordatorio de cooperación a los padres de ${studentName}.`,
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
      logAction(firestore, `registró un pago de ${formatCurrency(request.amount)} de ${studentName} para "${request.title}"`, 'income', user.displayName || 'Admin');
      toast({
        title: '¡Pago Registrado!',
        description: `Se ha marcado la cooperación como pagada.`,
      });
      window.location.reload();
    } catch (e) {
      console.error("Error marking as paid:", e);
      toast({
        variant: "destructive",
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
      logAction(firestore, `revirtió un pago de ${revertingContribution.studentName} para "${revertingContribution.requestTitle}"`, 'income', user.displayName || 'Admin');
      toast({
        title: '¡Pago revertido!',
        description: 'El estado se ha cambiado a pendiente.',
      });
      setRevertingContribution(null);
      window.location.reload();
    } catch (e) {
      console.error("Error reverting payment:", e);
      toast({
        variant: "destructive",
        title: 'Error',
        description: 'No se pudo revertir el pago.',
      });
      setRevertingContribution(null);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" className="h-7 w-7" asChild>
            <Link href="/requests">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          {request.title}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de Pagos</CardTitle>
          <CardDescription>{request.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentStatus.map((p) => (
              <div key={p.studentId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-4">
                <div className="flex-1">
                  <p className="font-medium">{p.studentName}</p>
                  <div className="flex items-center gap-2 mt-1">
                      <Badge variant={p.status === 'Pagado' ? 'success' : 'destructive'}>
                        {p.status}
                      </Badge>
                      {p.paidDate && <span className="text-xs text-muted-foreground">{p.paidDate}</span>}
                  </div>
                </div>
                <div className="flex w-full sm:w-auto items-center justify-end gap-2">
                  {user && p.status === 'Pendiente' && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-auto" onClick={() => handleMarkAsPaid(p.studentId, p.studentName)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Pagar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleSendReminder(p.studentName)}>
                        <Mail className="h-4 w-4" />
                        <span className="sr-only">Enviar recordatorio</span>
                      </Button>
                    </>
                  )}
                  {user && p.status === 'Pagado' && (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
                      const contribution = contributions?.find(c => c.id === p.contributionId);
                      if (contribution) confirmRevertPayment(contribution);
                    }}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      Revertir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!revertingContribution} onOpenChange={(isOpen) => !isOpen && setRevertingContribution(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta Pagado ¿Quieres pasarlo a Pendiente??</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cambiará el estado a "Pendiente" y eliminará el registro del pago. Podrás volver a marcarlo como pagado más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsPending} className="bg-destructive hover:bg-destructive/90">
              Sí, revertir pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
