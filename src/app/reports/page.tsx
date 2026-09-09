
'use client';
import { StatCard } from '@/components/stat-card';
import { formatCurrency } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, DollarSign, FileDown } from 'lucide-react';
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
  }
  
  const allTransactions: Transaction[] = [];

  if (contributions) {
    contributions.forEach(item => {
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
    expenses.forEach(item => {
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
    const tableData = allTransactions.map(tx => [
      tx.description,
      tx.date.toLocaleDateString('es-MX'),
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      { content: formatCurrency(tx.amount), styles: { halign: 'right' } }
    ]);
    const exportDate = new Date().toLocaleDateString('es-MX');

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte General', 14, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${exportDate}`, 14, 28);
    
    doc.autoTable({
        startY: 50,
        head: [['Descripción', 'Fecha', 'Tipo', 'Monto']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [41, 128, 185], // A shade of blue
            textColor: 255,
            fontStyle: 'bold',
        },
    });

    // Add summary section
    let finalY = doc.autoTable.previous.finalY || 50;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Financiero', 14, finalY + 15);

    const summaryData = [
        ['Ingresos Totales:', formatCurrency(totalIncome)],
        ['Gastos Totales:', formatCurrency(totalExpenses)],
        ['Saldo Neto:', formatCurrency(balance)],
    ];

    doc.autoTable({
        startY: finalY + 20,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 11 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 },
            1: { halign: 'right', cellWidth: 'auto' },
        }
    });


    doc.save(`Reporte de Cooperaciones - ${exportDate.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reporte General
        </h1>
        <Button onClick={handleExportPDF}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar a PDF
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Ingresos Totales"
          value={formatCurrency(totalIncome)}
          icon={<ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Gastos Totales"
          value={formatCurrency(totalExpenses)}
          icon={<ArrowDownLeft className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Saldo Neto"
          value={formatCurrency(balance)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
           <ScrollArea className="h-[400px]">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {allTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>{tx.date.toLocaleDateString('es-MX')}</TableCell>
                    <TableCell>
                        <Badge variant={tx.type === 'income' ? 'success' : 'destructive'}>
                        {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${
                        tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                    </TableCell>
                    </TableRow>
                ))}
                 {allTransactions.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center">No hay transacciones registradas.</TableCell>
                    </TableRow>
                 )}
                </TableBody>
            </Table>
           </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
