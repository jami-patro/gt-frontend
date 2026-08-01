import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../lib/api.js';

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
    const s = { attending: 0, maybe: 0, no: 0, veg: 0, nonVeg: 0, guests: 0, pending: 0 };
    for (const r of records) {
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
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branch / Roll</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vote</th>
                <th className="px-4 py-3">Food</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Tee</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className={r.approved ? 'hover:bg-slate-50' : 'bg-amber-50/60 hover:bg-amber-50'}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.name}
                    {r.message && (
                      <div className="mt-0.5 max-w-[200px] truncate text-xs italic text-slate-400">
                        “{r.message}”
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <div>{r.email}</div>
                    {r.phone && <div className="text-xs">{r.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.branch || '—'}
                    {r.rollNumber && <div className="text-xs">{r.rollNumber}</div>}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
                    <Badge value={r.attendance} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.foodPreference === 'non_veg' ? 'Non-veg' : r.foodPreference === 'veg' ? 'Veg' : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.guests ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.tshirtSize || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(r.id, r.name)}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
