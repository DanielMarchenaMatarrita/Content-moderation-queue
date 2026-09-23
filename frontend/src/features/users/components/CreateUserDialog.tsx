import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { createUser, usersQueryKeys } from '../api';
import { useActivity } from '../../../app/providers/ActivityProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { Button } from '../../../shared/components/Button';
import { Field, Input } from '../../../shared/components/FormControls';
import { Modal } from '../../../shared/components/Modal';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import type { User } from '../../../shared/types/api';
import { getErrorMessage } from '../../../shared/lib/format';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewUser: (id: string) => void;
}

interface FormErrors {
  email?: string;
  displayName?: string;
  password?: string;
}

export function CreateUserDialog({ open, onOpenChange, onViewUser }: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { addActivity } = useActivity();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [created, setCreated] = useState<User | null>(null);
  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      setCreated(user);
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      showToast({ title: 'User created', description: user.displayName, tone: 'success' });
      addActivity({ title: 'User created', description: `${user.displayName} (${user.email}) was created.`, tone: 'success' });
    },
    onError: (error) => {
      showToast({ title: "Couldn't create user", description: getErrorMessage(error), tone: 'error' });
      addActivity({ title: 'User creation failed', description: getErrorMessage(error), tone: 'error' });
    },
  });

  useEffect(() => {
    if (!open) {
      setEmail('');
      setDisplayName('');
      setPassword('');
      setErrors({});
      setCreated(null);
      mutation.reset();
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Enter a valid email address.';
    if (normalizedEmail.length > 320) nextErrors.email = 'Email must be 320 characters or fewer.';
    if (!normalizedName) nextErrors.displayName = 'Display name is required.';
    if (normalizedName.length > 120) nextErrors.displayName = 'Display name must be 120 characters or fewer.';
    if (password.length < 8 || password.length > 128) nextErrors.password = 'Password must contain 8 to 128 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    mutation.mutate({ email: normalizedEmail, displayName: normalizedName, password });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={created ? 'User created' : 'Create user'}
      description={created ? 'The API returned this new user record.' : 'Create a submission actor using the supported Users API.'}
    >
      {created ? (
        <div className="dialog-success">
          <CheckCircle size={32} weight="fill" aria-hidden="true" />
          <div><h3>{created.displayName}</h3><p>{created.email}</p></div>
          <StatusBadge status={created.role} />
          <code>{created.id}</code>
          <Button variant="primary" onClick={() => { onOpenChange(false); onViewUser(created.id); }}>
            View user <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={submit} noValidate>
          <Field label="Email" htmlFor="user-email" error={errors.email}>
            <Input id="user-email" type="email" autoComplete="email" value={email} disabled={mutation.isPending} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'user-email-error' : undefined} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Display name" htmlFor="user-display-name" error={errors.displayName}>
            <Input id="user-display-name" value={displayName} maxLength={120} disabled={mutation.isPending} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? 'user-display-name-error' : undefined} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="Password" htmlFor="user-password" hint="8 to 128 characters. Password is never returned by the API." error={errors.password}>
            <Input id="user-password" type="password" autoComplete="new-password" value={password} minLength={8} maxLength={128} disabled={mutation.isPending} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'user-password-error' : 'user-password-hint'} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {mutation.isError ? <div className="inline-alert inline-alert-error" role="alert">{getErrorMessage(mutation.error)}</div> : null}
          <div className="form-actions">
            <Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={mutation.isPending}>{mutation.isPending ? 'Creating' : 'Create user'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
