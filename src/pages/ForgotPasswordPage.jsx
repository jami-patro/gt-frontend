import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiError } from '../lib/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(apiError(err, 'Could not send a new password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your registered email and we'll send you a new temporary password.
        </p>

        {sent ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              A new password has been emailed to <strong>{email}</strong>. Check your inbox (and
              spam), then use it to log in.
            </div>
            <Link to="/login" className="btn-primary block w-full text-center">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a new password'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
