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
    <SidebarMenu>
      {links.map((link) => {
        const Icon = link.icon;
        // Check for active link, handling the base path and dynamic routes
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);

        return (
          <SidebarMenuItem key={link.href} className="relative">
             {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r-full" />}
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={{ children: link.label, side: 'right', align: 'center' }}
            >
              <Link href={link.href}>
                <Icon />
                <span className="group-data-[collapsible=icon]:hidden">{link.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
