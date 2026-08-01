import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiError } from '../lib/api.js';

const BRANCHES = [
  'Computer Science',
  'Electrical',
  'Mechanical',
  'Civil',
  'Electronics',
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    branch: '',
    rollNumber: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(apiError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register once, then RSVP and update your details anytime.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          <div>
            <label className="label">Full name *</label>
            <input className="input" required value={form.name} onChange={set('name')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Branch</label>
              <select className="input" value={form.branch} onChange={set('branch')}>
                <option value="">Select…</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Roll number (optional)</label>
              <input className="input" value={form.rollNumber} onChange={set('rollNumber')} />
            </div>
          </div>
          <div>
            <label className="label">Password * (min 6 characters)</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.password}
              onChange={set('password')}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
