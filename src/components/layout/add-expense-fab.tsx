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
import { MinusCircle } from 'lucide-react';
import { useUser, useFirestore, addDocument } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { Expense } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils';

export function AddExpenseFAB() {
  const [isOpen, setOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleAddExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) return;
    
    const form = event.currentTarget;
    const formData = new FormData(form);
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);
    
    const newExpense: Omit<Expense, 'id' | 'date'> & { date: object } = {
      description,
      amount,
      date: serverTimestamp(),
    };

    try {
      const expensesCollectionRef = collection(firestore, 'expenses');
      await addDocument(expensesCollectionRef, newExpense);
      logAction(firestore, `registró un gasto de ${formatCurrency(amount)}: "${description}"`, 'expense', user.displayName || 'Admin');
      toast({
        title: '¡Gasto añadido!',
        description: 'El nuevo gasto ha sido registrado.',
      });
      setOpen(false);
      form.reset();
      window.location.reload();
    } catch (e) {
      console.error("Error adding expense via FAB:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo registrar el gasto.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-16 w-16 rounded-full shadow-lg"
          variant="destructive"
          size="icon"
        >
          <MinusCircle className="h-8 w-8" />
          <span className="sr-only">Añadir Gasto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Gasto</DialogTitle>
        </DialogHeader>
        <form id="fab-expense-form" onSubmit={handleAddExpense} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Descripción
            </Label>
            <Input id="description" name="description" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Monto
            </Label>
            <Input id="amount" name="amount" type="number" step="0.01" className="col-span-3" required />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="fab-expense-form">Guardar Gasto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
