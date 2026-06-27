import { type FormEvent, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export function AdminSetup({
  onSetup,
}: {
  onSetup: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSetup(name, email, password);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : 'Unable to create the admin account',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-labelledby="admin-setup-title">
        <div className="admin-login-mark" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <p className="admin-brand">CARTER<br />DIGITAL SOLUTIONS</p>
        <h1 id="admin-setup-title">Create administrator</h1>
        <p className="admin-login-intro">
          Set up the owner account for this dashboard. Your password will be securely hashed before storage.
        </p>

        {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="setupName">Your name</label>
          <input autoComplete="name" className="form-control" disabled={isSubmitting} id="setupName" maxLength={100} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />

          <label className="form-label" htmlFor="setupEmail">Admin email address</label>
          <input autoComplete="username" className="form-control" disabled={isSubmitting} id="setupEmail" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />

          <label className="form-label" htmlFor="setupPassword">Password</label>
          <input autoComplete="new-password" className="form-control" disabled={isSubmitting} id="setupPassword" maxLength={128} minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          <p className="admin-field-hint">Use 12 or more characters with at least one letter and one number.</p>

          <label className="form-label" htmlFor="setupConfirmation">Confirm password</label>
          <input autoComplete="new-password" className="form-control" disabled={isSubmitting} id="setupConfirmation" maxLength={128} minLength={12} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />

          <button className="btn btn-accent w-100" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating account...' : 'Create admin account'}
          </button>
        </form>
        <a className="admin-back-link" href="/">Return to website</a>
      </section>
    </main>
  );
}
