'use client';
import { useState } from 'react';
import { StatCard } from '@/components/stat-card';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { logAction } from '@/lib/logger';


import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  Database,
  CheckCircle,
  ShoppingCart,
  UserX,
  Receipt,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import type { Student, Contribution, ContributionRequest, Expense } from '@/lib/types';
import { useUser, useCollection, useFirestore, useMemoFirebase, addDocument, deleteDocument } from '@/firebase';
import { collection, query, orderBy, Timestamp, serverTimestamp, doc } from 'firebase/firestore';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isExpensesModalOpen, setExpensesModalOpen] = useState(false);
  const [isPendingModalOpen, setPendingModalOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);
  const [revertingContribution, setRevertingContribution] = useState<Contribution | null>(null);

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: students } = useCollection<Student>(studentsQuery);
  
  const contributionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'contributions') : null),
    [firestore]
  );
  const { data: contributions } = useCollection<Contribution>(contributionsQuery);

  const contributionRequestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'contribution_requests'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const { data: contributionRequests } = useCollection<ContributionRequest>(contributionRequestsQuery);
  
  const expensesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'expenses'), orderBy('date', 'desc')) : null),
    [firestore]
  );
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const totalIncome = contributions?.reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const balance = totalIncome - totalExpenses;
  
  const mostRecentRequestId = contributionRequests && contributionRequests.length > 0 ? contributionRequests[0].id : undefined;
  const mostRecentRequestTitle = contributionRequests && contributionRequests.length > 0 ? contributionRequests[0].title : '';

  const studentContributionStatus = (
    requestId: string
  ): { student: Student; paid: boolean; contribution: Contribution | undefined }[] => {
    if (!students) return [];
    return students.map((student) => {
      const contribution = contributions?.find(
        (c) => c.studentId === student.id && c.requestId === requestId
      );
      return { student, paid: !!contribution, contribution };
    });
  };

  const statusForRecentRequest = mostRecentRequestId ? studentContributionStatus(mostRecentRequestId) : [];
  const paidStudentsCount = statusForRecentRequest.filter(s => s.paid).length;
  const pendingStudentsCount = (students?.length ?? 0) - paidStudentsCount;
  const pendingStudents = statusForRecentRequest.filter(s => !s.paid);
  
  const toDate = (timestamp: any): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }
    return new Date();
  }
  
  const handleMarkAsPaid = (studentId: string, studentName: string, requestId: string, requestTitle: string, amount: number) => {
    if (!firestore || !user) return;

    const contributionsCollection = collection(firestore, 'contributions');
    const newContribution = {
      studentId,
      studentName,
      requestId,
      requestTitle,
      amount,
      date: serverTimestamp(),
    };
    
    addDocument(contributionsCollection, newContribution);
    logAction(firestore, `registró un pago de ${formatCurrency(amount)} de ${studentName} para "${requestTitle}"`, 'income', user.displayName || 'Admin');
    toast({
      title: '¡Pago Registrado!',
      description: `Se ha marcado la cooperación como pagada.`,
    });
  };

  const confirmRevertPayment = (contribution: Contribution | undefined) => {
    if (!contribution) return;
    setRevertingContribution(contribution);
  };

  const handleRevertPayment = async () => {
    if (!firestore || !revertingContribution || !user) return;

    const contributionDocRef = doc(firestore, 'contributions', revertingContribution.id!);
    await deleteDocument(contributionDocRef);
    logAction(firestore, `revirtió un pago de ${revertingContribution.studentName} para "${revertingContribution.requestTitle}"`, 'income', user.displayName || 'Admin');
    toast({
      title: '¡Pago revertido!',
      description: 'El estado se ha cambiado a pendiente.',
    });
    setRevertingContribution(null);
  };


  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Saldo en Caja"
          value={formatCurrency(balance)}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          variant="gradient"
          gradient={balance < 0 ? 'from-red-500 to-pink-500' : 'from-blue-500 to-sky-400'}
        />
        
        <Dialog open={isPendingModalOpen} onOpenChange={setPendingModalOpen}>
          <DialogTrigger asChild>
            <div className="cursor-pointer">
              <StatCard
                title="Sin Cooperación"
                value={pendingStudentsCount === 1 && pendingStudents.length > 0 ? pendingStudents[0].student.name : `${pendingStudentsCount}`}
                description={pendingStudentsCount === 1 ? "Alumno pendiente (Reciente)" : "Alumnos pendientes (Reciente)"}
                icon={<UserX className="h-6 w-6 text-white" />}
                variant="gradient"
                gradient="from-orange-500 to-red-600"
              />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-w-[95vw] w-full">
            <DialogHeader>
              <DialogTitle>Pendientes: {mostRecentRequestTitle}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden space-y-2.5 pr-1 py-1">
              {pendingStudents?.map(({ student }) => (
                <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 sm:p-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <UserX className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{student.parentName}</p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="shrink-0">Pendiente</Badge>
                </div>
              ))}
              {pendingStudents?.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                  <h3 className="font-semibold text-lg">¡Todo al día!</h3>
                  <p className="text-muted-foreground">No hay alumnos pendientes para esta solicitud.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isExpensesModalOpen} onOpenChange={setExpensesModalOpen}>
          <DialogTrigger asChild>
             <div className="cursor-pointer">
              <StatCard
                title="Gastos Totales"
                value={formatCurrency(totalExpenses)}
                description="Clic para ver detalle"
                icon={<ArrowDownLeft className="h-5 w-5 text-white" />}
                variant="gradient"
                gradient="from-red-500 to-orange-500"
              />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-w-[95vw] w-full">
            <DialogHeader>
              <DialogTitle>Registro de Gastos</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden space-y-2.5 pr-1 py-1">
              {expenses?.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 sm:p-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate" title={expense.description}>{expense.description}</p>
                      <p className="text-xs text-muted-foreground">{toDate(expense.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {expense.receiptUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1 rounded-md"
                        onClick={() => setViewingReceipt(expense)}
                        title="Ver ticket del gasto"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Ticket</span>
                      </Button>
                    )}
                    <span className="font-bold text-destructive text-sm sm:text-base whitespace-nowrap">
                      -{formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {expenses?.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg">Sin Gastos</h3>
                  <p className="text-muted-foreground">Aún no se han registrado gastos.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        <StatCard
          title="Total de Alumnos"
          value={`${students?.length ?? 0}`}
          icon={<Users className="h-5 w-5 text-sky-500" />}
          description={
             <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center font-semibold text-blue-500">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {paidStudentsCount} Pagado
                </span>
                <span className="flex items-center font-semibold text-orange-500">
                  <XCircle className="mr-1 h-3 w-3" />
                  {pendingStudentsCount} Pendiente
                </span>
              </div>
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Estado de Cooperaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {mostRecentRequestId && (
            <Accordion type="single" collapsible className="w-full" defaultValue={mostRecentRequestId}>
              {(contributionRequests || []).map((request) => (
                <AccordionItem value={request.id!} key={request.id}>
                  <AccordionTrigger>
                    <div className="flex w-full items-center justify-between pr-4">
                      <span>{request.title}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(request.amount)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="divide-y divide-border">
                      {studentContributionStatus(request.id!).map(
                        ({ student, paid, contribution }) => (
                          <li
                            key={student.id}
                            className="flex items-center justify-between p-3 hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              {paid ? (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                  <CheckCircle2 className="h-5 w-5" />
                                </div>
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                                  <XCircle className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{student.name}</p>
                                <p className="text-sm text-muted-foreground">{student.parentName}</p>
                              </div>
                            </div>

                            {paid && contribution ? (
                              <button
                                onClick={() => confirmRevertPayment(contribution)}
                                disabled={!user}
                                className="flex items-center text-sm font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 hover:opacity-80 transition-opacity"
                              >
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                Pagado
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="hidden items-center text-sm font-semibold text-gray-500 sm:flex">
                                  <XCircle className="mr-1.5 h-4 w-4" />
                                  Pendiente
                                </span>
                                {user && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(student.id!, student.name, request.id!, request.title, request.amount)}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">Marcar como Pagado</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </li>
                        )
                      )}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
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
            <AlertDialogAction onClick={handleRevertPayment} className="bg-destructive hover:bg-destructive/90">
              Sí, revertir pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal / Lightbox para visualizar el ticket del gasto */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" />
              Comprobante de Gasto
            </DialogTitle>
            {viewingReceipt && (
              <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground pt-1 border-b pb-2">
                <span className="font-medium text-foreground">{viewingReceipt.description}</span>
                <span>
                  <strong className="text-foreground">{formatCurrency(viewingReceipt.amount)}</strong> • {toDate(viewingReceipt.date).toLocaleDateString()}
                </span>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto my-3 flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-lg p-2 min-h-[250px]">
            {viewingReceipt?.receiptUrl ? (
              <img
                src={viewingReceipt.receiptUrl}
                alt={`Ticket de ${viewingReceipt.description}`}
                className="max-h-[60vh] max-w-full object-contain rounded shadow-sm"
              />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <ImageIcon className="mx-auto h-12 w-12 opacity-40 mb-2" />
                <p>No se pudo cargar la imagen del comprobante.</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t">
            {viewingReceipt?.receiptUrl && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={viewingReceipt.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir imagen original
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => setViewingReceipt(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
