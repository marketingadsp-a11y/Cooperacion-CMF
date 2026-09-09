'use client';

import {
  BarChart3,
  Handshake,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Settings,
  History,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Panel', icon: LayoutDashboard },
  { href: '/parents', label: 'Alumnos', icon: Users },
  { href: '/requests', label: 'Cooperaciones', icon: Handshake },
  { href: '/expenses', label: 'Gastos', icon: ShoppingCart },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
  { href: '/log', label: 'Bitácora', icon: History },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="px-3 py-3 space-y-1.5">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);

        return (
          <SidebarMenuItem key={link.href} className="relative group">
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={{ children: link.label, side: 'right', align: 'center' }}
              className={cn(
                'relative h-11 w-full rounded-xl px-3 transition-all duration-300 ease-out flex items-center gap-3 overflow-hidden border border-transparent',
                // Liquid Glass styling
                isActive
                  ? 'bg-gradient-to-r from-white/25 via-white/15 to-white/5 dark:from-white/20 dark:via-white/10 dark:to-transparent text-white font-semibold border-white/30 dark:border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-md'
                  : 'text-white/75 hover:text-white hover:bg-white/10 dark:hover:bg-white/5 hover:backdrop-blur-sm hover:border-white/15 hover:translate-x-0.5'
              )}
            >
              <Link href={link.href} className="flex items-center gap-3 w-full">
                {/* Indicador Apple estilo Liquid Glass */}
                {isActive && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                )}

                {/* Contenedor del ícono squircle */}
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
                    isActive
                      ? 'bg-white text-primary shadow-xs'
                      : 'bg-white/10 text-white/90 group-hover:bg-white/20 group-hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <span className="group-data-[collapsible=icon]:hidden text-sm tracking-wide">
                  {link.label}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
