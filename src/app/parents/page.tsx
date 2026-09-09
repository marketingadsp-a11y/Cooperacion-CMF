'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  PlusCircle,
  MoreHorizontal,
  Upload,
  Search,
  FileDown,
  Users,
  UserCheck,
  Edit3,
  Trash2,
  X,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
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
  useMemoFirebase,
  addDocument,
  updateDocument,
  deleteDocument,
} from '@/firebase';
import { collection, writeBatch, doc, query, orderBy } from 'firebase/firestore';
import { logAction } from '@/lib/logger';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarGradient = (name: string) => {
  const gradients = [
    'from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    'from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
    'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    'from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
    'from-cyan-500/20 to-sky-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

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
    setTimeout(() => {
      setEditingStudent(null);
    }, 150);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) return;

    const formData = new FormData(event.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const parentName = (formData.get('parentName') as string)?.trim();
    if (!name || !parentName) return;

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
      console.error('Error saving student:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el alumno.',
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
      console.error('Error deleting student:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el alumno.',
      });
      setDeletingStudent(null);
    }
  };

  const handleImportStudents = async () => {
    if (!firestore || !user) return;

    const lines = importList.split('\n').filter((line) => line.trim() !== '');
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

      lines.forEach((line) => {
        const parts = line.split('-').map((part) => part.trim());
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
      .map((student) => `${student.name} - ${student.parentName}`)
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

  const totalCount = students?.length || 0;
  const filteredCount = filteredStudents?.length || 0;

  return (
    <div className="flex-1 space-y-5 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Principal Liquid Glass */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-inner backdrop-blur-md">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Alumnos
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
                  {totalCount}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Directorio y control de alumnos registrados
              </p>
            </div>
          </div>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStudents}
              className="flex-1 sm:flex-initial h-10 rounded-xl border-white/40 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md hover:bg-white/90 shadow-sm text-xs font-medium"
            >
              <FileDown className="mr-1.5 h-4 w-4 text-muted-foreground" />
              Exportar
            </Button>

            <Dialog open={isImportDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-initial h-10 rounded-xl border-white/40 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md hover:bg-white/90 shadow-sm text-xs font-medium"
                >
                  <Upload className="mr-1.5 h-4 w-4 text-muted-foreground" />
                  Importar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
                <DialogHeader className="text-left space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Upload className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-lg font-bold">Importar Lista de Alumnos</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Pega tu lista, uno por línea con el formato:
                    <br />
                    <code className="inline-block mt-1.5 rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 font-mono text-xs text-primary font-semibold">
                      Nombre Alumno - Nombre Padre
                    </code>
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Ana Sofía Pérez - Carlos Pérez&#10;Luis Fernando García - María García&#10;..."
                  className="min-h-[180px] rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary text-sm font-mono p-3"
                  value={importList}
                  onChange={(e) => setImportList(e.target.value)}
                />
                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    onClick={handleImportStudents}
                    className="w-full sm:w-auto h-10 rounded-xl font-medium shadow-md"
                  >
                    Procesar e Importar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => handleOpenForm()}
              size="sm"
              className="w-full sm:w-auto h-10 rounded-xl shadow-md bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white border border-white/20 font-medium transition-all active:scale-[0.98]"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Añadir Alumno
            </Button>
          </div>
        )}
      </div>

      {/* Modal Añadir / Editar Alumno estilo Liquid Glass */}
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[425px] w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 mb-1">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {editingStudent ? 'Editar Alumno' : 'Añadir Nuevo Alumno'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ingresa los datos correspondientes del alumno y de su tutor responsable.
            </DialogDescription>
          </DialogHeader>

          <form id="student-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Nombre del Alumno
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Ej: Sofia Martínez"
                className="h-12 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary text-base"
                defaultValue={editingStudent?.name || ''}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parentName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Madre, Padre o Tutor
              </Label>
              <Input
                id="parentName"
                name="parentName"
                placeholder="Ej: Roberto Martínez"
                className="h-12 rounded-xl bg-white/60 dark:bg-black/40 border-muted-foreground/20 focus-visible:ring-primary text-base"
                defaultValue={editingStudent?.parentName || ''}
                required
              />
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="h-11 rounded-xl border-white/40 dark:border-white/10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="student-form"
                className="h-11 rounded-xl shadow-md font-medium"
              >
                {editingStudent ? 'Guardar Cambios' : 'Guardar Alumno'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contenedor Principal Liquid Glass con Buscador y Listado */}
      <Card className="border border-white/40 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        {/* Barra de búsqueda integrada */}
        <div className="p-3.5 sm:p-5 border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por alumno o padre..."
              className="w-full h-11 rounded-2xl bg-white/80 dark:bg-black/40 border-muted-foreground/20 pl-10 pr-9 focus-visible:ring-primary text-sm shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50 transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-muted-foreground px-1">
            <span>
              {searchQuery ? (
                <>
                  Mostrando <strong className="text-foreground">{filteredCount}</strong> de {totalCount}
                </>
              ) : (
                <>
                  Total: <strong className="text-foreground">{totalCount}</strong> alumnos
                </>
              )}
            </span>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Cargando directorio de alumnos...</p>
            </div>
          ) : filteredStudents && filteredStudents.length > 0 ? (
            <>
              {/* VISTA MÓVIL (Celulares): Tarjetas interactivas Apple Liquid Glass */}
              <div className="block sm:hidden divide-y divide-white/20 dark:divide-white/5 p-2 space-y-2">
                {filteredStudents.map((student) => {
                  const initials = getInitials(student.name);
                  const gradientStyle = getAvatarGradient(student.name);

                  return (
                    <div
                      key={student.id}
                      className="p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xs transition-all hover:bg-white/80 active:scale-[0.99] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar estilo iOS */}
                          <div
                            className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradientStyle} flex items-center justify-center font-bold text-sm shadow-xs shrink-0 border`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground text-base tracking-tight truncate">
                              {student.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                              <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate">{student.parentName}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción táctiles directos para móvil */}
                      {user && (
                        <div className="flex items-center gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm(student)}
                            className="flex-1 h-9 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/70 text-foreground border border-black/5 dark:border-white/5"
                          >
                            <Edit3 className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingStudent(student)}
                            className="flex-1 h-9 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/10"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* VISTA ESCRITORIO (Tablets y Laptops): Tabla Apple Liquid Glass */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-white/20 dark:border-white/10">
                      <TableHead className="w-[45%] font-semibold text-foreground">Alumno</TableHead>
                      <TableHead className="w-[40%] font-semibold text-foreground">Madre / Padre / Tutor</TableHead>
                      {user && <TableHead className="text-right w-[15%]">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const initials = getInitials(student.name);
                      const gradientStyle = getAvatarGradient(student.name);

                      return (
                        <TableRow
                          key={student.id}
                          className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors border-b border-white/15 dark:border-white/5"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradientStyle} flex items-center justify-center font-bold text-xs shadow-xs border shrink-0`}
                              >
                                {initials}
                              </div>
                              <span className="text-foreground font-semibold">{student.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <UserCheck className="h-4 w-4 text-primary shrink-0" />
                              <span>{student.parentName}</span>
                            </div>
                          </TableCell>
                          {user && (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <span className="sr-only">Abrir menú</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleOpenForm(student)}
                                    className="rounded-xl cursor-pointer"
                                  >
                                    <Edit3 className="mr-2 h-4 w-4 text-primary" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive rounded-xl cursor-pointer"
                                    onClick={() => setDeletingStudent(student)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="py-16 px-4 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
                <Users className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg text-foreground">
                  {searchQuery ? 'No se encontraron alumnos' : 'Directorio de alumnos vacío'}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                  {searchQuery
                    ? `No hay coincidencias para "${searchQuery}". Intenta con otro término o limpia la búsqueda.`
                    : 'Aún no se han registrado alumnos. Añade uno de forma manual o importa una lista.'}
                </p>
              </div>
              {searchQuery ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="rounded-xl border-white/40 dark:border-white/10"
                >
                  Limpiar búsqueda
                </Button>
              ) : user ? (
                <Button
                  size="sm"
                  onClick={() => handleOpenForm()}
                  className="rounded-xl shadow-md bg-gradient-to-r from-primary to-accent text-white"
                >
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Añadir el primer alumno
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerta de confirmación de eliminación estilo Liquid Glass */}
      <AlertDialog
        open={!!deletingStudent}
        onOpenChange={(isOpen) => !isOpen && setDeletingStudent(null)}
      >
        <AlertDialogContent className="sm:max-w-md w-[92vw] rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl p-5 sm:p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              ¿Eliminar a {deletingStudent?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Esta acción no se puede deshacer. Se eliminará permanentemente del directorio de alumnos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 rounded-xl border-white/40 dark:border-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium shadow-md"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
