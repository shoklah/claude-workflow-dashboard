import { useState } from 'react';
import { Button } from '../components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { Input } from '../components/ui/input.tsx';

/** A GitHub login field and its submit button (Viewers' "Add viewer", Invites' "Invite"): `onAdd` gets the login
 * trimmed, and the field empties once it says the call went through. */
export function LoginForm({
  action,
  pending,
  onAdd,
}: {
  action: string;
  pending: boolean;
  onAdd: (login: string) => Promise<boolean>;
}) {
  const [login, setLogin] = useState('');
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(login.trim())) setLogin('');
      }}
    >
      <Input
        aria-label="GitHub login"
        placeholder="GitHub login"
        autoComplete="off"
        required
        className="w-48"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
      />
      <Button type="submit" disabled={pending}>
        {action}
      </Button>
    </form>
  );
}

/** The confirming dialog before an account is deleted (the Account page's own, the Admin page's for another), naming
 * what goes with it, as `deleteAccount` deletes it. */
export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  whose,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  whose: 'Your' | 'Its';
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {whose} dashboard's data, collector tokens, viewers and Anthropic key are deleted. It can't be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
