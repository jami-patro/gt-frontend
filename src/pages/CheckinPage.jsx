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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'checked-in' | 'not-checked-in' | 'paid' | 'not-paid' | 'pending-tshirt' | 'pending-souvenir' | 'walk-in'
  const [editingLocation, setEditingLocation] = useState(null); // { userId, value }
  const [savingLocation, setSavingLocation] = useState(null); // userId
  const [uploadingProof, setUploadingProof] = useState(null); // userId

  const load = () => {
    setLoading(true);
    api
      .get('/api/volunteer/responses')
      .then((r) => setRecords(r.data.records))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter by branch + search query + status filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      // Branch filter
      if (branchFilter !== 'all' && r.branch !== branchFilter) return false;
      
      // Search filter
      if (q && ![r.name, r.email, r.rollNumber].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q)
      )) return false;
      
      // Status filter
      if (statusFilter === 'checked-in') {
        return r.eventPass?.checkedIn === true;
      }
      if (statusFilter === 'not-checked-in') {
        return !r.eventPass?.checkedIn;
      }
      if (statusFilter === 'paid') {
        return r.paymentStatus === 'paid';
      }
      if (statusFilter === 'not-paid') {
        return r.paymentStatus !== 'paid';
      }
      if (statusFilter === 'pending-tshirt') {
        return r.eventPass?.checkedIn && !r.eventPass?.tshirt;
      }
      if (statusFilter === 'pending-souvenir') {
        return r.eventPass?.checkedIn && !r.eventPass?.souvenir;
      }
      if (statusFilter === 'walk-in') {
        return r.isWalkIn === true;
      }
      
      return true;
    });
  }, [records, branchFilter, query, statusFilter]);

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
    const notCheckedIn = records.filter((r) => !r.eventPass?.checkedIn).length;
    const tshirt = records.filter((r) => r.eventPass?.tshirt).length;
    const souvenir = records.filter((r) => r.eventPass?.souvenir).length;
    const paid = records.filter((r) => r.paymentStatus === 'paid').length;
    const notPaid = records.filter((r) => r.paymentStatus !== 'paid').length;
    const walkIns = records.filter((r) => r.isWalkIn).length;
    const pendingTshirt = records.filter((r) => r.eventPass?.checkedIn && !r.eventPass?.tshirt).length;
    const pendingSouvenir = records.filter((r) => r.eventPass?.checkedIn && !r.eventPass?.souvenir).length;
    
    // Branch-wise breakdown
    const byBranch = {};
    ['all', ...BRANCHES].forEach((branch) => {
      const branchRecords = branch === 'all' ? records : records.filter((r) => r.branch === branch);
      byBranch[branch] = {
        total: branchRecords.length,
        checkedIn: branchRecords.filter((r) => r.eventPass?.checkedIn).length,
        tshirt: branchRecords.filter((r) => r.eventPass?.tshirt).length,
        souvenir: branchRecords.filter((r) => r.eventPass?.souvenir).length,
      };
    });
    
    return { 
      checkedIn, 
      notCheckedIn, 
      tshirt, 
      souvenir, 
      paid, 
      notPaid, 
      walkIns, 
      pendingTshirt, 
      pendingSouvenir, 
      total: records.length, 
      byBranch 
    };
  }, [records]);

  const toggleAction = async (id, action, currentValue) => {
    setBusy((prev) => ({ ...prev, [id]: action }));
    setError('');
    setToast(null);
    try {
      const res = await api.patch(`/api/volunteer/users/${id}/eventpass`, {
        [action]: !currentValue,
      });
      const record = records.find((r) => r.id === id);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, eventPass: { ...r.eventPass, ...res.data.eventPass }, location: res.data.location ?? r.location } : r,
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

  const saveLocation = async (id, location) => {
    setSavingLocation(id);
    setError('');
    try {
      const res = await api.patch(`/api/volunteer/users/${id}/eventpass`, { location });
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, location: res.data.location } : r)),
      );
      setEditingLocation(null);
    } catch (err) {
      setError(apiError(err, 'Could not update location'));
    } finally {
      setSavingLocation(null);
    }
  };

  const uploadPaymentProof = async (id, file) => {
    setUploadingProof(id);
    setError('');
    try {
      // Import compressImage from AdminPage
      const compressImage = async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const scale = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scale;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const compressed = await compressImage(file);
      const res = await api.patch(`/api/admin/users/${id}/payment`, {
        paymentProof: compressed,
        paymentStatus: 'paid',
      });
      
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                paymentStatus: res.data.paymentStatus,
                hasProof: res.data.hasProof,
                hasProofOrTxn: res.data.hasProofOrTxn,
              }
            : r,
        ),
      );
      
      setToast({ name: records.find((r) => r.id === id)?.name || 'Member', action: 'payment proof uploaded' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(apiError(err, 'Could not upload payment proof'));
    } finally {
      setUploadingProof(null);
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
      <div className="space-y-3">
        {/* Overall stats */}
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
          <div className="flex items-center gap-1.5">
            <span className="text-base">💰</span>
            Paid: <span className="text-green-600">{stats.paid}</span>/{stats.total}
          </div>
        </div>

        {/* Branch-wise breakdown - shown only when a specific branch is selected */}
        {branchFilter !== 'all' && stats.byBranch[branchFilter] && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {branchFilter} Branch
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Check-in</div>
                <div className="text-lg font-bold text-emerald-600">
                  {stats.byBranch[branchFilter].checkedIn}
                  <span className="text-sm text-slate-400">/{stats.byBranch[branchFilter].total}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">T-shirt</div>
                <div className="text-lg font-bold text-blue-600">
                  {stats.byBranch[branchFilter].tshirt}
                  <span className="text-sm text-slate-400">/{stats.byBranch[branchFilter].total}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Souvenir</div>
                <div className="text-lg font-bold text-purple-600">
                  {stats.byBranch[branchFilter].souvenir}
                  <span className="text-sm text-slate-400">/{stats.byBranch[branchFilter].total}</span>
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`btn text-sm ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Show All ({stats.total})
        </button>
        <button
          onClick={() => setStatusFilter('checked-in')}
          className={`btn text-sm ${
            statusFilter === 'checked-in'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          ✅ Checked In ({stats.checkedIn})
        </button>
        <button
          onClick={() => setStatusFilter('not-checked-in')}
          className={`btn text-sm ${
            statusFilter === 'not-checked-in'
              ? 'bg-rose-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          ⏳ Not Checked In ({stats.notCheckedIn})
        </button>
        <button
          onClick={() => setStatusFilter('paid')}
          className={`btn text-sm ${
            statusFilter === 'paid'
              ? 'bg-green-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          💰 Paid ({stats.paid})
        </button>
        <button
          onClick={() => setStatusFilter('not-paid')}
          className={`btn text-sm ${
            statusFilter === 'not-paid'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          ⏳ Not Paid ({stats.notPaid})
        </button>
        <button
          onClick={() => setStatusFilter('walk-in')}
          className={`btn text-sm ${
            statusFilter === 'walk-in'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          🚶 Walk-ins ({stats.walkIns})
        </button>
        <button
          onClick={() => setStatusFilter('pending-tshirt')}
          className={`btn text-sm ${
            statusFilter === 'pending-tshirt'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          👕 Pending T-shirt ({stats.pendingTshirt})
        </button>
        <button
          onClick={() => setStatusFilter('pending-souvenir')}
          className={`btn text-sm ${
            statusFilter === 'pending-souvenir'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          🎁 Pending Souvenir ({stats.pendingSouvenir})
        </button>
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
                    {r.isWalkIn && (
                      <span className="text-base" title="Walk-in registration">
                        🚶
                      </span>
                    )}
                    {r.paymentStatus === 'paid' && (
                      <span className="text-base" title="Payment verified">
                        💰
                      </span>
                    )}
                    {/* Upload payment proof button */}
                    {r.paymentStatus !== 'paid' && (
                      <label
                        className="cursor-pointer text-base hover:scale-110 transition-transform"
                        title="Upload payment proof"
                      >
                        📸
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingProof === r.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadPaymentProof(r.id, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    {uploadingProof === r.id && (
                      <span className="text-base animate-pulse">⏳</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 md:text-xs">
                    {[r.branch, r.rollNumber].filter(Boolean).join(' · ')}
                  </div>
                  {r.phone && (
                    <a
                      href={`tel:${r.phone}`}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 md:text-xs"
                    >
                      📞 {r.phone}
                    </a>
                  )}
                  {/* Location field */}
                  <div className="mt-1 flex items-center gap-2">
                    {editingLocation?.userId === r.id ? (
                      <>
                        <input
                          type="text"
                          value={editingLocation.value}
                          onChange={(e) =>
                            setEditingLocation({ userId: r.id, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveLocation(r.id, editingLocation.value);
                            if (e.key === 'Escape') setEditingLocation(null);
                          }}
                          placeholder="e.g. Bhubaneswar"
                          disabled={savingLocation === r.id}
                          className="input w-40 py-1 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => saveLocation(r.id, editingLocation.value)}
                          disabled={savingLocation === r.id}
                          className="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        >
                          {savingLocation === r.id ? '...' : '✓'}
                        </button>
                        <button
                          onClick={() => setEditingLocation(null)}
                          disabled={savingLocation === r.id}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">
                          📍 {r.location || 'Location not set'}
                        </span>
                        <button
                          onClick={() =>
                            setEditingLocation({ userId: r.id, value: r.location || '' })
                          }
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          ✎
                        </button>
                      </>
                    )}
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
    paymentProof: null,
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null); // { name }
  const [uploadingProof, setUploadingProof] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePhotoUpload = async (file) => {
    setUploadingProof(true);
    setErr('');
    try {
      const compressImage = async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const scale = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scale;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const compressed = await compressImage(file);
      setForm((f) => ({ ...f, paymentProof: compressed, markPaid: true }));
    } catch (e) {
      setErr('Could not process image. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  const submit = async () => {
    setErr('');
    setDone(null);
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/api/volunteer/walkin', {
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

          {/* Payment proof upload */}
          <div className="space-y-2">
            <label className="label text-base md:text-sm">Payment Proof (optional)</label>
            <div className="flex items-center gap-3">
              <label className="btn bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
                {uploadingProof ? '⏳ Processing...' : form.paymentProof ? '✓ Photo uploaded' : '📸 Take/Upload Photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploadingProof || busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {form.paymentProof && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentProof: null, markPaid: false }))}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Tap to open camera and take a photo of payment screenshot/confirmation
            </p>
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
