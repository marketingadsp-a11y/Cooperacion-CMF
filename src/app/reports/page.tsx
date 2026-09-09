'use client';
import { StatCard } from '@/components/stat-card';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  FileDown,
  BarChart3,
  Calendar,
  Wallet,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Contribution, Expense } from '@/lib/types';
import { collection, Timestamp } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface Transaction {
  id: string;
  description: string;
  date: Date;
  amount: number;
  type: 'income' | 'expense';
}

export default function ReportsPage() {
  const firestore = useFirestore();

  const contributionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'contributions') : null),
    [firestore]
  );
  const { data: contributions } = useCollection<Contribution>(contributionsQuery);

  const expensesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'expenses') : null),
    [firestore]
  );
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const totalIncome = contributions?.reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const balance = totalIncome - totalExpenses;

  const toDate = (timestamp: any): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }
    return new Date();
  };

  const allTransactions: Transaction[] = [];

  if (contributions) {
    contributions.forEach((item) => {
      if (!item.date || !item.id) return;
      const date = toDate(item.date);
      allTransactions.push({
        id: item.id,
        description: `Cooperación: ${item.requestTitle} - ${item.studentName}`,
        date: date,
        amount: item.amount,
        type: 'income',
      });
    });
  }

  if (expenses) {
    expenses.forEach((item) => {
      if (!item.date || !item.id) return;
      const date = toDate(item.date);
      allTransactions.push({
        id: item.id,
        description: item.description,
        date: date,
        amount: item.amount,
        type: 'expense',
      });
    });
  }

  allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleExportPDF = () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const tableData = allTransactions.map((tx) => [
      tx.description,
      tx.date.toLocaleDateString('es-MX'),
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      `${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}`,
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Reporte General de Finanzas', 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100);
    const exportDate = new Date().toLocaleDateString('es-MX');
    doc.text(`Generado el: ${exportDate}`, 14, 28);

    doc.setDrawColor(220, 220, 220);
    doc.line(14, 32, 196, 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumen Financiero', 14, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Ingresos Totales: ${formatCurrency(totalIncome)}`, 14, 47);
    doc.text(`Gastos Totales: ${formatCurrency(totalExpenses)}`, 14, 53);
    doc.text(`Saldo Neto: ${formatCurrency(balance)}`, 14, 59);

    doc.autoTable({
      startY: 66,
      head: [['Descripción', 'Fecha', 'Tipo', 'Monto']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
    });

    doc.save(`Reporte de Cooperaciones - ${exportDate.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Liquid Glass */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-inner backdrop-blur-md">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Reporte General
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Balance general y libro de ingresos y egresos
            </p>
          </div>
        </div>

        <Button
          onClick={handleExportPDF}
          size="sm"
          className="w-full sm:w-auto h-11 sm:h-10 rounded-xl shadow-md bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white border border-white/20 font-medium transition-all active:scale-[0.98]"
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          Exportar a PDF
        </Button>
      </div>

      {/* Tarjetas de Estadísticas Liquid Glass */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title="Ingresos Totales"
          value={formatCurrency(totalIncome)}
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          className="bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] border-emerald-500/20"
        />
        <StatCard
          title="Gastos Totales"
          value={formatCurrency(totalExpenses)}
          icon={<ArrowDownLeft className="h-4 w-4 text-red-500" />}
          className="bg-red-500/[0.04] dark:bg-red-500/[0.07] border-red-500/20"
        />
        <StatCard
          title="Saldo Neto"
          value={formatCurrency(balance)}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          className="bg-primary/[0.04] dark:bg-primary/[0.07] border-primary/20"
        />
      </div>

      {/* Historial de Transacciones */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <CardTitle className="text-base sm:text-lg font-bold">Historial de Transacciones</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {allTransactions.length} movimientos
          </span>
        </CardHeader>

        <CardContent className="p-2 sm:p-4">
          {allTransactions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No hay transacciones registradas todavía.
            </div>
          ) : (
            <>
              {/* VISTA MÓVIL (Celulares): Estilo Apple Wallet */}
              <div className="block sm:hidden space-y-2">
                {allTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const dateFormatted = tx.date.toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            isIncome
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-sm tracking-tight leading-snug truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="capitalize">{isIncome ? 'Ingreso' : 'Gasto'}</span>
                            <span>•</span>
                            <span>{dateFormatted}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-bold font-mono ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VISTA ESCRITORIO: Tabla con ScrollArea */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[480px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-white/20 dark:border-white/10">
                        <TableHead className="font-semibold text-foreground">Descripción</TableHead>
                        <TableHead className="font-semibold text-foreground">Fecha</TableHead>
                        <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions.map((tx) => (
                        <TableRow
                          key={tx.id}
                          className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/15 dark:border-white/5"
                        >
                          <TableCell className="font-medium text-foreground">{tx.description}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {tx.date.toLocaleDateString('es-MX')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={tx.type === 'income' ? 'success' : 'destructive'}
                              className={`rounded-full text-xs font-semibold px-2.5 py-0.5 ${
                                tx.type === 'income'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                              }`}
                            >
                              {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold font-mono ${
                              tx.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
