'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User, AppSettings } from '@/lib/types';
import { PlusCircle, MoreHorizontal, Trash2, Settings as SettingsIcon, Eye, EyeOff, Key, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, deleteDocument, setDocument } from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { UserForm } from './user-form';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logger';

const CONFIRMATION_CODE = '0120';

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<User>(usersCollection);

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  
  const [isDeleteAllStudentsDialogOpen, setDeleteAllStudentsDialogOpen] = useState(false);
  const [isDeleteAllContributionsDialogOpen, setDeleteAllContributionsDialogOpen] = useState(false);
  const [isDeleteAllExpensesDialogOpen, setDeleteAllExpensesDialogOpen] = useState(false);
  const [isDeleteAllDataDialogOpen, setDeleteAllDataDialogOpen] = useState(false);
  
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleOpenForm = (user: User | null = null) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    // Delay resetting to allow dialog to animate out
    setTimeout(() => {
      setEditingUser(null);
    }, 150);
  };

  const handleDeleteUser = async () => {
    if (!firestore || !deletingUser || !deletingUser.id) return;
    try {
      const userDocRef = doc(firestore, 'users', deletingUser.id);
      await deleteDocument(userDocRef);
      toast({ title: "Usuario eliminado" });
      setDeletingUser(null);
      window.location.reload();
    } catch (e) {
      console.error("Error deleting user:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el usuario." });
      setDeletingUser(null);
    }
  };

  const handleMassiveDelete = async (collectionsToDelete: string[]) => {
     if (confirmationCode !== CONFIRMATION_CODE) {
      toast({
        variant: 'destructive',
        title: 'Código incorrecto',
        description: 'El código de confirmación no es válido.',
      });
      return;
    }
    if (!firestore || !user) return;

    let success = false;
    try {
        const batch = writeBatch(firestore);
        let totalDeleted = 0;
        for (const collectionName of collectionsToDelete) {
            const collectionRef = collection(firestore, collectionName);
            const snapshot = await getDocs(collectionRef);
            if (!snapshot.empty) {
                snapshot.forEach(doc => batch.delete(doc.ref));
                totalDeleted += snapshot.size;
            }
        }

        if (totalDeleted === 0) {
            toast({ title: 'No hay datos que eliminar.' });
        } else {
            await batch.commit();
            const collectionsText = collectionsToDelete.join(', ').replace(/_/g, ' ');
            logAction(firestore, `eliminó todos los datos de: ${collectionsText}`, 'system', user.displayName || 'Admin');
            toast({
                title: '¡Éxito!',
                description: `Se han eliminado ${totalDeleted} registros.`,
            });
            success = true;
        }
    } catch(error) {
        console.error('Error durante la eliminación masiva:', error);
        toast({
            variant: 'destructive',
            title: 'Error en la eliminación',
            description: 'No se pudieron eliminar los registros. Revisa la consola.',
        });
    } finally {
        setDeleteAllStudentsDialogOpen(false);
        setDeleteAllContributionsDialogOpen(false);
        setDeleteAllExpensesDialogOpen(false);
        setDeleteAllDataDialogOpen(false);
        setConfirmationCode('');
        if (success) {
            window.location.reload();
        }
    }
  }

  const handleSaveImgBBSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settingsDocRef) return;
    const formData = new FormData(event.currentTarget);
    const imgbbApiKey = (formData.get('imgbbApiKey') as string)?.trim() || '';
    
    try {
      await setDocument(settingsDocRef, { imgbbApiKey }, { merge: true });
      toast({ title: 'Clave de ImgBB guardada', description: 'La integración con ImgBB ha sido configurada.' });
    } catch (e) {
      console.error("Error saving ImgBB settings:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la clave de API." });
    }
  };

  const handleSavePWASettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settingsDocRef) return;
    const formData = new FormData(event.currentTarget);
    const pwaLogoUrl = formData.get('pwaLogoUrl') as string;
    
    try {
      await setDocument(settingsDocRef, { pwaLogoUrl }, { merge: true });
      toast({ title: 'Ajustes guardados', description: 'El logo de la PWA ha sido actualizado.' });
    } catch (e) {
      console.error("Error saving PWA settings:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los ajustes." });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Ajustes
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
             {user && (
              <div className="mb-4 flex justify-end">
                <Button onClick={() => handleOpenForm()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Usuario
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código de Acceso</TableHead>
                  {user && <TableHead><span className="sr-only">Acciones</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={user ? 3 : 2}>Cargando...</TableCell></TableRow>}
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.accessCode}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleOpenForm(u)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingUser(u)}>
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

        {user && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" /> API de ImgBB (Tickets y Fotos)
                  </CardTitle>
                  {appSettings?.imgbbApiKey ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      Configurada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      Sin configurar
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Permite subir fotos de tickets y comprobantes al registrar un gasto en la aplicación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveImgBBSettings} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="imgbbApiKey">API Key de ImgBB</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="imgbbApiKey"
                          name="imgbbApiKey"
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Ingresa tu clave de API de ImgBB"
                          defaultValue={appSettings?.imgbbApiKey || ''}
                          className="pr-10 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button type="submit">Guardar Clave</Button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>¿No tienes una clave? Puedes obtenerla gratis en ImgBB.</span>
                      <a
                        href="https://api.imgbb.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:underline font-medium"
                      >
                        Obtener API Key <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5"/> Logo de la PWA
                </CardTitle>
                <CardDescription>Personaliza el ícono de la aplicación instalable.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePWASettings} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pwaLogoUrl">URL del Logo para PWA</Label>
                    <Input 
                      id="pwaLogoUrl" 
                      name="pwaLogoUrl" 
                      type="url"
                      placeholder="https://example.com/logo.png"
                      defaultValue={appSettings?.pwaLogoUrl || ''} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Usa una URL pública de una imagen (preferiblemente 512x512px en formato PNG).
                    </p>
                  </div>
                  <Button type="submit">Guardar Logo</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

       <UserForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        user={editingUser}
      />
      
      {user && (
        <Card className="border-destructive/50 mt-6">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
            <CardDescription>
              Estas acciones son irreversibles. Por favor, ten mucho cuidado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
             <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <h3 className="font-semibold">Eliminar todos los alumnos</h3>
                <p className="text-sm text-muted-foreground">
                  Esta acción eliminará permanentemente a todos los alumnos.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteAllStudentsDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Alumnos
              </Button>
            </div>
             <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <h3 className="font-semibold">Eliminar todas las cooperaciones</h3>
                <p className="text-sm text-muted-foreground">
                  Elimina todos los registros de cooperaciones y solicitudes.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteAllContributionsDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Cooperaciones
              </Button>
            </div>
             <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <h3 className="font-semibold">Eliminar todos los gastos</h3>
                <p className="text-sm text-muted-foreground">
                  Esta acción eliminará permanentemente todos los gastos registrados.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteAllExpensesDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Gastos
              </Button>
            </div>
             <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <h3 className="font-semibold">Eliminar todos los datos</h3>
                <p className="text-sm text-muted-foreground">
                  Elimina alumnos, cooperaciones, solicitudes y gastos.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteAllDataDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Todo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingUser} onOpenChange={(isOpen) => !isOpen && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de que quieres eliminar a este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario
              y sus datos de acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Sí, eliminar usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllStudentsDialogOpen} onOpenChange={setDeleteAllStudentsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Eliminar todos los alumnos</AlertDialogTitle>
                <AlertDialogDescription>
                Esta acción es irreversible. Para confirmar, escribe el código de seguridad.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input type="password" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} placeholder="Código de confirmación" />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmationCode('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMassiveDelete(['students'])} disabled={confirmationCode !== CONFIRMATION_CODE} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar alumnos
                </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllContributionsDialogOpen} onOpenChange={setDeleteAllContributionsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Eliminar todas las cooperaciones</AlertDialogTitle>
                <AlertDialogDescription>
                Esto eliminará todas las solicitudes y registros de pago. Para confirmar, escribe el código de seguridad.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input type="password" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} placeholder="Código de confirmación" />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmationCode('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMassiveDelete(['contributions', 'contribution_requests'])} disabled={confirmationCode !== CONFIRMATION_CODE} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar cooperaciones
                </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllExpensesDialogOpen} onOpenChange={setDeleteAllExpensesDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Eliminar todos los gastos</AlertDialogTitle>
                <AlertDialogDescription>
                Esta acción es irreversible. Para confirmar, escribe el código de seguridad.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input type="password" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} placeholder="Código de confirmación" />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmationCode('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMassiveDelete(['expenses'])} disabled={confirmationCode !== CONFIRMATION_CODE} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar gastos
                </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllDataDialogOpen} onOpenChange={setDeleteAllDataDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                Se eliminarán alumnos, cooperaciones, solicitudes y gastos. Para confirmar, escribe el código de seguridad.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input type="password" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} placeholder="Código de confirmación" />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmationCode('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMassiveDelete(['students', 'contributions', 'contribution_requests', 'expenses'])} disabled={confirmationCode !== CONFIRMATION_CODE} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar todo
                </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
