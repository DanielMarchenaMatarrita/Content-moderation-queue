import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router-dom';
import { useActivity } from '../app/providers/ActivityProvider';
import { useToast } from '../app/providers/ToastProvider';
import { contentsQueryKeys, createContent } from '../features/contents/api';
import { listUsers, usersQueryKeys } from '../features/users/api';
import { Button } from '../shared/components/Button';
import { Field, Input, Textarea } from '../shared/components/FormControls';
import { PageHeader } from '../shared/components/PageHeader';
import { getErrorMessage } from '../shared/lib/format';

interface FormErrors { userId?: string; body?: string }

export function CreateContentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { addActivity } = useActivity();
  const [userId, setUserId] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const usersQuery = useQuery({
    queryKey: usersQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => listUsers({ page: 1, limit: 100 }),
  });
  const mutation = useMutation({
    mutationFn: createContent,
    onSuccess: (content) => {
      void queryClient.invalidateQueries({ queryKey: contentsQueryKeys.all });
      showToast({
        title: 'Content submitted',
        description: 'Waiting for moderation.',
        tone: 'success',
      });
      addActivity({
        title: 'Content submitted',
        description: `Submission ${content.id} was accepted and is waiting for moderation.`,
        tone: 'success',
      });
      navigate(`/contents/${content.id}`);
    },
    onError: (error) => {
      showToast({ title: "Couldn't submit content", description: getErrorMessage(error), tone: 'error' });
      addActivity({ title: 'Content submission failed', description: getErrorMessage(error), tone: 'error' });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const trimmedBody = body.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) nextErrors.userId = 'Enter a valid user UUID.';
    if (!trimmedBody) nextErrors.body = 'Content cannot be empty.';
    if (trimmedBody.length > 10_000) nextErrors.body = 'Content must be 10,000 characters or fewer.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    mutation.mutate({ userId, body: trimmedBody });
  }

  return (
    <div className="page-stack narrow-page">
      <PageHeader
        title="Submit content"
        description="Create a real content record and begin the asynchronous moderation flow."
        backLink={<Link className="back-link" to="/contents"><ArrowLeft size={16} aria-hidden="true" />Back to contents</Link>}
      />
      <form className="form-card" onSubmit={submit} noValidate>
        <Field
          label="User UUID"
          htmlFor="content-user"
          hint="Enter an existing user UUID. Loaded users appear as suggestions."
          error={errors.userId}
        >
          <Input
            id="content-user"
            list="content-user-options"
            value={userId}
            required
            disabled={mutation.isPending}
            aria-describedby={errors.userId ? 'content-user-error' : 'content-user-hint'}
            aria-invalid={Boolean(errors.userId)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            onChange={(event) => setUserId(event.target.value)}
          />
          <datalist id="content-user-options">
            {usersQuery.data?.items.map((user) => (
              <option key={user.id} value={user.id}>{user.displayName} ({user.email})</option>
            ))}
          </datalist>
        </Field>
        {usersQuery.isError ? (
          <div className="inline-alert inline-alert-error" role="alert">
            Users could not be loaded. {getErrorMessage(usersQuery.error)}
          </div>
        ) : null}
        {usersQuery.data?.items.length === 0 ? (
          <div className="inline-alert inline-alert-info">
            No users were returned. Enter an existing UUID or <Link to="/users/new">create a user first.</Link>
          </div>
        ) : null}
        <Field
          label="Content"
          htmlFor="content-body"
          hint={`${body.length.toLocaleString()} / 10,000 characters`}
          error={errors.body}
        >
          <Textarea
            id="content-body"
            rows={9}
            maxLength={10_000}
            required
            value={body}
            disabled={mutation.isPending}
            aria-describedby={errors.body ? 'content-body-error' : 'content-body-hint'}
            aria-invalid={Boolean(errors.body)}
            placeholder="Enter content for moderation"
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        {mutation.isError ? <div className="inline-alert inline-alert-error" role="alert">{getErrorMessage(mutation.error)}</div> : null}
        <div className="form-actions">
          <Link className="button button-secondary" to="/contents">Cancel</Link>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            {mutation.isPending ? 'Submitting' : 'Submit content'}
          </Button>
        </div>
      </form>
    </div>
  );
}
