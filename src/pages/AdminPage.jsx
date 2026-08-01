import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../lib/api.js';

const BRANCHES = ['Computer Science', 'Electrical', 'Mechanical', 'Civil', 'Electronics'];
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

export default function AdminPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null); // row id being edited inline
  const [draft, setDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(load, []);

  // Only approved members count toward attendance/food/headcount totals.
  const summary = useMemo(() => {
    const s = { attending: 0, maybe: 0, no: 0, veg: 0, nonVeg: 0, guests: 0, pending: 0, paid: 0, collected: 0 };
    for (const r of records) {
      if (r.paymentStatus === 'paid') s.paid += 1;
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
              }
            : r,
        ),
      );
    } catch (err) {
      setError(apiError(err, 'Could not update payment'));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.name, r.email, r.branch, r.rollNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [records, query]);

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
        <button onClick={exportCsv} className="btn-primary">
          Export CSV
        </button>
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ['Attending', summary.attending, 'text-emerald-600'],
          ['Maybe', summary.maybe, 'text-amber-500'],
          ['Not coming', summary.no, 'text-rose-600'],
          ['Veg', summary.veg, 'text-green-600'],
          ['Non-veg', summary.nonVeg, 'text-rose-600'],
          ['Headcount', summary.headcount, 'text-slate-900'],
          ['Pending', summary.pending, 'text-amber-600'],
          ['Paid', summary.paid, 'text-emerald-600'],
          ['Collected', `₹${summary.collected.toLocaleString('en-IN')}`, 'text-slate-900'],
        ].map(([label, value, accent]) => (
          <div key={label} className="card text-center">
            <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <input
        className="input max-w-sm"
        placeholder="Search name, email, branch, roll no…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const isEditing = editingId === r.id;
                return (
                <tr key={r.id} className={r.approved ? 'hover:bg-slate-50' : 'bg-amber-50/60 hover:bg-amber-50'}>
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
                    ) : (r.tshirtSize || '—')}
                  </td>

                  {/* Payment (instant) */}
                  <td className="px-4 py-3 align-top">
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
                      {r.paymentStatus === 'paid' ? (
                        <button
                          onClick={() => setPayment(r.id, { paymentStatus: 'not_paid' })}
                          className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-200"
                          title="Paid — click to unmark"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => setPayment(r.id, { paymentStatus: 'paid' })}
                          className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200 hover:bg-slate-200"
                          title="Mark as paid"
                        >
                          ₹
                        </button>
                      )}
                    </div>
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

    </div>
  );
}
