'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { ContributionRequest } from '@/lib/types';
import { useUser, useFirestore, addDocument, updateDocument } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { logAction } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

interface RequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  request: ContributionRequest | null;
}

export function RequestForm({ isOpen, onClose, request }: RequestFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) return;

    const formData = new FormData(event.currentTarget);
    const title = formData.get('title') as string;
    const data: Omit<ContributionRequest, 'id'> = {
      title,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      createdAt: serverTimestamp()
    };

    try {
      if (request && request.id) {
        const requestDocRef = doc(firestore, 'contribution_requests', request.id);
        await updateDocument(requestDocRef, data);
        logAction(firestore, `actualizó la solicitud: "${title}"`, 'request', user.displayName || 'Admin');
        toast({ title: 'Solicitud actualizada' });
      } else {
        const requestsCollection = collection(firestore, 'contribution_requests');
        await addDocument(requestsCollection, data);
        logAction(firestore, `creó una nueva solicitud: "${title}"`, 'request', user.displayName || 'Admin');
        toast({ title: 'Solicitud creada' });
      }
      onClose();
      window.location.reload();
    } catch (e) {
      console.error("Error saving request:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la solicitud.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{request ? 'Editar Solicitud' : 'Nueva Solicitud de Cooperación'}</DialogTitle>
        </DialogHeader>
        <form id="request-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Título</Label>
            <Input id="title" name="title" className="col-span-3" defaultValue={request?.title || ''} required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Descripción</Label>
            <Textarea id="description" name="description" className="col-span-3" defaultValue={request?.description || ''} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">Monto</Label>
            <Input id="amount" name="amount" type="number" step="0.01" className="col-span-3" defaultValue={request?.amount || ''} required />
          </div>
        </form>
        <DialogFooter>
           <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="request-form">
            {request ? 'Guardar Cambios' : 'Crear Solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
