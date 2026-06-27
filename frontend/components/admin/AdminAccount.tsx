import { Clock3, KeyRound, ShieldCheck } from 'lucide-react';

export function AdminAccount({ email, name }: { email: string; name: string }) {
  return (
    <div className="admin-account-grid">
      <section className="admin-panel admin-account-profile">
        <span className="admin-account-avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
        <div><p className="section-kicker">Administrator</p><h2>{name}</h2><p>{email}</p></div>
      </section>
      <section className="admin-panel admin-security-panel">
        <div><ShieldCheck size={21} /><span><strong>Secure session</strong><small>Authentication is held in an HTTP-only cookie.</small></span></div>
        <div><KeyRound size={21} /><span><strong>Protected actions</strong><small>Updates require a per-session CSRF token.</small></span></div>
        <div><Clock3 size={21} /><span><strong>Automatic expiry</strong><small>Inactive sessions expire after the configured lifetime.</small></span></div>
      </section>
    </div>
  );
}
