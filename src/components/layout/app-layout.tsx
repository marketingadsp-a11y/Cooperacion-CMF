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
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
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
        <Sidebar className="bg-sidebar" collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
      )}
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          {user && (
            <SidebarTrigger variant="ghost" size="icon">
              <PanelLeft />
            </SidebarTrigger>
          )}
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Cooperación CMF
          </h1>
          <div className="flex-1" />
          {isUserLoading ? (
            <div className="text-sm font-medium text-gray-600">Cargando...</div>
          ) : user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">
                Bienvenido, {adminName || 'Administrador'}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          ) : (
            auth && (
            <Dialog open={isLoginOpen} onOpenChange={setLoginOpen}>
              <DialogTrigger asChild>
                <Button>
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
          {user && (
            <div className="fixed bottom-6 right-6 flex flex-row items-center gap-4">
              {pathname !== '/' && (
                  <Button asChild className="h-16 w-16 rounded-full shadow-lg bg-gray-600 hover:bg-gray-700" size="icon">
                      <Link href="/">
                          <LayoutDashboard className="h-8 w-8" />
                          <span className="sr-only">Ir al Panel Principal</span>
                      </Link>
                  </Button>
              )}
              <Button asChild className="h-16 w-16 rounded-full shadow-lg" size="icon">
                  <Link href="/requests">
                      <Handshake className="h-8 w-8" />
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
