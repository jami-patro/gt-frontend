import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, apiError } from '../lib/api.js';

const BRANCHES = ['Computer Science', 'Electrical', 'Mechanical', 'Civil', 'Electronics'];

// On-screen popup showing a guest's pass QR + name, so they can just take a
// photo and move on. Also has a Download button (saves the named PNG).
function PassModal({ id, name, onClose }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    let obj;
    api
      .get(`/api/admin/users/${id}/pass.png`, { responseType: 'blob' })
      .then((res) => {
        obj = URL.createObjectURL(res.data);
        if (alive) setUrl(obj);
      })
      .catch((e) => alive && setErr(apiError(e, 'Could not load pass QR')));
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          🎟️ Reunion Pass
        </div>
        <div className="mt-1 text-xl font-extrabold text-ink-950">{name || 'Guest'}</div>
        <div className="mt-4 flex justify-center">
          {url ? (
            <img src={url} alt="Pass QR" className="h-64 w-64 rounded-lg ring-1 ring-slate-200" />
          ) : err ? (
            <div className="py-16 text-sm text-rose-600">{err}</div>
          ) : (
            <div className="py-16 text-sm text-slate-400">Loading…</div>
          )}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600">
          📸 Take a photo of this QR to use at the venue.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => downloadPassWithName(id, name).catch(() => {})}
            className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white hover:bg-ink-800"
          >
            ⬇ Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Fetch a guest's bare QR PNG from the backend, then draw it onto a canvas with
// their NAME + "Reunion Pass" label below (so a printed/downloaded pass is
// identifiable — matching what the member sees on their dashboard). Returns
// after triggering the download. Uses a blob object URL (same-origin, so the
// canvas isn't tainted and toDataURL works).
async function downloadPassWithName(id, name) {
  const res = await api.get(`/api/admin/users/${id}/pass.png`, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(res.data);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not load QR image'));
      i.src = objectUrl;
    });
    const qr = img.width || 600;
    const footer = Math.round(qr * 0.22);
    const canvas = document.createElement('canvas');
    canvas.width = qr;
    canvas.height = qr + footer;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, qr, qr);
    const displayName = name || 'Guest';
    // Shrink the font a touch for long names so they fit on one line.
    const nameSize = Math.round(qr * (displayName.length > 20 ? 0.05 : 0.07));
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0a0b';
    ctx.font = `bold ${nameSize}px -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillText(displayName, qr / 2, qr + footer * 0.5);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${Math.round(qr * 0.035)}px -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillText('🎟️ Reunion Pass', qr / 2, qr + footer * 0.82);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${displayName.replace(/[^a-z0-9]+/gi, '_')}-pass.png`;
    a.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const ATTEND_BADGE = {
  yes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  maybe: 'bg-amber-50 text-amber-700 ring-amber-200',
  no: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function Badge({ value }) {
  if (!value) return <span className="text-xs text-slate-400">no response</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ATTEND_BADGE[value]}`}>
      {value}
    </span>
  );
}

const PAY_BADGE = {
  paid: ['Paid', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  pending: ['Review', 'bg-amber-50 text-amber-700 ring-amber-200'],
  rejected: ['Rejected', 'bg-rose-50 text-rose-700 ring-rose-200'],
  not_paid: ['Unpaid', 'bg-slate-100 text-slate-500 ring-slate-200'],
};

function PaymentBadge({ status }) {
  const [label, cls] = PAY_BADGE[status] || PAY_BADGE.not_paid;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}>{label}</span>;
}

// Compact event-day redemption badges (from QR scans). Green = done.
function PassCell({ pass }) {
  const p = pass || {};
  const drinks = Number(p.drinks) || 0;
  const chip = (done, title, content) => (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        done ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-300 ring-1 ring-slate-200'
      }`}
    >
      {content}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {chip(p.checkedIn, p.checkedIn ? 'Checked in' : 'Not checked in', '✅')}
      {chip(p.tshirt, p.tshirt ? 'T-shirt collected' : 'T-shirt pending', '👕')}
      {chip(p.souvenir, p.souvenir ? 'Souvenir collected' : 'Souvenir pending', '🎁')}
      {chip(drinks > 0, `Drinks: ${drinks}/2`, `🥤${drinks}`)}
    </div>
  );
}

export default function AdminPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passModal, setPassModal] = useState(null); // { id, name } — on-screen pass popup
  const [query, setQuery] = useState('');
  const [payFilter, setPayFilter] = useState('all'); // all | paid | not_paid | pending | rejected
  const [checkinFilter, setCheckinFilter] = useState('all'); // all | in | out
  const [teeFilter, setTeeFilter] = useState('all'); // all | mens | womens | nosize
  const [methodFilter, setMethodFilter] = useState('all'); // all | <paymentMethodUsed value>
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // all | yes | maybe | no
  const [emailsCopied, setEmailsCopied] = useState(0); // count of emails copied, for feedback
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [editingId, setEditingId] = useState(null); // row id being edited inline
  const [draft, setDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [proof, setProof] = useState(null); // { name, image, note, ... } for modal
  const [proofLoading, setProofLoading] = useState(false);
  const [settings, setSettings] = useState(null); // { paymentOpen, paymentConfigured }
  const [togglingPay, setTogglingPay] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const togglePaymentOpen = async () => {
    if (!settings) return;
    const next = !settings.paymentOpen;
    if (
      !window.confirm(
        next
          ? 'Open contributions? Batchmates will be able to pay and upload proof.'
          : 'Close contributions? The payment section will show as "opens soon".',
      )
    ) {
      return;
    }
    setTogglingPay(true);
    try {
      const r = await api.patch('/api/admin/settings/payment-open', { open: next });
      setSettings((s) => ({ ...s, paymentOpen: r.data.paymentOpen }));
    } catch (err) {
      setError(apiError(err, 'Could not update payment setting'));
    } finally {
      setTogglingPay(false);
    }
  };

  const toggleMethod = async (index, enabled) => {
    try {
      await api.patch('/api/admin/settings/payment-method', { index, enabled });
      setSettings((s) => ({
        ...s,
        methods: s.methods.map((m) => (m.id === index ? { ...m, enabled } : m)),
      }));
    } catch (err) {
      setError(apiError(err, 'Could not update payment method'));
    }
  };

  const viewProof = async (id) => {
    setProofLoading(true);
    try {
      const res = await api.get(`/api/admin/users/${id}/proof`);
      setProof({ ...res.data, id });
    } catch (err) {
      setError(apiError(err, 'Could not load proof'));
    } finally {
      setProofLoading(false);
    }
  };

  const deleteProof = async (id, name) => {
    if (
      !window.confirm(
        `Delete ${name}'s submitted proof (screenshot, txn id, note) and reset them to "not paid"?`,
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/api/admin/users/${id}/proof`);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                paymentStatus: res.data.paymentStatus,
                contributionAmount: res.data.contributionAmount,
                paymentRejectReason: null,
                hasProof: false,
                hasProofOrTxn: false,
                paymentTransactionId: null,
                paymentNote: null,
                paymentMethodUsed: null,
              }
            : r,
        ),
      );
      setProof(null);
    } catch (err) {
      setError(apiError(err, 'Could not delete proof'));
    }
  };

  const rejectPayment = (id) => {
    const reason = window.prompt('Reason for rejection (shown to the member):', 'Screenshot unclear — please re-upload');
    if (reason === null) return; // cancelled
    setPayment(id, { paymentStatus: 'rejected', rejectReason: reason });
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setDraft({
      name: r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      branch: r.branch || '',
      rollNumber: r.rollNumber || '',
      attendance: r.attendance || 'yes',
      foodPreference: r.foodPreference || 'veg',
      tshirtSize: r.tshirtSize || '',
      message: r.message || '',
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const changeDraft = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const load = () => {
    setLoading(true);
    api
      .get('/api/admin/responses')
      .then((r) => setRecords(r.data.records))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  // Silent refresh — used by the manual button and the auto-poll. Skips while
  // an inline edit is open so we don't overwrite unsaved changes.
  const refresh = () => {
    if (editingId) return;
    api
      .get('/api/admin/responses')
      .then((r) => setRecords(r.data.records))
      .catch(() => {});
  };

  useEffect(load, []);

  // Keep the list reasonably fresh so new submissions (proofs, RSVPs) show up
  // without a manual page reload. Also refresh when the tab regains focus.
  useEffect(() => {
    let id = null;
    const start = () => {
      if (id) return;
      id = setInterval(refresh, 30000);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only approved members count toward attendance/food/headcount totals.
  const summary = useMemo(() => {
    const s = { attending: 0, maybe: 0, no: 0, veg: 0, nonVeg: 0, guests: 0, pending: 0, paid: 0, collected: 0, pendingPay: 0, unpaid: 0, needRoom: 0, mensTee: 0, womensTee: 0, noSizeTee: 0 };
    for (const r of records) {
      if (r.paymentStatus === 'paid') s.paid += 1;
      if (r.paymentStatus === 'pending') s.pendingPay += 1;
      if (!r.paymentStatus || r.paymentStatus === 'not_paid' || r.paymentStatus === 'rejected') s.unpaid += 1;
      if (r.accommodationNeeded) s.needRoom += 1;
      // T-shirt fit tally (across all members, for ordering).
      if (r.tshirtFit === 'womens') s.womensTee += 1;
      else s.mensTee += 1;
      // Members who haven't picked a size yet (need a nudge).
      if (!r.tshirtSize) s.noSizeTee += 1;
      s.collected += Number(r.contributionAmount) || 0;
      if (!r.approved) {
        s.pending += 1;
        continue;
      }
      if (r.attendance === 'yes') s.attending += 1;
      if (r.attendance === 'maybe') s.maybe += 1;
      if (r.attendance === 'no') s.no += 1;
      if (r.foodPreference === 'veg') s.veg += 1;
      if (r.foodPreference === 'non_veg') s.nonVeg += 1;
      if (r.attendance === 'yes') s.guests += r.guests || 0;
    }
    s.headcount = s.attending + s.guests;
    return s;
  }, [records]);

  const setApproval = async (id, approved) => {
    try {
      await api.patch(`/api/admin/users/${id}/approval`, { approved });
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
    } catch (err) {
      setError(apiError(err, 'Could not update approval'));
    }
  };

  const setPayment = async (id, patch) => {
    try {
      const res = await api.patch(`/api/admin/users/${id}/payment`, patch);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                paymentStatus: res.data.paymentStatus,
                contributionAmount: res.data.contributionAmount,
                paymentRejectReason: res.data.paymentRejectReason ?? null,
              }
            : r,
        ),
      );
    } catch (err) {
      setError(apiError(err, 'Could not update payment'));
    }
  };

  // How much each account/method has collected (paid contributions only).
  const collectedByMethod = useMemo(() => {
    const m = {};
    for (const r of records) {
      if (r.paymentStatus !== 'paid') continue;
      const key = r.paymentMethodUsed || 'Unspecified';
      if (!m[key]) m[key] = { amount: 0, count: 0 };
      m[key].amount += Number(r.contributionAmount) || 0;
      m[key].count += 1;
    }
    return Object.entries(m).sort((a, b) => b[1].amount - a[1].amount);
  }, [records]);

  // Live event-day redemption stats (from QR scans). Denominator is paid
  // members, since only paid members get a pass.
  const eventStats = useMemo(() => {
    const s = { paid: 0, checkedIn: 0, tshirt: 0, souvenir: 0, drinks: 0, anyScan: 0 };
    for (const r of records) {
      if (r.paymentStatus === 'paid') s.paid += 1;
      const p = r.eventPass || {};
      if (p.checkedIn) s.checkedIn += 1;
      if (p.tshirt) s.tshirt += 1;
      if (p.souvenir) s.souvenir += 1;
      s.drinks += Number(p.drinks) || 0;
      if (p.checkedIn || p.tshirt || p.souvenir || (p.drinks || 0) > 0) s.anyScan += 1;
    }
    return s;
  }, [records]);

  // Counts per payment status, used for the filter chips.
  const payCounts = useMemo(() => {
    const c = { all: records.length, paid: 0, not_paid: 0, pending: 0, rejected: 0 };
    for (const r of records) {
      const s = r.paymentStatus || 'not_paid';
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [records]);

  // Attendance filter counts (for tee-size planning by who's coming).
  const attendanceCounts = useMemo(() => {
    const c = { all: records.length, yes: 0, maybe: 0, no: 0 };
    for (const r of records) {
      if (r.attendance === 'yes') c.yes += 1;
      else if (r.attendance === 'maybe') c.maybe += 1;
      else if (r.attendance === 'no') c.no += 1;
    }
    return c;
  }, [records]);

  // Check-in filter counts.
  const checkinCounts = useMemo(() => {
    const c = { all: records.length, in: 0, out: 0 };
    for (const r of records) {
      if (r.eventPass?.checkedIn) c.in += 1;
      else c.out += 1;
    }
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = records.filter((r) => {
      if (payFilter !== 'all' && (r.paymentStatus || 'not_paid') !== payFilter) return false;
      if (checkinFilter === 'in' && !r.eventPass?.checkedIn) return false;
      if (checkinFilter === 'out' && r.eventPass?.checkedIn) return false;
      if (teeFilter === 'womens' && r.tshirtFit !== 'womens') return false;
      if (teeFilter === 'mens' && r.tshirtFit === 'womens') return false;
      if (teeFilter === 'nosize' && r.tshirtSize) return false;
      if (methodFilter !== 'all' && (r.paymentMethodUsed || 'Unspecified') !== methodFilter) return false;
      if (attendanceFilter !== 'all' && r.attendance !== attendanceFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.branch, r.rollNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // Newest joiners on top, and anyone awaiting approval bubbles up first so
    // they're easy to spot and approve.
    return rows.sort((a, b) => {
      if (a.approved !== b.approved) return a.approved ? 1 : -1; // pending first
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // newest first
    });
  }, [records, query, payFilter, checkinFilter, teeFilter, methodFilter, attendanceFilter]);

  // T-shirt order breakdown for the CURRENT filter — per size, split by fit,
  // so applying Coming / Paid / etc. tells you exactly how many to order.
  const teeBreakdown = useMemo(() => {
    const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const rows = SIZES.map((size) => ({ size, mens: 0, womens: 0, total: 0 }));
    const bySize = Object.fromEntries(rows.map((r) => [r.size, r]));
    let noSize = 0;
    let mensTotal = 0;
    let womensTotal = 0;
    for (const r of filtered) {
      const size = r.tshirtSize;
      const womens = r.tshirtFit === 'womens';
      if (womens) womensTotal += 1;
      else mensTotal += 1;
      if (!size || !bySize[size]) {
        noSize += 1;
        continue;
      }
      bySize[size][womens ? 'womens' : 'mens'] += 1;
      bySize[size].total += 1;
    }
    return { rows, noSize, mensTotal, womensTotal, total: filtered.length };
  }, [filtered]);

  // Pagination (client-side — all records are already loaded).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [query, payFilter, checkinFilter, teeFilter, methodFilter, attendanceFilter]);

  // Download the CSV through axios so the auth header is attached, then
  // trigger a browser download from the blob.
  const exportCsv = async () => {
    try {
      const res = await api.get('/api/admin/export.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reunion-responses.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiError(err, 'Export failed'));
    }
  };

  // Lean printable check-in roster (Pass No, name, branch, check-in + tee/
  // souvenir status), sorted by pass number — the manual fallback if a QR
  // won't scan.
  const downloadCheckinSheet = async () => {
    try {
      const res = await api.get('/api/admin/checkin-sheet.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reunion-checkin-sheet.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiError(err, 'Download failed'));
    }
  };

  // Copy the emails of everyone in the current filtered view to the clipboard,
  // so they can be pasted into a mail client's BCC field.
  const copyEmails = async () => {
    const emails = [...new Set(filtered.map((r) => r.email).filter(Boolean))];
    if (emails.length === 0) {
      setError('No emails in the current filter');
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setEmailsCopied(emails.length);
      setTimeout(() => setEmailsCopied(0), 2500);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  // Download a guest's pass QR as a PNG (e.g. when their phone/email isn't
  // working, so they can photograph it at the desk).
  const downloadPass = async (id, name) => {
    try {
      await downloadPassWithName(id, name);
    } catch (err) {
      setError(apiError(err, 'Could not download pass QR'));
    }
  };

  // Quick toggle of a member's T-shirt fit (Men's / Women's) for ordering.
  const setTshirtFit = async (id, fit) => {
    // Optimistic update, revert on error.
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, tshirtFit: fit } : r)));
    try {
      await api.patch(`/api/admin/records/${id}`, { tshirtFit: fit });
    } catch (err) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, tshirtFit: fit === 'womens' ? 'mens' : 'womens' } : r)),
      );
      setError(apiError(err, 'Could not update T-shirt fit'));
    }
  };

  const saveEdit = async (id) => {
    setSavingEdit(true);
    try {
      const res = await api.patch(`/api/admin/records/${id}`, {
        ...draft,
        tshirtSize: draft.tshirtSize || null,
      });
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...res.data.record } : r)));
      setEditingId(null);
      setDraft({});
    } catch (err) {
      setError(apiError(err, 'Could not save changes'));
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This deletes their account and response.`)) return;
    try {
      await api.delete(`/api/admin/users/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(apiError(err, 'Delete failed'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Admin dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          {settings?.paymentConfigured && (
            <button
              onClick={togglePaymentOpen}
              disabled={togglingPay}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition disabled:opacity-50 ${
                settings.paymentOpen
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200'
              }`}
              title="Open or close contributions (takes effect immediately)"
            >
              <span
                className={`h-2 w-2 rounded-full ${settings.paymentOpen ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {togglingPay
                ? 'Saving…'
                : settings.paymentOpen
                ? 'Contributions: Open'
                : 'Contributions: Closed'}
            </button>
          )}
          <button
            onClick={refresh}
            className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            title="Reload the latest submissions"
          >
            ↻ Refresh
          </button>
          <button
            onClick={copyEmails}
            className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            title="Copy emails of everyone in the current filter (paste into BCC)"
          >
            {emailsCopied ? `✓ Copied ${emailsCopied}` : `✉ Copy emails (${filtered.length})`}
          </button>
          <button
            onClick={downloadCheckinSheet}
            className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            title="Printable check-in roster sorted by pass number (manual fallback)"
          >
            🧾 Check-in sheet
          </button>
          <button onClick={exportCsv} className="btn-primary">
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Pending approvals banner */}
      {summary.pending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{summary.pending}</span>{' '}
          member{summary.pending > 1 ? 's are' : ' is'} waiting for approval. Approve them below so
          their vote counts.
        </div>
      )}

      {/* Payments awaiting review banner — click to filter the list down to them */}
      {summary.pendingPay > 0 && (
        <button
          type="button"
          onClick={() => setPayFilter('pending')}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <span>
            💰 <span className="font-semibold">{summary.pendingPay}</span> payment
            {summary.pendingPay > 1 ? 's are' : ' is'} <strong>under review</strong>. Verify the
            proof and mark as paid.
          </span>
          <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">
            Review now →
          </span>
        </button>
      )}

      {/* Payment QR methods — enable/disable each without a redeploy */}
      {settings?.paymentConfigured && settings.methods?.length > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Payment QR codes</h2>
            <span className="text-xs text-slate-500">
              Toggle which options batchmates see. Disable one if a QR hits a limit or has issues.
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {settings.methods.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-3 text-center transition ${
                  m.enabled ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="text-sm font-semibold text-slate-800">{m.label || 'UPI'}</div>
                {m.qr && (
                  <img
                    src={m.qr}
                    alt={`${m.label} QR`}
                    className={`mx-auto my-2 h-28 w-28 rounded-lg object-contain ${m.enabled ? '' : 'grayscale'}`}
                  />
                )}
                {m.upiId && <div className="break-all text-xs text-slate-500">{m.upiId}</div>}
                {m.phone && <div className="text-xs text-slate-400">📞 {m.phone}</div>}
                <button
                  onClick={() => toggleMethod(m.id, !m.enabled)}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    m.enabled
                      ? 'bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${m.enabled ? 'bg-white' : 'bg-slate-400'}`} />
                  {m.enabled ? 'Published' : 'Hidden'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collected-by-account breakdown */}
      {collectedByMethod.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Collected by account</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collectedByMethod.map(([label, v]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-800">{label}</div>
                <div className="mt-1 text-2xl font-extrabold text-emerald-600">
                  ₹{v.amount.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-400">
                  {v.count} payment{v.count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Based on confirmed (paid) contributions, grouped by whichever QR was live when each
            member submitted.
          </p>
        </div>
      )}

      {/* Event-day reveal slideshow launcher */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">🎬 Reveal slideshow</h2>
          <p className="text-sm text-slate-600">
            Play all collected photos &amp; videos full-screen for the room. Includes a Guess Who
            mode with tap-to-reveal answers. Open on your phone/laptop, then cast or connect to the
            TV/projector.
          </p>
        </div>
        <Link
          to="/reveal"
          className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white hover:bg-ink-800"
        >
          ▶ Open reveal
        </Link>
      </div>

      {/* On-screen pass QR popup (for guests to photograph) */}
      {passModal && (
        <PassModal
          id={passModal.id}
          name={passModal.name}
          onClose={() => setPassModal(null)}
        />
      )}

      {/* Walk-in registration (add a guest at the venue) */}
      <WalkInRegistration onDone={load} />

      {/* Volunteer counter QR links */}
      <VolunteerCounters />

      {/* Event-day tracking (live from QR scans) */}
      {eventStats.anyScan > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Event-day tracking</h2>
            <span className="text-xs text-slate-500">
              Live from counter scans · {eventStats.paid} paid guests
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['✅ Checked in', eventStats.checkedIn, eventStats.paid, 'text-emerald-600'],
              ['👕 T-shirts', eventStats.tshirt, eventStats.paid, 'text-blue-600'],
              ['🎁 Souvenirs', eventStats.souvenir, eventStats.paid, 'text-purple-600'],
              ['🥤 Drinks served', eventStats.drinks, eventStats.paid * 2, 'text-amber-600'],
            ].map(([label, value, total, accent]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-3 text-center">
                <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-600">{label}</div>
                {total > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-current opacity-70"
                      style={{ width: `${Math.min(100, Math.round((value / total) * 100))}%` }}
                    />
                  </div>
                )}
                <div className="mt-1 text-[11px] text-slate-400">of {total}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ['Registered', records.length, 'text-slate-900'],
          ['Attending', summary.attending, 'text-emerald-600'],
          ['Maybe', summary.maybe, 'text-amber-500'],
          ['Not coming', summary.no, 'text-rose-600'],
          ['Veg', summary.veg, 'text-green-600'],
          ['Non-veg', summary.nonVeg, 'text-rose-600'],
          ['Headcount', summary.headcount, 'text-slate-900'],
          ['Pending', summary.pending, 'text-amber-600'],
          ['Paid', summary.paid, 'text-emerald-600'],
          ['Under review', summary.pendingPay, 'text-amber-600'],
          ['Not paid', summary.unpaid, 'text-rose-600'],
          ['🏨 Need stay', summary.needRoom, 'text-indigo-600'],
          ["👕 Men's tee", summary.mensTee, 'text-blue-600'],
          ["👚 Women's tee", summary.womensTee, 'text-pink-600'],
          ['Collected', `₹${summary.collected.toLocaleString('en-IN')}`, 'text-slate-900'],
        ].map(([label, value, accent]) => (
          <div key={label} className="card text-center">
            <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search name, email, branch, roll no…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['paid', 'Paid'],
            ['pending', 'Under review'],
            ['rejected', 'Rejected'],
            ['not_paid', 'Unpaid'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPayFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                payFilter === value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  payFilter === value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {payCounts[value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Check-in filter */}
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['in', '✅ Checked in'],
            ['out', '⌛ Not in yet'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCheckinFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                checkinFilter === value
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  checkinFilter === value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {checkinCounts[value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Attendance filter — for tee-size planning by who's coming */}
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['yes', "🎉 Coming"],
            ['maybe', '🤔 Maybe'],
            ['no', "🚫 Can't come"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setAttendanceFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                attendanceFilter === value
                  ? 'border-brand-500 bg-brand-500 text-ink-950'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  attendanceFilter === value ? 'bg-black/10 text-ink-950' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {attendanceCounts[value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* T-shirt fit filter */}
        <div className="flex flex-wrap gap-2">
          {[
            ['all', '👕 All fits', records.length],
            ['mens', "♂ Men's", summary.mensTee],
            ['womens', "♀ Women's", summary.womensTee],
            ['nosize', '❓ No size yet', summary.noSizeTee],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTeeFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                teeFilter === value
                  ? 'border-pink-600 bg-pink-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  teeFilter === value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Payment payee filter (for refunds — who paid to which account) */}
        {collectedByMethod.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[['all', '💳 All payees', collectedByMethod.reduce((n, [, v]) => n + v.count, 0)]]
              .concat(collectedByMethod.map(([label, v]) => [label, label, v.count]))
              .map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethodFilter(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    methodFilter === value
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      methodFilter === value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* T-shirt order breakdown — reflects the current filter */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            👕 T-shirt order — {teeBreakdown.total} in this view
          </h2>
          <span className="text-xs text-slate-500">
            ♂ {teeBreakdown.mensTotal} men's · ♀ {teeBreakdown.womensTotal} women's
            {teeBreakdown.noSize > 0 ? ` · ${teeBreakdown.noSize} no size set` : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-3 font-semibold">Size</th>
                <th className="py-1.5 pr-3 text-right font-semibold">♂ Men's</th>
                <th className="py-1.5 pr-3 text-right font-semibold">♀ Women's</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {teeBreakdown.rows.map((r) => (
                <tr
                  key={r.size}
                  className={`border-b border-slate-50 ${r.total === 0 ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  <td className="py-1.5 pr-3 font-semibold">{r.size}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.mens}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.womens}</td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{r.total}</td>
                </tr>
              ))}
              <tr className="text-slate-900">
                <td className="py-1.5 pr-3 text-xs font-bold uppercase tracking-wide">Total</td>
                <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{teeBreakdown.mensTotal}</td>
                <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{teeBreakdown.womensTotal}</td>
                <td className="py-1.5 text-right font-bold tabular-nums">
                  {teeBreakdown.mensTotal + teeBreakdown.womensTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {teeBreakdown.noSize > 0 && (
          <p className="mt-2 text-xs text-amber-600">
            {teeBreakdown.noSize} {teeBreakdown.noSize === 1 ? 'person hasn’t' : 'people haven’t'} set a
            size yet — not counted in the size rows above.
          </p>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400">No members found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branch / Roll</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vote</th>
                <th className="px-4 py-3">Food</th>
                <th className="px-4 py-3">Tee</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((r) => {
                const isEditing = editingId === r.id;
                return (
                <tr
                  key={r.id}
                  className={
                    !r.approved
                      ? 'bg-amber-50/60 hover:bg-amber-50'
                      : r.paymentStatus === 'paid'
                        ? 'border-l-4 border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                        : 'hover:bg-slate-50'
                  }
                >
                  {/* Name (+ message) */}
                  <td className="px-4 py-3 font-medium text-slate-800 align-top">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input className="input py-1 text-sm" value={draft.name} onChange={changeDraft('name')} />
                        <input
                          className="input py-1 text-xs"
                          placeholder="Message"
                          value={draft.message}
                          onChange={changeDraft('message')}
                        />
                      </div>
                    ) : (
                      <>
                        {r.name}
                        {r.message && (
                          <div className="mt-0.5 max-w-[200px] truncate text-xs italic text-slate-400">
                            “{r.message}”
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3 text-slate-500 align-top">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input className="input py-1 text-sm" value={draft.email} onChange={changeDraft('email')} />
                        <input className="input py-1 text-xs" placeholder="Phone" value={draft.phone} onChange={changeDraft('phone')} />
                      </div>
                    ) : (
                      <>
                        <div>{r.email}</div>
                        {r.phone && <div className="text-xs">{r.phone}</div>}
                      </>
                    )}
                  </td>

                  {/* Branch / Roll */}
                  <td className="px-4 py-3 text-slate-500 align-top">
                    {isEditing ? (
                      <div className="space-y-1">
                        <select className="input py-1 text-sm" value={draft.branch} onChange={changeDraft('branch')}>
                          <option value="">—</option>
                          {BRANCHES.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <input className="input py-1 text-xs" placeholder="Roll no" value={draft.rollNumber} onChange={changeDraft('rollNumber')} />
                      </div>
                    ) : (
                      <>
                        {r.branch || '—'}
                        {r.rollNumber && <div className="text-xs">{r.rollNumber}</div>}
                      </>
                    )}
                  </td>

                  {/* Status (instant toggle) */}
                  <td className="px-4 py-3 align-top">
                    {r.approved ? (
                      <button
                        onClick={() => setApproval(r.id, false)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        title="Click to revoke approval"
                      >
                        ✓ Approved
                      </button>
                    ) : (
                      <button
                        onClick={() => setApproval(r.id, true)}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-400 px-2.5 py-1 text-xs font-bold text-ink-950 hover:bg-brand-300"
                      >
                        Approve
                      </button>
                    )}
                  </td>

                  {/* Vote */}
                  <td className="px-4 py-3 align-top">
                    {isEditing ? (
                      <select className="input py-1 text-sm" value={draft.attendance} onChange={changeDraft('attendance')}>
                        <option value="yes">Yes</option>
                        <option value="maybe">Maybe</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <Badge value={r.attendance} />
                    )}
                  </td>

                  {/* Food */}
                  <td className="px-4 py-3 text-slate-600 align-top">
                    {isEditing ? (
                      <select className="input py-1 text-sm" value={draft.foodPreference} onChange={changeDraft('foodPreference')}>
                        <option value="veg">Veg</option>
                        <option value="non_veg">Non-veg</option>
                      </select>
                    ) : r.foodPreference === 'non_veg' ? 'Non-veg' : r.foodPreference === 'veg' ? 'Veg' : '—'}
                  </td>

                  {/* Tee */}
                  <td className="px-4 py-3 text-slate-600 align-top">
                    {isEditing ? (
                      <select className="input py-1 text-sm" value={draft.tshirtSize} onChange={changeDraft('tshirtSize')}>
                        <option value="">—</option>
                        {TSHIRT_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <span>{r.tshirtSize || '—'}</span>
                        <button
                          type="button"
                          onClick={() => setTshirtFit(r.id, r.tshirtFit === 'womens' ? 'mens' : 'womens')}
                          title="Tap to switch T-shirt fit (for ordering)"
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                            r.tshirtFit === 'womens'
                              ? 'bg-pink-50 text-pink-700 ring-pink-200'
                              : 'bg-blue-50 text-blue-700 ring-blue-200'
                          }`}
                        >
                          {r.tshirtFit === 'womens' ? "♀ Women's" : "♂ Men's"}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg ring-1 ring-slate-200">
                          <span className="px-1.5 text-xs text-slate-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={r.contributionAmount ?? 0}
                            onChange={(e) =>
                              setRecords((prev) =>
                                prev.map((x) =>
                                  x.id === r.id ? { ...x, contributionAmount: e.target.value } : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              setPayment(r.id, { contributionAmount: Number(e.target.value) || 0 })
                            }
                            className="w-14 rounded-r-lg py-1 text-sm focus:outline-none"
                          />
                        </div>
                        <PaymentBadge status={r.paymentStatus} />
                      </div>
                      <div className="flex items-center gap-1">
                        {(r.hasProofOrTxn || r.hasProof) && (
                          <button
                            onClick={() => viewProof(r.id)}
                            title="View payment proof"
                            className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            🧾 Proof
                          </button>
                        )}
                        {r.paymentStatus === 'paid' ? (
                          <button
                            onClick={() => setPayment(r.id, { paymentStatus: 'not_paid' })}
                            className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                            title="Unmark paid"
                          >
                            Unmark
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setPayment(r.id, {
                                  paymentStatus: 'paid',
                                  contributionAmount: Number(r.contributionAmount) || 0,
                                })
                              }
                              disabled={!(Number(r.contributionAmount) > 0)}
                              className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                              title={
                                Number(r.contributionAmount) > 0
                                  ? 'Mark as paid'
                                  : 'Enter an amount first'
                              }
                            >
                              ✓ Paid
                            </button>
                            {(r.paymentStatus === 'pending' || r.hasProof) && (
                              <button
                                onClick={() => rejectPayment(r.id)}
                                className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                                title="Reject proof"
                              >
                                ✕ Reject
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Event-day redemptions (from QR scans) */}
                  <td className="px-4 py-3 align-top">
                    <PassCell pass={r.eventPass} />
                  </td>

                  {/* Actions (compact icons) */}
                  <td className="px-3 py-3 text-right align-top">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => saveEdit(r.id)}
                          disabled={savingEdit}
                          title="Save"
                          className="grid h-7 w-7 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPassModal({ id: r.id, name: r.name })}
                          title="Show pass QR (for photo)"
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          🎫
                        </button>
                        <button
                          onClick={() => downloadPass(r.id, r.name)}
                          title="Download pass QR"
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          ⬇
                        </button>
                        <button
                          onClick={() => startEdit(r)}
                          title="Edit"
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => remove(r.id, r.name)}
                          title="Remove"
                          className="grid h-7 w-7 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-700">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="tabular-nums">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {proofLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 text-white">Loading proof…</div>
      )}
      {proof && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setProof(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Payment proof — {proof.name}</h3>
              <button onClick={() => setProof(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            {proof.note && (
              <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">Reference:</span>{' '}
                <span className="break-all text-slate-600">{proof.note}</span>
              </div>
            )}
            {proof.transactionId && (
              <div className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-sm">
                <span className="font-semibold text-blue-700">Transaction / UTR:</span>{' '}
                <span className="break-all text-blue-800">{proof.transactionId}</span>
              </div>
            )}
            {proof.methodUsed && (
              <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">Paid to:</span>{' '}
                <span className="text-slate-600">{proof.methodUsed}</span>
              </div>
            )}
            {proof.uploadedAt && (
              <div className="mb-2 text-xs text-slate-400">
                Submitted {new Date(proof.uploadedAt).toLocaleString('en-IN')}
              </div>
            )}
            {proof.image ? (
              <img src={proof.image} alt="Payment proof" className="w-full rounded-lg" />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No screenshot — member provided a transaction id instead.
              </div>
            )}
            <div className="mt-3 border-t border-slate-100 pt-3 text-right">
              <button
                onClick={() => deleteProof(proof.id, proof.name)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
              >
                🗑 Delete proof &amp; reset
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailBroadcast records={records} />
    </div>
  );
}

function RsvpConfirmationResend({ enabled }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const run = async () => {
    setErr('');
    setResult(null);
    if (
      !window.confirm(
        'Email their personalized RSVP status to everyone who has already responded?',
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const res = await api.post('/api/admin/resend-rsvp-confirmations');
      setResult(res.data);
    } catch (e) {
      setErr(apiError(e, 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">Send RSVP status to responders</div>
          <div className="text-xs text-slate-500">
            One-time: emails everyone who already RSVP'd their current status (attendance, food, tee).
          </div>
        </div>
        <button
          onClick={run}
          disabled={sending || !enabled}
          className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send RSVP status'}
        </button>
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      {result && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          Sent to {result.sent} of {result.total} responder{result.total === 1 ? '' : 's'}.
          {result.errors?.length > 0 && ` Some failed: ${result.errors.slice(0, 3).join('; ')}`}
        </div>
      )}
    </div>
  );
}

function EmailBroadcast({ records }) {
  const [status, setStatus] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(() => new Set()); // set of emails
  const [search, setSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get('/api/admin/email/status')
      .then((r) => setStatus(r.data))
      .catch(() => setStatus({ enabled: false }));
  }, []);

  // Everyone with an email is a possible recipient.
  const people = useMemo(
    () => (records || []).filter((r) => r.email),
    [records],
  );

  const branches = useMemo(
    () => Array.from(new Set(people.map((p) => p.branch).filter(Boolean))).sort(),
    [people],
  );

  // Distinct payees/methods among paid members — for refund/payee-specific mails.
  const payees = useMemo(
    () =>
      Array.from(
        new Set(
          people
            .filter((p) => p.paymentStatus === 'paid' && p.paymentMethodUsed)
            .map((p) => p.paymentMethodUsed),
        ),
      ).sort(),
    [people],
  );

  // Helpers to add/remove a group of emails to/from the selection.
  const addGroup = (emails) =>
    setSelected((prev) => {
      const next = new Set(prev);
      emails.forEach((e) => next.add(e));
      return next;
    });
  const emailsWhere = (fn) => people.filter(fn).map((p) => p.email);

  const toggleOne = (email) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });

  const clear = () => {
    setSelected(new Set());
    setShowSelectedOnly(false);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = people;
    if (q) {
      list = list.filter((p) =>
        [p.name, p.email, p.branch].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    // "Selected only" narrows the list to the current recipients so you can
    // verify exactly who a tag added without scrolling the whole batch.
    if (showSelectedOnly) list = list.filter((p) => selected.has(p.email));
    // Float selected people to the top so they're easy to spot at a glance.
    return [...list].sort((a, b) => {
      const aSel = selected.has(a.email) ? 0 : 1;
      const bSel = selected.has(b.email) ? 0 : 1;
      return aSel - bSel;
    });
  }, [people, search, showSelectedOnly, selected]);

  const count = selected.size;

  const send = async () => {
    setErr('');
    setResult(null);
    if (!subject.trim() || !message.trim()) {
      setErr('Subject and message are required.');
      return;
    }
    if (count === 0) {
      setErr('Select at least one recipient.');
      return;
    }
    if (!window.confirm(`Send this email to ${count} selected recipient${count === 1 ? '' : 's'}?`)) {
      return;
    }
    setSending(true);
    try {
      const res = await api.post('/api/admin/broadcast', {
        subject,
        message,
        recipients: Array.from(selected),
      });
      setResult(res.data);
      if (res.data.ok) {
        setSubject('');
        setMessage('');
        setSelected(new Set());
      }
    } catch (e) {
      setErr(apiError(e, 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  const Tag = ({ label, emails }) => (
    <button
      type="button"
      onClick={() => addGroup(emails)}
      disabled={emails.length === 0}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
    >
      + {label}
      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">
        {emails.length}
      </span>
    </button>
  );

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">📣 Email the batch</h2>
        {status && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              status.enabled
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
            }`}
          >
            {status.enabled
              ? `Email ready${status.provider ? ` · ${status.provider === 'gmail' ? 'Gmail' : 'Resend'}` : ''}`
              : 'Not configured'}
          </span>
        )}
      </div>

      {status && !status.enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Set <code>GMAIL_USER</code> + <code>GMAIL_APP_PASSWORD</code> (no domain needed),
          or <code>RESEND_API_KEY</code> + <code>EMAIL_FROM</code>, in the backend
          environment to enable sending.
        </div>
      )}

      <RsvpConfirmationResend enabled={status?.enabled} />

      {/* Quick-select tags */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick add
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Tag label="Everyone" emails={emailsWhere(() => true)} />
          <Tag label="Approved" emails={emailsWhere((p) => p.approved)} />
          <Tag label="Pending" emails={emailsWhere((p) => !p.approved)} />
          <Tag label="Yes" emails={emailsWhere((p) => p.attendance === 'yes')} />
          <Tag label="Maybe" emails={emailsWhere((p) => p.attendance === 'maybe')} />
          <Tag label="No" emails={emailsWhere((p) => p.attendance === 'no')} />
          {/* Payment-status groups — handy for one-click reminder blasts to
              whoever hasn't contributed yet. */}
          <Tag label="Unpaid" emails={emailsWhere((p) => (p.paymentStatus || 'not_paid') === 'not_paid')} />
          <Tag label="Pay review" emails={emailsWhere((p) => p.paymentStatus === 'pending')} />
          <Tag label="Rejected" emails={emailsWhere((p) => p.paymentStatus === 'rejected')} />
          <Tag label="Paid" emails={emailsWhere((p) => p.paymentStatus === 'paid')} />
          {/* Accommodation groups — for sending hotel/stay details to those
              travelling who asked for help. */}
          <Tag label="🏨 Need stay" emails={emailsWhere((p) => p.accommodationNeeded)} />
          <Tag label="Single room" emails={emailsWhere((p) => p.accommodationType === 'single')} />
          <Tag label="Family room" emails={emailsWhere((p) => p.accommodationType === 'family')} />
          {branches.map((b) => (
            <Tag key={b} label={b} emails={emailsWhere((p) => p.branch === b)} />
          ))}
          {/* T-shirt fit groups — for tee-order coordination. */}
          <Tag label="♂ Men's tee" emails={emailsWhere((p) => (p.tshirtFit || 'mens') !== 'womens')} />
          <Tag label="♀ Women's tee" emails={emailsWhere((p) => p.tshirtFit === 'womens')} />
          {/* People who haven't picked a T-shirt size yet — nudge them. */}
          <Tag label="❓ No tee size" emails={emailsWhere((p) => !p.tshirtSize)} />
          {/* Payee groups — e.g. mail everyone who paid to a given account (refunds). */}
          {payees.map((m) => (
            <Tag
              key={m}
              label={`💳 ${m}`}
              emails={emailsWhere((p) => p.paymentStatus === 'paid' && p.paymentMethodUsed === m)}
            />
          ))}
        </div>
      </div>

      {/* Recipient picker */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recipients — {count} selected
          </span>
          <div className="flex items-center gap-3">
            {count > 0 && (
              <button
                type="button"
                onClick={() => setShowSelectedOnly((v) => !v)}
                className={`text-xs font-semibold hover:underline ${
                  showSelectedOnly ? 'text-brand-600' : 'text-slate-500'
                }`}
              >
                {showSelectedOnly ? 'Show all' : `Show selected (${count})`}
              </button>
            )}
            {count > 0 && (
              <button onClick={clear} className="text-xs font-semibold text-rose-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>
        <input
          className="input mb-2"
          placeholder="Search to find people to add…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
          {visible.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-400">No members match.</div>
          ) : (
            <div className="space-y-0.5">
              {visible.map((p) => {
                const on = selected.has(p.email);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      on ? 'bg-brand-400/20' : 'hover:bg-white'
                    }`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleOne(p.email)} />
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="truncate text-xs text-slate-400">{p.email}</span>
                    {p.branch && (
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{p.branch}</span>
                    )}
                    {p.attendance && (
                      <span
                        className={`shrink-0 rounded px-1.5 text-[10px] font-semibold ${
                          p.attendance === 'yes'
                            ? 'bg-emerald-100 text-emerald-700'
                            : p.attendance === 'maybe'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {p.attendance}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Subject
        </span>
        <input
          className="input"
          placeholder="e.g. Venue confirmed — save the date!"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Message
        </span>
        <textarea
          className="input min-h-[140px] resize-y"
          placeholder={'Write your announcement here. Blank lines start a new paragraph.\n\n— Organizing team'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="mt-1 block text-xs text-slate-400">
          Each email is sent individually and starts with “Hi &lt;first name&gt;,” automatically —
          no need to add a greeting. Plain text is wrapped in the reunion's branded template.
        </span>
      </label>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}
      {result && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          Sent to {result.sent} of {result.total} recipient{result.total === 1 ? '' : 's'}.
          {result.errors?.length > 0 && ` Some batches failed: ${result.errors.join('; ')}`}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {count} recipient{count === 1 ? '' : 's'} selected
        </span>
        <button
          onClick={send}
          disabled={sending || !status?.enabled || count === 0}
          className="btn-primary disabled:opacity-50"
        >
          {sending ? 'Sending…' : `Send to ${count}`}
        </button>
      </div>
    </div>
  );
}


// Per-counter QR links to hand to volunteers. Screenshot one and give it to
// the volunteer at that counter — they open it (no login) and scan guests.
function VolunteerCounters() {
  const [stations, setStations] = useState(null);
  const [err, setErr] = useState('');
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/api/admin/stations').then((r) => setStations(r.data.stations)).catch(() => {});
  }, []);

  const rotate = async () => {
    if (
      !window.confirm(
        'Generate fresh counter links? All previously shared links will stop working.',
      )
    ) {
      return;
    }
    setRotating(true);
    setErr('');
    try {
      const r = await api.post('/api/admin/stations/rotate');
      setStations(r.data.stations);
    } catch (e) {
      setErr(apiError(e, 'Could not rotate links'));
    } finally {
      setRotating(false);
    }
  };

  const linkFor = (token) => `${window.location.origin}/station/${token}`;

  const copy = async (token, key) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard blocked — user can long-press the link instead */
    }
  };

  if (!stations) return null;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Volunteer counters</h2>
        <button
          onClick={rotate}
          disabled={rotating}
          className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          title="Invalidate all current links and make new ones"
        >
          {rotating ? 'Rotating…' : '↻ New links'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Screenshot a counter's QR (or copy its link) and give it to that volunteer. They open it —
        no login — and scan each guest's pass. Anyone with a link can mark that counter, so keep
        them private and use “New links” if one leaks.
      </p>
      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stations.map((s) => (
          <div key={s.key} className="rounded-xl border border-slate-200 p-4 text-center">
            <div className="text-sm font-bold text-slate-800">
              {s.emoji} {s.label}
            </div>
            <div className="mx-auto my-3 w-fit rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <QRCodeSVG value={linkFor(s.token)} size={148} level="M" includeMargin />
            </div>
            <button
              onClick={() => copy(s.token, s.key)}
              className="w-full rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {copied === s.key ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


// Register a guest who shows up at the venue without an online RSVP. Creates an
// approved member + RSVP, optionally marks them paid + checked-in, and mints a
// pass — all in one step. Collapsed by default to keep the dashboard tidy.
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
  const [done, setDone] = useState(null); // { name, passUrl }
  const [showPass, setShowPass] = useState(false); // on-screen pass popup

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Download the just-created guest's pass QR as a printable PNG (with name).
  const downloadPng = async (id, name) => {
    try {
      await downloadPassWithName(id, name);
    } catch (e) {
      setErr(apiError(e, 'Could not download pass'));
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
      const res = await api.post('/api/admin/walkin', {
        ...form,
        contributionAmount: Number(form.contributionAmount) || 0,
      });
      setDone({ id: res.data.id, name: res.data.name, passUrl: res.data.passUrl });
      setForm(empty);
      onDone?.();
    } catch (e) {
      setErr(apiError(e, 'Could not register walk-in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">🚶 Walk-in registration</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          {open ? 'Close' : '+ Add walk-in'}
        </button>
      </div>

      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="font-semibold">{done.name}</span> registered ✓
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {done.passUrl && (
              <a
                href={done.passUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
              >
                🔗 Open pass
              </a>
            )}
            {done.id && (
              <button
                type="button"
                onClick={() => setShowPass(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
              >
                🎫 Show QR
              </button>
            )}
            {done.id && (
              <button
                type="button"
                onClick={() => downloadPng(done.id, done.name)}
                className="inline-flex items-center gap-1 rounded-lg bg-ink-950 px-2.5 py-1 text-xs font-bold text-white hover:bg-ink-800"
              >
                ⬇ Download pass QR
              </button>
            )}
          </div>
        </div>
      )}

      {showPass && done?.id && (
        <PassModal id={done.id} name={done.name} onClose={() => setShowPass(false)} />
      )}

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Adds an approved guest with an RSVP. Optionally mark them paid and checked-in. Email is
            optional — leave blank for a quick add.
          </p>
          {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input className="input" value={form.email} onChange={set('email')} placeholder="name@example.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="label">Branch</label>
              <select className="input" value={form.branch} onChange={set('branch')}>
                <option value="">—</option>
                {WALKIN_BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Food</label>
              <select className="input" value={form.foodPreference} onChange={set('foodPreference')}>
                <option value="veg">Veg</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </div>
            <div>
              <label className="label">T-shirt</label>
              <select className="input" value={form.tshirtSize} onChange={set('tshirtSize')}>
                <option value="">—</option>
                {WALKIN_TSHIRTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Contribution (₹)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={form.contributionAmount}
                onChange={set('contributionAmount')}
                placeholder="e.g. 5500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.markPaid}
                onChange={(e) => setForm((f) => ({ ...f, markPaid: e.target.checked }))}
              />
              Mark as paid
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.checkIn}
                onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.checked }))}
              />
              Check in now
            </label>
          </div>

          <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? 'Registering…' : 'Register walk-in'}
          </button>
        </div>
      )}
    </div>
  );
}
