'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Student } from '@/lib/types';
import { PlusCircle, MoreHorizontal, Upload, Search, FileDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, updateDocument, deleteDocument } from '@/firebase';
import { collection, writeBatch, doc, query, orderBy } from 'firebase/firestore';
import { logAction } from '@/lib/logger';

export default function StudentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: students, isLoading } = useCollection<Student>(studentsQuery);
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [importList, setImportList] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenForm = (student: Student | null = null) => {
    setEditingStudent(student);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    // Delay resetting student to allow dialog to animate out
    setTimeout(() => {
      setEditingStudent(null);
    }, 150);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) return;

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const parentName = formData.get('parentName') as string;
    const data: Omit<Student, 'id'> = { name, parentName };

    try {
      if (editingStudent && editingStudent.id) {
        const studentDocRef = doc(firestore, 'students', editingStudent.id);
        await updateDocument(studentDocRef, data);
        logAction(firestore, `actualizó los datos del alumno: "${name}"`, 'student', user.displayName || 'Admin');
        toast({ title: 'Alumno actualizado' });
      } else {
        await addDocument(collection(firestore, 'students'), data);
        logAction(firestore, `añadió un nuevo alumno: "${name}"`, 'student', user.displayName || 'Admin');
        toast({ title: 'Alumno añadido' });
      }
      handleCloseForm();
      window.location.reload();
    } catch (e) {
      console.error("Error saving student:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el alumno.",
      });
    }
  };

  const handleDeleteStudent = async () => {
    if (!firestore || !deletingStudent || !deletingStudent.id || !user) return;
    
    try {
      const studentDocRef = doc(firestore, 'students', deletingStudent.id);
      await deleteDocument(studentDocRef);
      logAction(firestore, `eliminó al alumno: "${deletingStudent.name}"`, 'student', user.displayName || 'Admin');
      toast({
          title: '¡Alumno eliminado!',
          description: `Se ha eliminado a ${deletingStudent.name} de la lista.`,
      });
      setDeletingStudent(null);
      window.location.reload();
    } catch (e) {
      console.error("Error deleting student:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el alumno.",
      });
      setDeletingStudent(null);
    }
  };

  const handleImportStudents = async () => {
    if (!firestore || !user) return;

    const lines = importList.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lista vacía',
        description: 'Por favor, pega una lista de alumnos.',
      });
      return;
    }

    try {
      const batch = writeBatch(firestore);
      let count = 0;

      lines.forEach(line => {
        const parts = line.split('-').map(part => part.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          const student: Omit<Student, 'id'> = {
            name: parts[0],
            parentName: parts[1],
          };
          const docRef = doc(collection(firestore, 'students'));
          batch.set(docRef, student);
          count++;
        }
      });
      
      if (count === 0) {
         toast({
          variant: 'destructive',
          title: 'Formato incorrecto',
          description: 'Asegúrate de que cada línea tenga "Nombre Alumno - Nombre Padre".',
        });
        return;
      }

      await batch.commit();

      logAction(firestore, `importó ${count} nuevos alumnos`, 'student', user.displayName || 'Admin');
      toast({
        title: '¡Importación exitosa!',
        description: `Se han añadido ${count} nuevos alumnos.`,
      });
      setImportDialogOpen(false);
      setImportList('');
      window.location.reload();
    } catch (error) {
      console.error('Error al importar alumnos:', error);
      toast({
        variant: 'destructive',
        title: 'Error en la importación',
        description: 'No se pudieron guardar los alumnos. Revisa la consola para más detalles.',
      });
    }
  };
  
  const handleExportStudents = () => {
    if (!students || students.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay alumnos',
        description: 'No hay alumnos para exportar.',
      });
      return;
    }

    const fileContent = students
      .map(student => `${student.name} - ${student.parentName}`)
      .join('\n');
    
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lista_de_alumnos.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: '¡Exportación completa!',
      description: `Se ha descargado el archivo lista_de_alumnos.txt.`,
    });
  };

  const filteredStudents = students?.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.parentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Alumnos
        </h1>
        {user && (
          <div className="flex gap-2">
             <Button variant="outline" onClick={handleExportStudents}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Dialog open={isImportDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Importar Lista de Alumnos</DialogTitle>
                  <DialogDescription>
                    Pega la lista de alumnos, uno por línea. Asegúrate de que el formato sea: 
                    <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                      Nombre Alumno - Nombre Padre
                    </code>
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Ana Sofía Pérez - Carlos Pérez&#10;Luis Fernando García - María García&#10;..."
                  className="min-h-[200px]"
                  value={importList}
                  onChange={(e) => setImportList(e.target.value)}
                />
                <DialogFooter>
                  <Button type="button" onClick={handleImportStudents}>Importar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={() => handleOpenForm()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Alumno
            </Button>
          </div>
        )}
      </div>

       <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingStudent ? 'Editar Alumno' : 'Añadir Nuevo Alumno'}</DialogTitle>
            </DialogHeader>
            <form id="student-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Alumno</Label>
                <Input id="name" name="name" className="col-span-3" defaultValue={editingStudent?.name || ''} required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="parentName" className="text-right">Madre / Padre</Label>
                <Input id="parentName" name="parentName" className="col-span-3" defaultValue={editingStudent?.parentName || ''} required />
              </div>
            </form>
            <DialogFooter>
               <Button type="button" variant="outline" onClick={handleCloseForm}>Cancelar</Button>
              <Button type="submit" form="student-form">
                {editingStudent ? 'Guardar Cambios' : 'Guardar Alumno'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Directorio de Alumnos</CardTitle>
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por alumno o padre..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Madre / Padre</TableHead>
                {user && <TableHead><span className="sr-only">Acciones</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={user ? 3 : 2}>Cargando...</TableCell></TableRow>}
              {filteredStudents?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.parentName}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleOpenForm(student)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingStudent(student)}>Eliminar</DropdownMenuItem>
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

      <AlertDialog open={!!deletingStudent} onOpenChange={(isOpen) => !isOpen && setDeletingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de que quieres eliminar a este alumno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al alumno de la lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} className="bg-destructive hover:bg-destructive/90">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
