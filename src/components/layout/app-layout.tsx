'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SidebarNav } from './sidebar-nav';
import { Logo } from '../logo';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelLeft, LogIn, LogOut, Handshake, LayoutDashboard, Loader2, Eye, EyeOff, RotateCw, ShieldCheck, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { collection, doc, query, where, limit, getDocs, addDoc } from 'firebase/firestore';
import type { User as AppUser, AppSettings } from '@/lib/types';
import { AddExpenseFAB } from './add-expense-fab';
import { MobileGridMenu } from './mobile-grid-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/logger';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isCheckingUsers, setIsCheckingUsers] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pathname = usePathname();
  const isPublicPage = pathname === '/' || Boolean(pathname?.startsWith('/requests/') && pathname !== '/requests');
  const isProtectedPage = !isPublicPage;

  const handleRefreshApp = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);
  
  useEffect(() => {
    // Intentar recuperar el nombre del admin de localStorage para persistir entre sesiones móviles
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('adminName') : null;
    if (user && storedName) {
      setAdminName(storedName);
    }
  }, [user]);

  const handleOpenLoginChange = async (open: boolean) => {
    setLoginOpen(open);
    if (open) {
      setLoginError(null);
      setAccessCodeInput('');
      setNewAdminName('');
      setShowCode(false);

      if (firestore) {
        setIsCheckingUsers(true);
        try {
          const usersRef = collection(firestore, 'users');
          const checkSnapshot = await getDocs(query(usersRef, limit(1)));
          setIsInitialSetup(checkSnapshot.empty);
        } catch (err) {
          console.error('Error checking users:', err);
          setIsInitialSetup(false);
        } finally {
          setIsCheckingUsers(false);
        }
      }
    } else {
      setLoginError(null);
      setIsLoggingIn(false);
      setAccessCodeInput('');
      setNewAdminName('');
      setShowCode(false);
      setIsInitialSetup(false);
      setIsCheckingUsers(false);
    }
  };

  const handleCreateInitialAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !firestore || isLoggingIn) return;

    const cleanName = newAdminName.trim();
    const cleanCode = accessCodeInput.trim();

    if (!cleanName) {
      setLoginError('Por favor ingresa un nombre para el administrador.');
      return;
    }
    if (!cleanCode) {
      setLoginError('Por favor ingresa un código de acceso o PIN.');
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      // 1. Iniciar sesión anónima para habilitar permisos de escritura según firestore.rules (isSignedIn())
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 2. Guardar el primer usuario administrador en la colección users
      const usersRef = collection(firestore, 'users');
      await addDoc(usersRef, {
        name: cleanName,
        accessCode: cleanCode,
      });

      // 3. Registrar acción en la bitácora
      logAction(
        firestore,
        `creó el administrador principal inicial (${cleanName})`,
        'system',
        cleanName
      );

      // 4. Guardar sesión y estado
      setAdminName(cleanName);
      localStorage.setItem('adminName', cleanName);

      toast({
        title: `¡Bienvenido, ${cleanName}!`,
        description: 'Tu usuario administrador ha sido configurado y has iniciado sesión.',
      });

      setLoginOpen(false);
      setAccessCodeInput('');
      setNewAdminName('');
      setIsInitialSetup(false);
    } catch (error: any) {
      console.error('Error creating initial admin:', error);
      let errorMsg = error.message || 'Ocurrió un error al crear el administrador.';
      if (error.code === 'auth/configuration-not-found' || error.message?.includes('configuration-not-found')) {
        errorMsg = 'Falta activar Authentication en este Firebase: Ve a Firebase Console > Compilación > Authentication > botón "Comenzar" y en "Sign-in method" activa el proveedor "Anónimo".';
      } else if (error.code === 'auth/operation-not-allowed' || error.message?.includes('operation-not-allowed')) {
        errorMsg = 'El proveedor Anónimo no está habilitado: Ve a Firebase Console > Authentication > pestaña "Sign-in method" y activa "Anónimo".';
      }
      setLoginError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Activar Autenticación en Firebase',
        description: errorMsg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !firestore || isLoggingIn) return;

    const cleanCode = accessCodeInput.trim();
    if (!cleanCode) {
      setLoginError('Por favor ingresa un código.');
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      // 1. Consulta optimizada a Firestore con limit(1)
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('accessCode', '==', cleanCode), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Doble verificación: si no existe ningún usuario en absoluto, activar modo creación inicial
        const checkEmptySnap = await getDocs(query(usersRef, limit(1)));
        if (checkEmptySnap.empty) {
          setIsInitialSetup(true);
          setLoginError('No hay administradores registrados en esta base de datos. Por favor crea el primero.');
          setIsLoggingIn(false);
          return;
        }

        setLoginError('Código de acceso no válido.');
        setIsLoggingIn(false);
        return;
      }

      const foundUser = querySnapshot.docs[0].data() as AppUser;

      // 2. Solo autenticar si no existe ya una sesión activa (ahorra viajes de red lentos)
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      setAdminName(foundUser.name);
      localStorage.setItem('adminName', foundUser.name);

      toast({
        title: `¡Bienvenido, ${foundUser.name}!`,
        description: 'Has iniciado sesión como administrador.',
      });
      
      setLoginOpen(false);
      setAccessCodeInput('');
    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message || 'Ocurrió un error al iniciar sesión.';
      if (error.code === 'auth/configuration-not-found' || error.message?.includes('configuration-not-found')) {
        errorMsg = 'Falta activar Authentication en este Firebase: Ve a Firebase Console > Compilación > Authentication > botón "Comenzar" y en "Sign-in method" activa el proveedor "Anónimo".';
      } else if (error.code === 'auth/operation-not-allowed' || error.message?.includes('operation-not-allowed')) {
        errorMsg = 'El proveedor Anónimo no está habilitado: Ve a Firebase Console > Authentication > pestaña "Sign-in method" y activa "Anónimo".';
      }
      setLoginError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: errorMsg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setAdminName(null);
      localStorage.removeItem('adminName');
      toast({
        title: 'Has cerrado sesión',
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al cerrar sesión',
        description: error.message,
      });
    }
  };

  return (
    <SidebarProvider>
      {user && (
        <Sidebar
          className="border-r border-white/20 dark:border-white/10 bg-gradient-to-b from-primary via-primary/95 to-primary/90 text-sidebar-foreground shadow-[4px_0_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
          collapsible="icon"
        >
          <SidebarHeader className="border-b border-white/15 bg-white/5 backdrop-blur-md">
            <Logo />
          </SidebarHeader>
          <SidebarContent className="scrollbar-none">
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
      )}
      <SidebarInset>
        {/* Apple Liquid Glass Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/70 px-4 backdrop-blur-2xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:px-6 transition-all">
          {user && (
            <SidebarTrigger variant="ghost" size="icon" className="hover:bg-accent/40 rounded-xl">
              <PanelLeft className="h-5 w-5" />
            </SidebarTrigger>
          )}

          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/20 dark:border-white/10 shadow-xs backdrop-blur-md overflow-hidden">
              {appSettings?.headerLogoUrl ? (
                <img
                  src={appSettings.headerLogoUrl}
                  alt={`Logo ${process.env.NEXT_PUBLIC_APP_NAME || 'Cooperación'} ${process.env.NEXT_PUBLIC_COMPANY_NAME || 'CMF'}`}
                  className="h-full w-full object-contain p-0.5"
                />
              ) : (
                <Handshake className="h-4 w-4 text-primary" />
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Cooperación'}{' '}
              <span className="text-primary font-black">
                {process.env.NEXT_PUBLIC_COMPANY_NAME || 'CMF'}
              </span>
            </h1>
          </Link>

          <div className="flex-1" />

          {isUserLoading ? (
            <div className="text-sm font-medium text-muted-foreground">Cargando...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
                Admin: {adminName || 'Administrador'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-xl hover:bg-destructive/10 hover:text-destructive text-xs"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Salir
              </Button>
            </div>
          ) : (
            auth && (
              <Dialog open={isLoginOpen} onOpenChange={handleOpenLoginChange}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-xs bg-primary hover:bg-primary/90">
                    <LogIn className="mr-2 h-4 w-4" />
                    Acceder
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px] w-[92vw] rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-6">
                  {isCheckingUsers ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs font-medium tracking-wide">Comprobando base de datos...</p>
                    </div>
                  ) : isInitialSetup ? (
                    <>
                      <DialogHeader className="text-center sm:text-center pb-2">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 dark:bg-amber-500/25 flex items-center justify-center mb-2 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-inner">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Crear Primer Administrador</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground text-center pt-1">
                          Esta base de datos es nueva. Configura el nombre y la contraseña/PIN del administrador principal.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleCreateInitialAdmin} className="space-y-4 pt-1">
                        <div className="space-y-1.5 text-left">
                          <Label htmlFor="newAdminName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Nombre del Administrador
                          </Label>
                          <Input
                            id="newAdminName"
                            type="text"
                            placeholder="Ej. Cristobal o Dirección"
                            value={newAdminName}
                            onChange={(e) => {
                              setNewAdminName(e.target.value);
                              if (loginError) setLoginError(null);
                            }}
                            className="h-11 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 text-sm focus-visible:ring-primary"
                            autoFocus
                            disabled={isLoggingIn}
                            required
                          />
                        </div>

                        <div className="space-y-1.5 text-left">
                          <Label htmlFor="newAccessCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Código / Contraseña de Acceso (PIN)
                          </Label>
                          <div className="relative">
                            <Input
                              id="newAccessCode"
                              name="newAccessCode"
                              type={showCode ? 'text' : 'password'}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="••••"
                              value={accessCodeInput}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setAccessCodeInput(val);
                                if (loginError) setLoginError(null);
                              }}
                              className="text-center text-2xl tracking-[0.35em] font-mono h-12 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary pr-12 text-foreground"
                              disabled={isLoggingIn}
                              maxLength={8}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowCode(!showCode)}
                              tabIndex={-1}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 transition-colors rounded-lg hover:bg-muted/40"
                              title={showCode ? 'Ocultar código' : 'Mostrar código'}
                            >
                              {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Usa entre 4 y 8 dígitos. Este código se te pedirá para iniciar sesión.
                          </p>
                        </div>

                        {loginError && (
                          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-center text-xs text-destructive font-medium animate-in fade-in">
                            {loginError}
                          </div>
                        )}

                        <DialogFooter className="pt-2 sm:space-x-0">
                          <Button
                            type="submit"
                            className="w-full h-11 rounded-xl font-medium shadow-md transition-all active:scale-[0.98] bg-primary hover:bg-primary/90"
                            disabled={isLoggingIn || !newAdminName.trim() || !accessCodeInput.trim()}
                          >
                            {isLoggingIn ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Configurando administrador...
                              </>
                            ) : (
                              'Crear Administrador y Entrar'
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </>
                  ) : (
                    <>
                      <DialogHeader className="text-center sm:text-center pb-1">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-2 text-primary border border-primary/20 shadow-inner">
                          <LogIn className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Acceso de Administrador</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleLogin} className="space-y-4 pt-2">
                        <div className="relative">
                          <Input
                            id="accessCode"
                            name="accessCode"
                            type={showCode ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="one-time-code"
                            placeholder="••••"
                            value={accessCodeInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setAccessCodeInput(val);
                              if (loginError) setLoginError(null);
                            }}
                            className="text-center text-2xl tracking-[0.35em] font-mono h-14 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary pr-12 text-foreground"
                            autoFocus
                            disabled={isLoggingIn}
                            maxLength={8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCode(!showCode)}
                            tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 transition-colors rounded-lg hover:bg-muted/40"
                            title={showCode ? 'Ocultar código' : 'Mostrar código'}
                          >
                            {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>

                        {loginError && (
                          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-center text-xs text-destructive font-medium animate-in fade-in">
                            {loginError}
                          </div>
                        )}

                        <DialogFooter className="pt-2 sm:space-x-0">
                          <Button
                            type="submit"
                            className="w-full h-11 rounded-xl font-medium shadow-md transition-all active:scale-[0.98]"
                            disabled={isLoggingIn || !accessCodeInput.trim()}
                          >
                            {isLoggingIn ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verificando acceso...
                              </>
                            ) : (
                              'Entrar'
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            )
          )}
        </header>

        <main className="flex-1 relative">
          {isUserLoading ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground tracking-wide">
                Verificando sesión...
              </p>
            </div>
          ) : !user && isProtectedPage ? (
            <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
              <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.12)] text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/20 dark:border-white/10 flex items-center justify-center text-primary shadow-inner">
                  <Lock className="h-8 w-8 text-primary" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Acceso Restringido
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Esta sección contiene información interna del sistema. Debes iniciar sesión como administrador para acceder.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => handleOpenLoginChange(true)}
                    className="w-full h-12 rounded-xl font-medium shadow-md bg-primary hover:bg-primary/90 text-white transition-all active:scale-[0.98] text-sm"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Acceder como Administrador
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}

          {/* Floating Action Dock (Apple Liquid Glass Dock) */}
          {user && (
            <div className="fixed bottom-6 right-6 z-40 flex flex-row items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-3xl sm:rounded-full border border-white/40 dark:border-white/15 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.6)] transition-all max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
              {pathname !== '/' && (
                <Button
                  asChild
                  className="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl sm:rounded-full shadow-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-white/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0 shrink-0"
                  size="icon"
                >
                  <Link href="/">
                    <LayoutDashboard className="h-8 w-8 sm:h-12 sm:w-12" />
                    <span className="sr-only">Ir al Panel Principal</span>
                  </Link>
                </Button>
              )}
              <Button
                asChild
                className="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl sm:rounded-full shadow-lg bg-gradient-to-br from-primary to-accent hover:opacity-95 text-white border border-white/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0 shrink-0"
                size="icon"
              >
                <Link href="/requests">
                  <Handshake className="h-8 w-8 sm:h-12 sm:w-12" />
                  <span className="sr-only">Ir a Cooperaciones</span>
                </Link>
              </Button>
              <AddExpenseFAB />

              {/* Botón flotante para Menú de Navegación en Cuadrícula */}
              <MobileGridMenu />

              {/* Botón flotante para refrescar / recargar manualmente la app */}
              <Button
                type="button"
                onClick={handleRefreshApp}
                disabled={isRefreshing}
                className="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl sm:rounded-full shadow-lg bg-gradient-to-br from-sky-500 to-blue-600 hover:opacity-95 text-white border border-white/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0 shrink-0"
                size="icon"
                title="Recargar y refrescar app"
              >
                <RotateCw className={cn("h-8 w-8 sm:h-12 sm:w-12 transition-transform duration-500", isRefreshing && "animate-spin")} />
                <span className="sr-only">Recargar App</span>
              </Button>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
