import { useEffect, useState, useMemo } from 'react';
import { api, apiError } from '../lib/api.js';

const BRANCHES = ['Computer Science', 'Electrical', 'Mechanical', 'Civil', 'Electronics'];

export default function CheckinPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState({}); // { [userId]: 'checkedIn'|'tshirt'|'souvenir' }
  const [toast, setToast] = useState(null); // { name, action }

  const load = () => {
    setLoading(true);
    api
      .get('/api/admin/responses')
      .then((r) => setRecords(r.data.records))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter by branch + search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (branchFilter !== 'all' && r.branch !== branchFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.rollNumber].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q),
      );
    });
  }, [records, branchFilter, query]);

  // Branch chip counts
  const branchCounts = useMemo(() => {
    const counts = { all: records.length };
    const checkedInCounts = { all: records.filter((r) => r.eventPass?.checkedIn).length };
    BRANCHES.forEach((b) => {
      const branchRecords = records.filter((r) => r.branch === b);
      counts[b] = branchRecords.length;
      checkedInCounts[b] = branchRecords.filter((r) => r.eventPass?.checkedIn).length;
    });
    return { counts, checkedInCounts };
  }, [records]);

  // Check-in statistics
  const stats = useMemo(() => {
    const checkedIn = records.filter((r) => r.eventPass?.checkedIn).length;
    const tshirt = records.filter((r) => r.eventPass?.tshirt).length;
    const souvenir = records.filter((r) => r.eventPass?.souvenir).length;
    return { checkedIn, tshirt, souvenir, total: records.length };
  }, [records]);

  const toggleAction = async (id, action, currentValue) => {
    setBusy((prev) => ({ ...prev, [id]: action }));
    setError('');
    setToast(null);
    try {
      const res = await api.patch(`/api/admin/users/${id}/eventpass`, {
        [action]: !currentValue,
      });
      const record = records.find((r) => r.id === id);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, eventPass: { ...r.eventPass, ...res.data.eventPass } } : r,
        ),
      );
      
      // Show thank you toast when marking as done
      if (!currentValue && record) {
        const labels = {
          checkedIn: 'checked in',
          tshirt: 'T-shirt collected',
          souvenir: 'souvenir collected',
        };
        setToast({ name: record.name, action: labels[action] });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setError(apiError(err, `Could not update ${action}`));
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (loading) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">Event Check-In</h1>
          <p className="text-sm text-slate-500 md:text-base">Search members, toggle check-in status manually</p>
        </div>
        <button onClick={load} className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
          ↻ Refresh
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 animate-[slideDown_0.3s_ease-out] md:top-20">
          <div className="rounded-xl border border-emerald-300 bg-emerald-500 px-6 py-4 text-center shadow-2xl">
            <div className="text-xl font-bold text-white">🎉 Thank you!</div>
            <div className="mt-1 text-sm text-emerald-50">
              <span className="font-semibold">{toast.name}</span> {toast.action} successfully
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email, or roll number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 md:text-sm"
      />

      {/* Statistics */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="text-base">✅</span>
          Check-in: <span className="text-emerald-600">{stats.checkedIn}</span>/{stats.total}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">👕</span>
          T-shirt: <span className="text-blue-600">{stats.tshirt}</span>/{stats.total}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎁</span>
          Souvenir: <span className="text-purple-600">{stats.souvenir}</span>/{stats.total}
        </div>
      </div>

      {/* Branch filter chips */}
      <div className="flex flex-wrap gap-2">
        {['all', ...BRANCHES].map((branch) => {
          const total = branchCounts.counts[branch] || 0;
          const checkedIn = branchCounts.checkedInCounts[branch] || 0;
          const active = branchFilter === branch;
          return (
            <button
              key={branch}
              onClick={() => setBranchFilter(branch)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition lg:px-3 lg:py-1.5 lg:text-xs ${
                active
                  ? 'border-brand-500 bg-brand-500 text-ink-950'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {branch === 'all' ? 'All' : branch}
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums lg:px-1.5 lg:text-[10px] ${
                  active ? 'bg-black/10 text-ink-950' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {checkedIn}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Walk-in registration */}
      <WalkInRegistration onDone={load} />

      {/* Member list */}
      <div className="text-sm text-slate-500 md:text-base">
        Showing {filtered.length} of {records.length} members
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-slate-400">No members match the current filter.</div>
      ) : (
        <div className="space-y-3 md:space-y-2">
          {filtered.map((r) => {
            const p = r.eventPass || {};
            const isBusy = Boolean(busy[r.id]);
            return (
              <div
                key={r.id}
                className="card flex flex-col gap-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 md:text-lg">{r.name}</span>
                    {r.paymentStatus === 'paid' && (
                      <span className="text-base" title="Payment verified">
                        💰
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 md:text-xs">
                    {[r.branch, r.rollNumber].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    label="Check-in"
                    emoji="✅"
                    done={p.checkedIn}
                    busy={busy[r.id] === 'checkedIn'}
                    disabled={isBusy}
                    onClick={() => toggleAction(r.id, 'checkedIn', p.checkedIn)}
                  />
                  <ActionButton
                    label="T-shirt"
                    emoji="👕"
                    done={p.tshirt}
                    busy={busy[r.id] === 'tshirt'}
                    disabled={isBusy}
                    onClick={() => toggleAction(r.id, 'tshirt', p.tshirt)}
                  />
                  <ActionButton
                    label="Souvenir"
                    emoji="🎁"
                    done={p.souvenir}
                    busy={busy[r.id] === 'souvenir'}
                    disabled={isBusy}
                    onClick={() => toggleAction(r.id, 'souvenir', p.souvenir)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, emoji, done, busy, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-base font-semibold ring-1 transition disabled:opacity-50 md:min-w-0 md:px-3 md:py-2 md:text-sm ${
        done
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className="text-lg md:text-base">{busy ? '⏳' : emoji}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// Walk-in registration — extracted from AdminPage.jsx
const WALKIN_BRANCHES = ['Computer Science', 'Electrical', 'Mechanical', 'Civil', 'Electronics'];
const WALKIN_TSHIRTS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function WalkInRegistration({ onDone }) {
  const [open, setOpen] = useState(false);
  const empty = {
    name: '',
    email: '',
    phone: '',
    branch: '',
    foodPreference: 'veg',
    tshirtSize: '',
    contributionAmount: '',
    markPaid: false,
    checkIn: true,
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null); // { name }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr('');
    setDone(null);
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/api/admin/walkin', {
        ...form,
        contributionAmount: Number(form.contributionAmount) || 0,
      });
      setDone({ name: res.data.name });
      setForm(empty);
      onDone?.();
      // Auto-hide success message after 5 seconds
      setTimeout(() => setDone(null), 5000);
    } catch (e) {
      setErr(apiError(e, 'Could not register walk-in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 md:text-xl">🚶 Walk-in registration</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          {open ? 'Close' : '+ Add walk-in'}
        </button>
      </div>

      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:text-base">
          <span className="font-semibold">{done.name}</span> registered and checked in ✓
        </div>
      )}

      {open && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 md:text-xs">
            Quick registration for walk-ins. Email is optional. Check-in is enabled by default.
          </p>
          {err && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
            <div>
              <label className="label text-base md:text-sm">Name *</label>
              <input className="input text-base md:text-sm" value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div>
              <label className="label text-base md:text-sm">Email (optional)</label>
              <input
                className="input text-base md:text-sm"
                value={form.email}
                onChange={set('email')}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="label text-base md:text-sm">Phone</label>
              <input className="input text-base md:text-sm" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="label text-base md:text-sm">Branch</label>
              <select className="input text-base md:text-sm" value={form.branch} onChange={set('branch')}>
                <option value="">—</option>
                {WALKIN_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-base md:text-sm">Food</label>
              <select className="input text-base md:text-sm" value={form.foodPreference} onChange={set('foodPreference')}>
                <option value="veg">Veg</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </div>
            <div>
              <label className="label text-base md:text-sm">T-shirt</label>
              <select className="input text-base md:text-sm" value={form.tshirtSize} onChange={set('tshirtSize')}>
                <option value="">—</option>
                {WALKIN_TSHIRTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-base md:text-sm">Contribution (₹)</label>
              <input
                type="number"
                min={0}
                className="input text-base md:text-sm"
                value={form.contributionAmount}
                onChange={set('contributionAmount')}
                placeholder="e.g. 5500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-base font-medium text-slate-700 md:text-sm">
              <input
                type="checkbox"
                checked={form.markPaid}
                onChange={(e) => setForm((f) => ({ ...f, markPaid: e.target.checked }))}
                className="h-5 w-5 md:h-4 md:w-4"
              />
              Mark as paid
            </label>
            <label className="flex items-center gap-2 text-base font-medium text-slate-700 md:text-sm">
              <input
                type="checkbox"
                checked={form.checkIn}
                onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.checked }))}
                className="h-5 w-5 md:h-4 md:w-4"
              />
              Check in now
            </label>
          </div>

          <button onClick={submit} disabled={busy} className="btn-primary w-full text-base disabled:opacity-50 md:w-auto md:text-sm">
            {busy ? 'Registering…' : 'Register walk-in'}
          </button>
        </div>
      )}
    </div>
  );
}
