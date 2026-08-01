import { useEffect, useState } from 'react';
import { api, apiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const ATTENDANCE_OPTIONS = [
  { value: 'yes', label: "Yes, I'll be there", tone: 'emerald' },
  { value: 'maybe', label: 'Maybe', tone: 'amber' },
  { value: 'no', label: "Can't make it", tone: 'rose' },
];

function OptionButton({ active, tone, children, onClick }) {
  const tones = {
    emerald: 'bg-emerald-600 ring-emerald-600',
    amber: 'bg-amber-500 ring-amber-500',
    rose: 'bg-rose-600 ring-rose-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${
        active ? `${tones[tone]} text-white ring-transparent` : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    attendance: 'yes',
    foodPreference: 'veg',
    guests: 0,
    tshirtSize: '',
    message: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/rsvp')
      .then((r) => {
        if (r.data.response) {
          const x = r.data.response;
          setForm({
            attendance: x.attendance,
            foodPreference: x.foodPreference,
            guests: x.guests ?? 0,
            tshirtSize: x.tshirtSize || '',
            message: x.message || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.put('/api/rsvp', {
        ...form,
        tshirtSize: form.tshirtSize || null,
        guests: Number(form.guests) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(apiError(err, 'Could not save your RSVP'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Hi {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500">Fill in your details below. You can edit them anytime.</p>
      </div>

      {user && user.approved === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Pending approval.</span> Your RSVP is saved, but it
          won't be counted in the public totals until an admin approves your registration.
        </div>
      )}

      <form onSubmit={save} className="card space-y-6">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        {/* Attendance vote */}
        <div>
          <label className="label">Will you attend?</label>
          <div className="flex gap-2">
            {ATTENDANCE_OPTIONS.map((o) => (
              <OptionButton
                key={o.value}
                tone={o.tone}
                active={form.attendance === o.value}
                onClick={() => setForm({ ...form, attendance: o.value })}
              >
                {o.label}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Food preference */}
        <div>
          <label className="label">Food preference</label>
          <div className="flex gap-2">
            <OptionButton
              tone="emerald"
              active={form.foodPreference === 'veg'}
              onClick={() => setForm({ ...form, foodPreference: 'veg' })}
            >
              🥗 Veg
            </OptionButton>
            <OptionButton
              tone="rose"
              active={form.foodPreference === 'non_veg'}
              onClick={() => setForm({ ...form, foodPreference: 'non_veg' })}
            >
              🍗 Non-veg
            </OptionButton>
          </div>
        </div>

        {/* T-shirt (guest count hidden for now) */}
        <div>
          <label className="label">T-shirt size</label>
          <select
            className="input"
            value={form.tshirtSize}
            onChange={(e) => setForm({ ...form, tshirtSize: e.target.value })}
          >
            <option value="">Select…</option>
            {TSHIRT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Message */}
        <div>
          <label className="label">Message (optional)</label>
          <textarea
            rows={3}
            maxLength={500}
            className="input resize-none"
            placeholder="Looking forward to seeing everyone!"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save my RSVP'}
          </button>
          {saved && <span className="text-sm font-medium text-emerald-600">Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}
