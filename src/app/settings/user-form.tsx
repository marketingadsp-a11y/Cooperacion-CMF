'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/types';
import { useFirestore, addDocument, updateDocument } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export function UserForm({ isOpen, onClose, user }: UserFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const accessCode = formData.get('accessCode') as string;

    try {
      if (user && user.id) {
        // Update existing user
        const userDocRef = doc(firestore, 'users', user.id);
        const updatedData: Partial<User> = { name };
        if (accessCode) {
          updatedData.accessCode = accessCode;
        }
        await updateDocument(userDocRef, updatedData);
        toast({ title: "Usuario actualizado" });
      } else {
        // Add new user
        const usersCollection = collection(firestore, 'users');
        const newUser: Omit<User, 'id'> = { name, accessCode };
        await addDocument(usersCollection, newUser);
        toast({ title: "Usuario añadido" });
      }
      onClose();
      window.location.reload();
    } catch (e) {
      console.error("Error saving user:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el usuario.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</DialogTitle>
        </DialogHeader>
        <form id="user-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nombre</Label>
            <Input id="name" name="name" className="col-span-3" defaultValue={user?.name || ''} required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="accessCode" className="text-right">Código de Acceso</Label>
            <Input id="accessCode" name="accessCode" type="password" className="col-span-3" placeholder={user ? 'Dejar en blanco para no cambiar' : ''} required={!user} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="user-form">
            {user ? 'Guardar Cambios' : 'Guardar Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
