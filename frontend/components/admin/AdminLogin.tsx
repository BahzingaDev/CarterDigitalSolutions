import { type FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export function AdminLogin({
  configured,
  configurationError,
  onLogin,
}: {
  configured: boolean;
  configurationError?: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-labelledby="admin-login-title">
        <div className="admin-login-mark" aria-hidden="true">
          <LockKeyhole size={24} />
        </div>
        <p className="admin-brand">CARTER<br />DIGITAL SOLUTIONS</p>
        <h1 id="admin-login-title">Admin sign in</h1>
        <p className="admin-login-intro">Use your administrator credentials to continue.</p>

        {!configured ? (
          <div className="alert alert-warning" role="alert">
            {configurationError ?? 'Admin authentication has not been configured on the server.'}
          </div>
        ) : null}
        {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="adminEmail">Email address</label>
          <input
            autoComplete="username"
            className="form-control"
            disabled={!configured || isSubmitting}
            id="adminEmail"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label className="form-label" htmlFor="adminPassword">Password</label>
          <input
            autoComplete="current-password"
            className="form-control"
            disabled={!configured || isSubmitting}
            id="adminPassword"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <button className="btn btn-accent w-100" disabled={!configured || isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <a className="admin-back-link" href="/">Return to website</a>
      </section>
    </main>
  );
}
