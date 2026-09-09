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
import {
  PlusCircle,
  MoreHorizontal,
  Trash2,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Key,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
  Loader2,
  Handshake,
  Upload,
  ShieldAlert,
  UserCheck,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadImageToImgBB } from '@/lib/imgbb';
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
  useMemoFirebase,
  deleteDocument,
  setDocument,
} from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { UserForm } from './user-form';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logger';

const CONFIRMATION_CODE = '0120';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'AD';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  const handleOpenForm = (user: User | null = null) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setTimeout(() => {
      setEditingUser(null);
    }, 150);
  };

  const handleDeleteUser = async () => {
    if (!firestore || !deletingUser || !deletingUser.id) return;
    try {
      const userDocRef = doc(firestore, 'users', deletingUser.id);
      await deleteDocument(userDocRef);
      toast({ title: 'Usuario eliminado' });
      setDeletingUser(null);
      window.location.reload();
    } catch (e) {
      console.error('Error deleting user:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el usuario.' });
      setDeletingUser(null);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;

    const formData = new FormData(e.currentTarget);
    const apiKey = (formData.get('imgbbApiKey') as string)?.trim();

    try {
      const settingsRef = doc(firestore, 'settings', 'app_settings');
      await setDocument(settingsRef, { imgbbApiKey: apiKey || '' }, { merge: true });

      logAction(
        firestore,
        apiKey ? 'actualizó la API Key de ImgBB' : 'eliminó la API Key de ImgBB',
        'system',
        user.displayName || 'Admin'
      );

      toast({
        title: 'Configuración guardada',
        description: apiKey
          ? 'La API Key de ImgBB se ha configurado correctamente.'
          : 'Se ha removido la API Key de ImgBB.',
      });
    } catch (error) {
      console.error('Error al guardar API Key de ImgBB:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la configuración.',
      });
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'Por favor selecciona un archivo de imagen (PNG, JPG, SVG, WebP, etc.).',
      });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isSavingLogo) return;

    const formData = new FormData(e.currentTarget);
    const logoUrlInput = (formData.get('headerLogoUrl') as string)?.trim();

    setIsSavingLogo(true);
    try {
      let finalLogoUrl = logoUrlInput || '';

      if (logoFile) {
        if (!appSettings?.imgbbApiKey) {
          toast({
            variant: 'destructive',
            title: 'API Key de ImgBB requerida',
            description: 'Para subir la imagen del logo debes tener configurada la API Key de ImgBB.',
          });
          setIsSavingLogo(false);
          return;
        }

        toast({ title: 'Subiendo logotipo...', description: 'Enviando imagen a ImgBB.' });
        finalLogoUrl = await uploadImageToImgBB(logoFile, appSettings.imgbbApiKey);
      }

      const settingsRef = doc(firestore, 'settings', 'app_settings');
      await setDocument(settingsRef, { headerLogoUrl: finalLogoUrl }, { merge: true });

      logAction(
        firestore,
        finalLogoUrl ? 'actualizó el logotipo del encabezado' : 'restableció el logotipo por defecto',
        'system',
        user.displayName || 'Admin'
      );

      toast({
        title: 'Logotipo actualizado',
        description: finalLogoUrl
          ? 'El nuevo logotipo se mostrará en el encabezado.'
          : 'Se ha restablecido el logo por defecto.',
      });

      setLogoFile(null);
      setLogoPreview(null);
    } catch (err: any) {
      console.error('Error al guardar logotipo:', err);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar logotipo',
        description: err?.message || 'No se pudo guardar la imagen.',
      });
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    if (!firestore || !user) return;
    try {
      const settingsRef = doc(firestore, 'settings', 'app_settings');
      await setDocument(settingsRef, { headerLogoUrl: '' }, { merge: true });
      logAction(firestore, 'restableció el logotipo por defecto', 'system', user.displayName || 'Admin');
      setLogoFile(null);
      setLogoPreview(null);
      toast({
        title: 'Logotipo restablecido',
        description: 'Se ha restaurado el ícono y nombre original del encabezado.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo restablecer el logotipo.',
      });
    }
  };

  const handleResetAllStudents = async () => {
    if (confirmationCode !== CONFIRMATION_CODE || !firestore || !user) {
      toast({ variant: 'destructive', title: 'Código de confirmación incorrecto' });
      return;
    }
    try {
      const studentsSnapshot = await getDocs(collection(firestore, 'students'));
      const batch = writeBatch(firestore);
      studentsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logAction(firestore, 'eliminó todos los alumnos', 'system', user.displayName || 'Admin');
      toast({ title: 'Todos los alumnos han sido eliminados' });
      setDeleteAllStudentsDialogOpen(false);
      setConfirmationCode('');
      window.location.reload();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar alumnos' });
    }
  };

  const handleResetAllContributions = async () => {
    if (confirmationCode !== CONFIRMATION_CODE || !firestore || !user) {
      toast({ variant: 'destructive', title: 'Código de confirmación incorrecto' });
      return;
    }
    try {
      const contributionsSnapshot = await getDocs(collection(firestore, 'contributions'));
      const requestsSnapshot = await getDocs(collection(firestore, 'contribution_requests'));
      const batch = writeBatch(firestore);
      contributionsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      requestsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logAction(firestore, 'eliminó todas las solicitudes y cooperaciones', 'system', user.displayName || 'Admin');
      toast({ title: 'Todas las cooperaciones han sido eliminadas' });
      setDeleteAllContributionsDialogOpen(false);
      setConfirmationCode('');
      window.location.reload();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar cooperaciones' });
    }
  };

  const handleResetAllExpenses = async () => {
    if (confirmationCode !== CONFIRMATION_CODE || !firestore || !user) {
      toast({ variant: 'destructive', title: 'Código de confirmación incorrecto' });
      return;
    }
    try {
      const expensesSnapshot = await getDocs(collection(firestore, 'expenses'));
      const batch = writeBatch(firestore);
      expensesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logAction(firestore, 'eliminó todos los gastos', 'system', user.displayName || 'Admin');
      toast({ title: 'Todos los gastos han sido eliminados' });
      setDeleteAllExpensesDialogOpen(false);
      setConfirmationCode('');
      window.location.reload();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar gastos' });
    }
  };

  const handleResetAllData = async () => {
    if (confirmationCode !== CONFIRMATION_CODE || !firestore || !user) {
      toast({ variant: 'destructive', title: 'Código de confirmación incorrecto' });
      return;
    }
    try {
      const collectionsToClear = ['students', 'contributions', 'contribution_requests', 'expenses', 'logs'];
      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(firestore, colName));
        const batch = writeBatch(firestore);
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      logAction(firestore, 'reinició todo el sistema por completo', 'system', user.displayName || 'Admin');
      toast({ title: 'Sistema reiniciado por completo' });
      setDeleteAllDataDialogOpen(false);
      setConfirmationCode('');
      window.location.reload();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al reiniciar el sistema' });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-3.5 sm:p-6 md:p-8 max-w-5xl mx-auto">
      {/* Encabezado Liquid Glass */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-inner backdrop-blur-md">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ajustes del Sistema
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Personalización, llaves de API, usuarios y mantenimiento
          </p>
        </div>
      </div>

      {/* 1. SECCIÓN: LOGOTIPO DEL ENCABEZADO */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Logotipo del Encabezado</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Sube tu propio logo o especifica una URL directa para mostrarlo en el encabezado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            <div className="w-16 h-16 rounded-2xl border border-white/40 dark:border-white/10 bg-white dark:bg-black flex items-center justify-center p-2 shadow-sm overflow-hidden shrink-0">
              {logoPreview || appSettings?.headerLogoUrl ? (
                <img
                  src={logoPreview || appSettings?.headerLogoUrl}
                  alt="Vista previa del logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <Handshake className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Vista Previa Actual</p>
              <p className="text-xs text-muted-foreground break-all">
                {appSettings?.headerLogoUrl
                  ? `URL configurada: ${appSettings.headerLogoUrl}`
                  : 'Usando isotipo por defecto (Cooperación CMF).'}
              </p>
              {appSettings?.headerLogoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetLogo}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive px-2 mt-1"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restablecer al icono original
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveLogo} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="logoFile" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subir archivo de imagen (ImgBB)
                </Label>
                <Input
                  id="logoFile"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  disabled={isSavingLogo}
                  className="rounded-xl h-12 bg-white/60 dark:bg-black/40 cursor-pointer file:cursor-pointer text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="headerLogoUrl" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  O pegar URL directa de imagen
                </Label>
                <Input
                  id="headerLogoUrl"
                  name="headerLogoUrl"
                  type="url"
                  placeholder="https://ejemplo.com/mi-logo.png"
                  defaultValue={appSettings?.headerLogoUrl || ''}
                  disabled={isSavingLogo}
                  className="rounded-xl h-12 bg-white/60 dark:bg-black/40 text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSavingLogo}
              className="w-full sm:w-auto h-11 rounded-xl shadow-md font-medium px-6 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white"
            >
              {isSavingLogo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando logotipo...
                </>
              ) : (
                'Guardar Logotipo'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. SECCIÓN: API KEY DE IMGBB */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">API Key de ImgBB</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Permite subir tickets de gastos y el logotipo del encabezado a la nube gratuita de ImgBB.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <form onSubmit={handleSaveApiKey} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="imgbbApiKey" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Llave de API (v3)
              </Label>
              <div className="relative">
                <Input
                  id="imgbbApiKey"
                  name="imgbbApiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Pega tu API Key de ImgBB aquí..."
                  defaultValue={appSettings?.imgbbApiKey || ''}
                  className="rounded-xl h-12 bg-white/60 dark:bg-black/40 pr-12 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-lg"
                  title={showApiKey ? 'Ocultar API Key' : 'Mostrar API Key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Obtén tu API Key gratuita en api.imgbb.com
              </a>

              <Button
                type="submit"
                className="w-full sm:w-auto h-11 rounded-xl shadow-md font-medium px-6"
              >
                Guardar API Key
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. SECCIÓN: ADMINISTRADORES */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Usuarios Administradores</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Control de acceso con código numérico al sistema.
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={() => handleOpenForm()}
            size="sm"
            className="w-full sm:w-auto h-10 rounded-xl shadow-md bg-gradient-to-r from-primary to-accent text-white"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" />
            Añadir Usuario
          </Button>
        </CardHeader>

        <CardContent className="p-2 sm:p-6">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs">Cargando administradores...</p>
            </div>
          ) : (
            <>
              {/* VISTA MÓVIL (Celulares): Tarjetas interactivas */}
              <div className="block sm:hidden space-y-2.5 p-1">
                {users?.map((u) => {
                  const initials = getInitials(u.name);

                  return (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground text-base tracking-tight truncate">
                              {u.name}
                            </p>
                            <span className="text-xs text-muted-foreground">Código: ••••</span>
                          </div>
                        </div>

                        <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">
                          Admin
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 rounded-xl text-xs font-medium bg-muted/40"
                          onClick={() => handleOpenForm(u)}
                        >
                          <Edit3 className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingUser(u)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VISTA ESCRITORIO: Tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-white/20 dark:border-white/10">
                      <TableHead className="font-semibold text-foreground">Nombre</TableHead>
                      <TableHead className="font-semibold text-foreground">Código</TableHead>
                      <TableHead className="font-semibold text-foreground">Rol</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((u) => (
                      <TableRow
                        key={u.id}
                        className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/15 dark:border-white/5"
                      >
                        <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">••••</TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">
                            Admin
                          </Badge>
                        </TableCell>
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
                              <DropdownMenuItem
                                onClick={() => handleOpenForm(u)}
                                className="rounded-xl cursor-pointer"
                              >
                                <Edit3 className="mr-2 h-4 w-4 text-primary" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive rounded-xl cursor-pointer"
                                onClick={() => setDeletingUser(u)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. SECCIÓN: ZONA DE PELIGRO */}
      <Card className="border border-destructive/25 bg-destructive/[0.02] dark:bg-destructive/[0.04] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-destructive/15 bg-destructive/5 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-destructive">Zona de Peligro</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-destructive/80">
                Acciones irreversibles. Se requerirá el código de confirmación del sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5">
            <div>
              <p className="font-semibold text-sm text-foreground">Eliminar Todos los Alumnos</p>
              <p className="text-xs text-muted-foreground">Borra la lista completa de alumnos del directorio.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-10 rounded-xl"
              onClick={() => setDeleteAllStudentsDialogOpen(true)}
            >
              Eliminar Alumnos
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5">
            <div>
              <p className="font-semibold text-sm text-foreground">Eliminar Todas las Cooperaciones</p>
              <p className="text-xs text-muted-foreground">Borra todas las solicitudes y los pagos registrados.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-10 rounded-xl"
              onClick={() => setDeleteAllContributionsDialogOpen(true)}
            >
              Eliminar Cooperaciones
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5">
            <div>
              <p className="font-semibold text-sm text-foreground">Eliminar Todos los Gastos</p>
              <p className="text-xs text-muted-foreground">Borra el registro completo de gastos efectuados.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-10 rounded-xl"
              onClick={() => setDeleteAllExpensesDialogOpen(true)}
            >
              Eliminar Gastos
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20">
            <div>
              <p className="font-bold text-sm text-destructive">Reiniciar Todo el Sistema</p>
              <p className="text-xs text-destructive/80">Borra alumnos, solicitudes, pagos, gastos y bitácoras por completo.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 shadow-md font-bold"
              onClick={() => setDeleteAllDataDialogOpen(true)}
            >
              Reiniciar Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Formulario de Usuario */}
      <UserForm isOpen={isFormOpen} onClose={handleCloseForm} user={editingUser} />

      {/* Alerta de confirmación de eliminar usuario */}
      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(isOpen) => !isOpen && setDeletingUser(null)}
      >
        <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              ¿Eliminar a {deletingUser?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Esta acción revocará de inmediato el acceso de este administrador al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogos de Confirmación de la Zona de Peligro (con teclado numérico para 0120) */}
      {[
        {
          isOpen: isDeleteAllStudentsDialogOpen,
          setOpen: setDeleteAllStudentsDialogOpen,
          title: '¿Eliminar todos los alumnos?',
          action: handleResetAllStudents,
        },
        {
          isOpen: isDeleteAllContributionsDialogOpen,
          setOpen: setDeleteAllContributionsDialogOpen,
          title: '¿Eliminar todas las cooperaciones?',
          action: handleResetAllContributions,
        },
        {
          isOpen: isDeleteAllExpensesDialogOpen,
          setOpen: setDeleteAllExpensesDialogOpen,
          title: '¿Eliminar todos los gastos?',
          action: handleResetAllExpenses,
        },
        {
          isOpen: isDeleteAllDataDialogOpen,
          setOpen: setDeleteAllDataDialogOpen,
          title: '¿REINICIAR TODO EL SISTEMA?',
          action: handleResetAllData,
        },
      ].map((dialog, idx) => (
        <AlertDialog
          key={idx}
          open={dialog.isOpen}
          onOpenChange={(open) => {
            dialog.setOpen(open);
            if (!open) setConfirmationCode('');
          }}
        >
          <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-destructive/30 shadow-2xl p-5 sm:p-6">
            <AlertDialogHeader className="space-y-2 text-left">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-destructive">
                {dialog.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Esta acción no se puede deshacer. Para confirmar, introduce el código de administrador (
                <strong className="font-mono text-foreground">{CONFIRMATION_CODE}</strong>).
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-3">
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Código de confirmación"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-xl tracking-[0.3em] font-mono rounded-xl bg-white/60 dark:bg-black/40"
                maxLength={6}
                autoFocus
              />
            </div>

            <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
              <AlertDialogCancel className="h-10 rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={dialog.action}
                disabled={confirmationCode !== CONFIRMATION_CODE}
                className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium"
              >
                Confirmar y Ejecutar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
}
