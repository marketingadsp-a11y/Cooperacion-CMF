'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Expense, AppSettings } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { PlusCircle, MoreHorizontal, Receipt, Eye, Trash2, X, ExternalLink, Loader2, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useFirestore, useCollection, useDoc, addDocument, deleteDocument, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore';
import { logAction } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { uploadImageToImgBB } from '@/lib/imgbb';

export default function ExpensesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const expensesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'expenses'), orderBy('date', 'desc')) : null),
    [firestore]
  );
  const { data: expenses, isLoading } = useCollection<Expense>(expensesQuery);

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [ticketPreview, setTicketPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  
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
        description: 'Por favor selecciona un archivo de imagen (JPG, PNG, WebP, etc.).',
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

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
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
        title: "Gasto añadido",
        description: ticketFile ? "El gasto y su ticket han sido registrados con éxito." : "El nuevo gasto ha sido registrado.",
      });

      handleCloseDialog(false);
      form.reset();
    } catch (e: any) {
      console.error("Error adding expense:", e);
      toast({
        variant: "destructive",
        title: "Error al registrar el gasto",
        description: e?.message || "No se pudo guardar el gasto. Inténtalo de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!firestore || !deletingExpense?.id) return;
    try {
      const expenseDocRef = doc(firestore, 'expenses', deletingExpense.id);
      await deleteDocument(expenseDocRef);
      if (user) {
        logAction(
          firestore,
          `eliminó el gasto de ${formatCurrency(deletingExpense.amount)}: "${deletingExpense.description}"`,
          'expense',
          user.displayName || 'Admin'
        );
      }
      toast({ title: "Gasto eliminado", description: "El registro ha sido eliminado correctamente." });
      setDeletingExpense(null);
    } catch (e) {
      console.error("Error deleting expense:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el gasto." });
      setDeletingExpense(null);
    }
  };
  
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Gastos
        </h1>
        {user && (
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Añadir Nuevo Gasto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddExpense} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Descripción</Label>
                <Input id="description" name="description" placeholder="Ej: Compra de material didáctico" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Monto</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" className="col-span-3" required />
              </div>

              {/* Selector de ticket / comprobante */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="ticket" className="text-right pt-2">Ticket</Label>
                <div className="col-span-3 space-y-2">
                  {ticketPreview ? (
                    <div className="relative inline-block rounded-lg border border-border p-1 bg-muted/30">
                      <img
                        src={ticketPreview}
                        alt="Previsualización del ticket"
                        className="h-32 w-auto max-w-full object-cover rounded-md"
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
                        id="ticket"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                        className="cursor-pointer file:cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {appSettings?.imgbbApiKey ? (
                          'Opcional: Adjunta foto o captura del ticket/recibo.'
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            ⚠️ Para adjuntar tickets, configura tu API Key de ImgBB en Ajustes.
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => handleCloseDialog(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Comprobante</TableHead>
                {user && <TableHead><span className="sr-only">Acciones</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={user ? 5 : 4} className="text-center py-6">Cargando gastos...</TableCell></TableRow>}
              {!isLoading && expenses?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={user ? 5 : 4} className="text-center py-6 text-muted-foreground">
                    No hay gastos registrados aún.
                  </TableCell>
                </TableRow>
              )}
              {expenses?.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>{toDate(expense.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(expense.amount)}</TableCell>
                  <TableCell className="text-center">
                    {expense.receiptUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs border-primary/30 hover:bg-primary/10 text-primary font-medium"
                        onClick={() => setViewingReceipt(expense)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Ver Ticket</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin ticket</span>
                    )}
                  </TableCell>
                  {user && (
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {expense.receiptUrl && (
                          <DropdownMenuItem onClick={() => setViewingReceipt(expense)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver comprobante
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingExpense(expense)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Confirmación para eliminar gasto */}
      <AlertDialog open={!!deletingExpense} onOpenChange={(open) => !open && setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el gasto "{deletingExpense?.description}" por{' '}
              {deletingExpense ? formatCurrency(deletingExpense.amount) : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              Sí, eliminar gasto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
