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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelLeft, LogIn, LogOut, Handshake, LayoutDashboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import type { User as AppUser, AppSettings } from '@/lib/types';
import { AddExpenseFAB } from './add-expense-fab';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const pathname = usePathname();

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'app_settings') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);
  
  useEffect(() => {
    // Attempt to get admin name from session storage on initial load
    const storedName = sessionStorage.getItem('adminName');
    if (user && storedName) {
      setAdminName(storedName);
    }
  }, [user]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !firestore) return;

    const formData = new FormData(event.currentTarget);
    const accessCode = formData.get('accessCode') as string;
    setLoginError(null);

    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('accessCode', '==', accessCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoginError('Código de acceso no válido.');
        return;
      }
      
      await signInAnonymously(auth);

      const foundUser = querySnapshot.docs[0].data() as AppUser;
      setAdminName(foundUser.name);
      sessionStorage.setItem('adminName', foundUser.name);

      toast({
        title: `¡Bienvenido, ${foundUser.name}!`,
        description: 'Has iniciado sesión como administrador.',
      });
      setLoginOpen(false);

    } catch (error: any) {
      console.error(error);
      setLoginError(error.message || 'Ocurrió un error al iniciar sesión.');
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: error.message,
      });
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setAdminName(null);
      sessionStorage.removeItem('adminName');
      toast({
        title: 'Has cerrado sesión',
      });
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
                  alt="Logo Cooperación CMF"
                  className="h-full w-full object-contain p-0.5"
                />
              ) : (
                <Handshake className="h-4 w-4 text-primary" />
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
              Cooperación <span className="text-primary font-black">CMF</span>
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
              <Dialog open={isLoginOpen} onOpenChange={setLoginOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl shadow-xs bg-primary hover:bg-primary/90">
                    <LogIn className="mr-2 h-4 w-4" />
                    Acceder
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Acceso de Administrador</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLogin} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="accessCode" className="text-right">
                        Código
                      </Label>
                      <Input
                        id="accessCode"
                        name="accessCode"
                        type="password"
                        className="col-span-3"
                        required
                      />
                    </div>
                    {loginError && <p className="text-center text-sm text-destructive">{loginError}</p>}
                    <DialogFooter>
                      <Button type="submit">Entrar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          )}
        </header>

        <main className="flex-1 relative">
          {children}

          {/* Floating Action Dock (Apple Liquid Glass Dock) */}
          {user && (
            <div className="fixed bottom-6 right-6 z-40 flex flex-row items-center gap-2.5 p-2 rounded-full border border-white/40 dark:border-white/15 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.6)] transition-all">
              {pathname !== '/' && (
                <Button
                  asChild
                  className="h-12 w-12 rounded-full shadow-md bg-zinc-800 hover:bg-zinc-700 text-white border border-white/20 transition-all hover:scale-105"
                  size="icon"
                >
                  <Link href="/">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="sr-only">Ir al Panel Principal</span>
                  </Link>
                </Button>
              )}
              <Button
                asChild
                className="h-12 w-12 rounded-full shadow-md bg-gradient-to-br from-primary to-accent hover:opacity-95 text-white border border-white/30 transition-all hover:scale-105"
                size="icon"
              >
                <Link href="/requests">
                  <Handshake className="h-5 w-5" />
                  <span className="sr-only">Ir a Cooperaciones</span>
                </Link>
              </Button>
              <AddExpenseFAB />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
