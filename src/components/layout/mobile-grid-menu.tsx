'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Handshake,
  ShoppingCart,
  BarChart3,
  History,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface MenuItem {
  href: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  badge?: string;
}

const menuItems: MenuItem[] = [
  {
    href: '/',
    label: 'Panel',
    sublabel: 'Vista general',
    icon: LayoutDashboard,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    href: '/requests',
    label: 'Cooperaciones',
    sublabel: 'Gestión y pagos',
    icon: Handshake,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    href: '/expenses',
    label: 'Gastos',
    sublabel: 'Registro y comprobantes',
    icon: ShoppingCart,
    gradient: 'from-rose-500 to-orange-500',
  },
  {
    href: '/parents',
    label: 'Alumnos',
    sublabel: 'Padrón y aportaciones',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    href: '/reports',
    label: 'Reportes',
    sublabel: 'Balance y estadísticas',
    icon: BarChart3,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    href: '/log',
    label: 'Bitácora',
    sublabel: 'Historial del sistema',
    icon: History,
    gradient: 'from-sky-500 to-indigo-500',
  },
  {
    href: '/settings',
    label: 'Ajustes',
    sublabel: 'Configuración general',
    icon: Settings,
    gradient: 'from-zinc-600 to-slate-700',
  },
];

export function MobileGridMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      document.body.style.pointerEvents = '';
    }
  };

  const handleNavigate = (href: string) => {
    setIsOpen(false);
    document.body.style.pointerEvents = '';
    router.push(href);
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      localStorage.removeItem('adminName');
      toast({
        title: 'Has cerrado sesión',
      });
      setIsOpen(false);
      document.body.style.pointerEvents = '';
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl sm:rounded-full shadow-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white border border-white/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0"
          size="icon"
          title="Abrir menú de navegación"
        >
          <LayoutGrid className="h-8 w-8 sm:h-12 sm:w-12" />
          <span className="sr-only">Menú de Navegación</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[94vw] max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-white/50 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl shadow-2xl">
        <DialogHeader className="text-left pb-2 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                Menú de Navegación
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Acceso rápido a todas las secciones de la plataforma
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Cuadrícula moderna de navegación */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5 py-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavigate(item.href)}
                className={cn(
                  'group relative flex flex-col items-center justify-center text-center p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all duration-200 active:scale-95 overflow-hidden',
                  isActive
                    ? 'border-primary/50 bg-primary/10 shadow-[0_8px_20px_rgba(var(--primary),0.12)] ring-2 ring-primary/20'
                    : 'border-white/60 dark:border-white/10 bg-white/60 dark:bg-zinc-800/50 hover:bg-white/90 dark:hover:bg-zinc-800/90 hover:border-primary/30 shadow-xs hover:shadow-md'
                )}
              >
                {/* Indicador de activo */}
                {isActive && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}

                {/* Ícono con contenedor squircle degradado */}
                <div
                  className={cn(
                    'flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-300',
                    item.gradient
                  )}
                >
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>

                {/* Textos */}
                <div className="mt-2.5 w-full">
                  <span
                    className={cn(
                      'block text-xs sm:text-sm font-bold truncate',
                      isActive ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5 opacity-80">
                    {item.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Barra inferior: usuario y cerrar sesión */}
        {user && (
          <div className="mt-2 pt-3 border-t border-border/40 flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Sesión Activa
              </span>
              <span className="text-xs font-medium text-foreground truncate">
                {user.email || 'Administrador'}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="h-8 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-1.5 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar Sesión
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
