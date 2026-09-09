'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  PlusCircle,
  MoreHorizontal,
  Receipt,
  Eye,
  Trash2,
  X,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ShoppingCart,
  Calendar,
  DollarSign,
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
  useDoc,
  addDocument,
  deleteDocument,
  useMemoFirebase,
} from '@/firebase';
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
    const fileInput = document.getElementById('ticket') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
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
    if (!firestore || !user || isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const description = (formData.get('description') as string)?.trim();
    const amountStr = formData.get('amount') as string;
    const amount = parseFloat(amountStr);

    if (!description) {
      toast({ variant: 'destructive', title: 'Descripción requerida', description: 'Ingresa una descripción para el gasto.' });
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Monto inválido', description: 'Ingresa un monto mayor a cero.' });
      return;
    }

    setIsSubmitting(true);

    try {
      let receiptUrl: string | undefined = undefined;

      if (ticketFile) {
        if (!appSettings?.imgbbApiKey) {
          toast({
            variant: 'destructive',
            title: 'API Key requerida',
            description: 'Para subir comprobantes a ImgBB debes configurar tu API Key en Ajustes.',
          });
          setIsSubmitting(false);
          return;
        }

        toast({ title: 'Subiendo comprobante...', description: 'Enviando imagen a ImgBB.' });
        receiptUrl = await uploadImageToImgBB(ticketFile, appSettings.imgbbApiKey);
      }

      const expensesCollection = collection(firestore, 'expenses');
      const newExpense: Omit<Expense, 'id'> = {
        description,
        amount,
        date: serverTimestamp(),
        ...(receiptUrl ? { receiptUrl } : {}),
      };

      await addDocument(expensesCollection, newExpense);
      logAction(
        firestore,
        `registró un nuevo gasto: "${description}" por ${formatCurrency(amount)}${receiptUrl ? ' con comprobante adjunto' : ''}`,
        'expense',
        user.displayName || 'Admin'
      );

      toast({ title: '¡Gasto registrado!', description: 'El gasto se ha guardado correctamente.' });
      handleCloseDialog(false);
    } catch (e: any) {
      console.error('Error adding expense:', e);
      toast({ variant: 'destructive', title: 'Error al registrar el gasto', description: e?.message || 'No se pudo registrar el gasto.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!firestore || !deletingExpense || !deletingExpense.id || !user) return;

    try {
      const expenseDocRef = doc(firestore, 'expenses', deletingExpense.id);
      await deleteDocument(expenseDocRef);
      logAction(
        firestore,
        `eliminó el gasto: "${deletingExpense.description}" por ${formatCurrency(deletingExpense.amount)}`,
        'expense',
        user.displayName || 'Admin'
      );
      toast({ title: 'Gasto eliminado', description: 'El gasto ha sido eliminado correctamente.' });
      setDeletingExpense(null);
    } catch (e) {
      console.error('Error deleting expense:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el gasto.' });
      setDeletingExpense(null);
    }
  };

  const totalSpent = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
  const countWithTickets = expenses?.filter((e) => !!e.receiptUrl).length || 0;

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Liquid Glass */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-inner backdrop-blur-md">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Gastos
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 backdrop-blur-md">
                {expenses?.length || 0}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Total erogado: <strong className="text-foreground">{formatCurrency(totalSpent)}</strong>
            </p>
          </div>
        </div>

        {user && (
          <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="w-full sm:w-auto h-11 sm:h-10 rounded-xl shadow-md bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-95 text-white border border-white/20 font-medium transition-all active:scale-[0.98]"
              >
                <PlusCircle className="mr-1.5 h-4 w-4" />
                Añadir Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
              <DialogHeader className="text-left space-y-1">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 mb-1">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-bold">Añadir Nuevo Gasto</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleAddExpense} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Descripción del Gasto
                  </Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Ej: Pintura para aula, papelería..."
                    className="h-12 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary text-base"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Monto ($ MXN)
                  </Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="h-12 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary text-base font-mono"
                    required
                  />
                </div>

                {/* Subida de ticket */}
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="ticket" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Comprobante / Ticket (ImgBB)
                  </Label>
                  {ticketPreview ? (
                    <div className="relative inline-block rounded-2xl border border-border p-2 bg-black/5 dark:bg-white/5">
                      <img
                        src={ticketPreview}
                        alt="Previsualización del ticket"
                        className="h-32 w-auto max-w-full object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveTicket}
                        className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-1.5 shadow-md hover:opacity-90 transition-all"
                        title="Quitar comprobante"
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
                        className="cursor-pointer file:cursor-pointer rounded-xl h-11 bg-white/60 dark:bg-black/40"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {appSettings?.imgbbApiKey ? (
                          'Opcional: Adjunta foto o comprobante del gasto.'
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            ⚠️ Para subir fotos de tickets, ingresa tu API Key de ImgBB en Ajustes.
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2 gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCloseDialog(false)}
                    disabled={isSubmitting}
                    className="h-11 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 rounded-xl shadow-md font-medium"
                  >
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

      {/* Contenedor Liquid Glass con el listado */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardContent className="p-2 sm:p-4">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Cargando registro de gastos...</p>
            </div>
          ) : expenses && expenses.length > 0 ? (
            <>
              {/* VISTA MÓVIL (Celulares): Tarjetas interactivas Apple Liquid Glass */}
              <div className="block sm:hidden space-y-2.5">
                {expenses.map((expense) => {
                  const dateStr = toDate(expense.date).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={expense.id}
                      className="p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center shrink-0">
                            <ShoppingCart className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground text-base tracking-tight leading-snug">
                              {expense.description}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              <span>{dateStr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
                            -{formatCurrency(expense.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción en celular */}
                      <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        {expense.receiptUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 rounded-xl text-xs font-medium gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setViewingReceipt(expense)}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>Ver Ticket</span>
                          </Button>
                        ) : (
                          <span className="flex-1 text-xs text-muted-foreground italic px-2">
                            Sin comprobante
                          </span>
                        )}

                        {user && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingExpense(expense)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VISTA ESCRITORIO: Tabla Apple Liquid Glass */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-white/20 dark:border-white/10">
                      <TableHead className="font-semibold text-foreground">Descripción</TableHead>
                      <TableHead className="font-semibold text-foreground">Fecha</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Monto</TableHead>
                      <TableHead className="text-center font-semibold text-foreground">Comprobante</TableHead>
                      {user && <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow
                        key={expense.id}
                        className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/15 dark:border-white/5"
                      >
                        <TableCell className="font-medium text-foreground">
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {toDate(expense.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600 dark:text-red-400 font-mono">
                          -{formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {expense.receiptUrl ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs rounded-xl border-primary/30 hover:bg-primary/10 text-primary font-medium"
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
                                <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl"
                              >
                                {expense.receiptUrl && (
                                  <DropdownMenuItem
                                    onClick={() => setViewingReceipt(expense)}
                                    className="rounded-xl cursor-pointer"
                                  >
                                    <Eye className="mr-2 h-4 w-4 text-primary" />
                                    Ver comprobante
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive rounded-xl cursor-pointer"
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
              </div>
            </>
          ) : (
            <div className="py-16 px-4 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shadow-inner">
                <ShoppingCart className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg text-foreground">No hay gastos registrados</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                  Aún no se ha registrado ninguna salida de dinero.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox para ver el ticket en grande */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Receipt className="h-5 w-5 text-primary" />
              Comprobante de Gasto
            </DialogTitle>
            {viewingReceipt && (
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-b border-black/5 dark:border-white/5 pb-2">
                <span className="font-semibold text-foreground">{viewingReceipt.description}</span>
                <span>
                  <strong className="text-red-500 font-mono">-{formatCurrency(viewingReceipt.amount)}</strong> •{' '}
                  {toDate(viewingReceipt.date).toLocaleDateString()}
                </span>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto my-3 flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-2xl p-2 min-h-[260px] border border-black/5 dark:border-white/5">
            {viewingReceipt?.receiptUrl ? (
              <img
                src={viewingReceipt.receiptUrl}
                alt={`Ticket de ${viewingReceipt.description}`}
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md"
              />
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {viewingReceipt?.receiptUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl"
                onClick={() => window.open(viewingReceipt.receiptUrl, '_blank')}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Abrir imagen completa
              </Button>
            )}
            <Button
              size="sm"
              className="h-10 rounded-xl"
              onClick={() => setViewingReceipt(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de confirmación de eliminación */}
      <AlertDialog
        open={!!deletingExpense}
        onOpenChange={(isOpen) => !isOpen && setDeletingExpense(null)}
      >
        <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              ¿Eliminar este gasto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Esta acción no se puede deshacer. Se eliminará el gasto de "{deletingExpense?.description}" por {deletingExpense ? formatCurrency(deletingExpense.amount) : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 rounded-xl border-white/40 dark:border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
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
