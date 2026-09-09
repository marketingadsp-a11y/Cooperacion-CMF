'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MinusCircle, X, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocument } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import type { Expense, AppSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils';
import { uploadImageToImgBB } from '@/lib/imgbb';

export function AddExpenseFAB() {
  const [isOpen, setOpen] = useState(false);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [ticketPreview, setTicketPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setTicketFile(null);
      setTicketPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'Por favor selecciona un archivo de imagen.',
      });
      return;
    }

    setTicketFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setTicketPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveTicket = () => {
    setTicketFile(null);
    setTicketPreview(null);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setTicketFile(null);
      setTicketPreview(null);
      setIsSubmitting(false);
    }
  };

  const handleAddExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) return;
    
    const form = event.currentTarget;
    const formData = new FormData(form);
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Monto inválido',
        description: 'Ingresa un monto mayor a cero.',
      });
      return;
    }

    setIsSubmitting(true);
    let receiptUrl: string | undefined = undefined;

    try {
      if (ticketFile) {
        const apiKey = appSettings?.imgbbApiKey || process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey) {
          toast({
            variant: 'destructive',
            title: 'ImgBB no configurado',
            description: 'Para subir tickets, primero ingresa tu API Key de ImgBB en la sección de Ajustes.',
          });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: 'Subiendo comprobante...',
          description: 'Alojando la imagen en ImgBB.',
        });

        receiptUrl = await uploadImageToImgBB(ticketFile, apiKey);
      }

      const newExpense: Omit<Expense, 'id' | 'date'> & { date: object } = {
        description,
        amount,
        date: serverTimestamp(),
        ...(receiptUrl ? { receiptUrl } : {}),
      };

      const expensesCollectionRef = collection(firestore, 'expenses');
      await addDocument(expensesCollectionRef, newExpense);
      logAction(firestore, `registró un gasto de ${formatCurrency(amount)}: "${description}"`, 'expense', user.displayName || 'Admin');
      
      toast({
        title: '¡Gasto añadido!',
        description: ticketFile ? 'El gasto y su ticket han sido registrados.' : 'El nuevo gasto ha sido registrado.',
      });

      handleOpenChange(false);
      form.reset();
    } catch (e: any) {
      console.error("Error adding expense via FAB:", e);
      toast({
        variant: "destructive",
        title: "Error al registrar el gasto",
        description: e?.message || "No se pudo registrar el gasto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="h-12 w-12 rounded-full shadow-md transition-all hover:scale-105 border border-white/25"
          variant="destructive"
          size="icon"
        >
          <MinusCircle className="h-5 w-5" />
          <span className="sr-only">Añadir Gasto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Gasto</DialogTitle>
        </DialogHeader>
        <form id="fab-expense-form" onSubmit={handleAddExpense} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fab-description" className="text-right">
              Descripción
            </Label>
            <Input id="fab-description" name="description" placeholder="Ej: Compra de material" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fab-amount" className="text-right">
              Monto
            </Label>
            <Input id="fab-amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" className="col-span-3" required />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="fab-ticket" className="text-right pt-2">
              Ticket
            </Label>
            <div className="col-span-3 space-y-2">
              {ticketPreview ? (
                <div className="relative inline-block rounded-lg border border-border p-1 bg-muted/30">
                  <img
                    src={ticketPreview}
                    alt="Previsualización del ticket"
                    className="h-28 w-auto max-w-full object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveTicket}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow hover:opacity-90"
                    title="Quitar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    id="fab-ticket"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                    className="cursor-pointer file:cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {appSettings?.imgbbApiKey
                      ? 'Opcional: Adjunta foto o captura del comprobante.'
                      : '⚠️ Clave de ImgBB no configurada en Ajustes.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="fab-expense-form" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Gasto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
