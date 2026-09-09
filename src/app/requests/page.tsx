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
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocument } from '@/firebase';
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
  const { data: requests } = useCollection<ContributionRequest>(requestsQuery);

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
  const [openRequestId, setOpenRequestId] = useState<string>('');
  const [initialRequestsLoaded, setInitialRequestsLoaded] = useState(false);

  useEffect(() => {
    if (requests && !initialRequestsLoaded) {
      if (requests.length > 0 && requests[0].id) {
        setOpenRequestId(requests[0].id);
      }
      setInitialRequestsLoaded(true);
    }
  }, [requests, initialRequestsLoaded]);

  const handleOpenForm = (request: ContributionRequest | null = null) => {
    setEditingRequest(request);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    // Delay resetting to allow dialog to animate out
    setTimeout(() => {
      setEditingRequest(null);
    }, 150);
  };
  
  const handleDeleteRequest = async () => {
    if (!firestore || !deletingRequest || !deletingRequest.id || !user) return;

    try {
      const requestDocRef = doc(firestore, 'contribution_requests', deletingRequest.id);
      await deleteDocument(requestDocRef);
      logAction(firestore, `eliminó la solicitud: "${deletingRequest.title}"`, 'request', user.displayName || 'Admin');
      toast({ title: 'Solicitud eliminada' });
      setDeletingRequest(null);
      window.location.reload();
    } catch (e) {
      console.error("Error deleting request:", e);
      toast({
        variant: "destructive",
        title: 'Error',
        description: 'No se pudo eliminar la solicitud.',
      });
      setDeletingRequest(null);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Solicitudes de Cooperación
        </h1>
        {user && (
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        )}
      </div>

       <RequestForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        request={editingRequest}
      />

      <Accordion type="single" collapsible className="w-full" value={openRequestId} onValueChange={setOpenRequestId}>
        {requests?.map(request => {
            const contributions = allContributions?.filter(c => c.requestId === request.id) || [];
            const totalCollected = contributions.reduce((sum, c) => sum + c.amount, 0);

            return (
          <AccordionItem value={request.id!} key={request.id} className="rounded-2xl border bg-card text-card-foreground shadow-sm mb-4 px-6 data-[state=open]:border-primary/50">
             <div className="relative">
              <AccordionTrigger className="py-6 hover:no-underline [&[data-state=open]>svg]:-right-1">
                <div className="flex w-full items-start justify-between pr-8">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold leading-none tracking-tight">{request.title}</h3>
                    </div>
                </div>
              </AccordionTrigger>
              {user && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-8">
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenForm(request)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingRequest(request)}>
                                  Eliminar
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
              )}
            </div>
            <AccordionContent className="pt-0 pb-6">
               <div className="border-t -mx-6 my-4"></div>
              <p className="text-2xl font-bold">{formatCurrency(request.amount)}</p>
              <p className="text-sm text-muted-foreground">por alumno</p>
              <div className="mt-4">
                <p className="text-sm">
                  <span className="font-semibold">{formatCurrency(totalCollected)}</span> recaudado de {contributions.length} de {allStudents?.length || 0} alumnos.
                </p>
              </div>
              <div className="mt-6">
                <Button asChild className="w-full">
                  <Link href={`/requests/${request.id}`}>Ver Estado</Link>
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        )})}
      </Accordion>
      
       <AlertDialog open={!!deletingRequest} onOpenChange={(isOpen) => !isOpen && setDeletingRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la solicitud de cooperación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequest} className="bg-destructive hover:bg-destructive/90">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
