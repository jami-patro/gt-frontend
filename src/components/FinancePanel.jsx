import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../lib/api.js';
import { compressImage } from '../lib/image.js';

// Common reunion spend buckets — just suggestions; the field accepts any text.
const CATEGORIES = [
  'Venue',
  'Food & Catering',
  'Tent',
  'DJ & Sound',
  'DJ, Stage, LED, Flex Setup',
  'Photography & Video',
  'Decoration',
  'Printing',
  'T-Shirts',
  'Souvenirs',
  'Gifts',
  'Travel',
  'Miscellaneous',
];

const METHODS = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['bank', 'Bank transfer'],
  ['card', 'Card'],
  ['other', 'Other'],
];
const METHOD_LABEL = Object.fromEntries(METHODS);

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_FORM = {
  description: '',
  category: '',
  quotationAmount: '',
  amount: '', // payment amount to record (initial on create / new on edit)
  bucket: '', // expense default fund
  paymentBucket: '', // fund for the inline payment (defaults to bucket)
  paidBy: '',
  paidTo: '',
  paymentMethod: 'cash',
  spentAt: new Date().toISOString().slice(0, 10),
  note: '',
  proof: null,
  quotationProof: null,
};

// Image popup for a payment receipt OR a quotation document (lazy-loaded).
function ProofModal({ id, kind, paymentId, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const isQuote = kind === 'quotation';
  const path = isQuote
    ? 'quotation-proof'
    : paymentId
    ? `payments/${paymentId}/proof`
    : 'proof';
  const title = isQuote ? '📄 Quotation' : '🧾 Receipt';
  useEffect(() => {
    let alive = true;
    api
      .get(`/api/admin/finance/expenses/${id}/${path}`)
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setErr(apiError(e, `Could not load the ${isQuote ? 'quotation' : 'receipt'}`)));
    return () => {
      alive = false;
    };
  }, [id, path, isQuote]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </div>
        {data && (
          <div className="mt-1 text-sm font-bold text-ink-950">
            {data.description} · {data.paidBy}
          </div>
        )}
        <div className="mt-4 flex justify-center">
          {data?.image ? (
            <img
              src={data.image}
              alt={isQuote ? 'Quotation' : 'Receipt'}
              className="max-h-[60vh] w-auto rounded-lg ring-1 ring-slate-200"
            />
          ) : err ? (
            <div className="py-16 text-sm text-rose-600">{err}</div>
          ) : (
            <div className="py-16 text-sm text-slate-400">Loading…</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Lists all installments for one expense and lets you add / delete them, each
// with its own receipt. `expense` is always the freshest copy (looked up by the
// parent from reloaded data), so totals stay in sync after each change.
function PaymentsModal({ expense, bucketNames = [], onClose, onChanged }) {
  const BLANK = {
    amount: '',
    method: 'cash',
    bucket: expense.bucket || '',
    paidAt: new Date().toISOString().slice(0, 10),
    note: '',
    proof: null,
  };
  const [pf, setPf] = useState(BLANK);
  const [adding, setAdding] = useState(false);
  const [editingPid, setEditingPid] = useState(null); // payment being edited
  const [busy, setBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null); // paymentId whose receipt is open

  const payments = expense.payments || [];
  const formOpen = adding || Boolean(editingPid);
  const editingPayment = editingPid ? payments.find((p) => p.id === editingPid) : null;
  const setField = (k, v) => setPf((f) => ({ ...f, [k]: v }));

  const startAdd = () => {
    setEditingPid(null);
    setPf(BLANK);
    setAdding(true);
  };
  const startEdit = (p) => {
    setAdding(false);
    setEditingPid(p.id);
    setPf({
      amount: String(p.amount ?? ''),
      method: p.method || 'cash',
      bucket: p.bucket || '',
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '',
      note: p.note || '',
      proof: null, // keep existing unless a new file is picked
    });
  };
  const closeForm = () => {
    setAdding(false);
    setEditingPid(null);
    setPf(BLANK);
  };

  const pickProof = async (file) => {
    if (!file) return;
    setProofBusy(true);
    setErr('');
    try {
      setField('proof', await compressImage(file, { maxDim: 1200, quality: 0.7 }));
    } catch (e) {
      setErr(apiError(e, 'Could not process that image'));
    } finally {
      setProofBusy(false);
    }
  };

  const savePayment = async (ev) => {
    ev.preventDefault();
    setErr('');
    if (!(Number(pf.amount) > 0)) return setErr('Enter a payment amount');
    // UPI needs a receipt — on edit, an already-attached one counts.
    const hasExistingProof = Boolean(editingPayment?.hasProof);
    if (pf.method === 'upi' && !pf.proof && !hasExistingProof) {
      return setErr('UPI payments need a receipt');
    }
    setBusy(true);
    try {
      if (editingPid) {
        const body = {
          amount: Number(pf.amount),
          method: pf.method,
          bucket: pf.bucket || expense.bucket || null,
          paidAt: pf.paidAt || undefined,
          note: pf.note.trim() || null,
        };
        if (pf.proof) body.proof = pf.proof; // only replace when a new one picked
        await api.patch(`/api/admin/finance/expenses/${expense.id}/payments/${editingPid}`, body);
      } else {
        await api.post(`/api/admin/finance/expenses/${expense.id}/payments`, {
          amount: Number(pf.amount),
          method: pf.method,
          bucket: pf.bucket || expense.bucket || null,
          paidAt: pf.paidAt || undefined,
          note: pf.note.trim() || null,
          proof: pf.proof || undefined,
        });
      }
      closeForm();
      await onChanged();
    } catch (e) {
      setErr(apiError(e, 'Could not save payment'));
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (pid) => {
    if (!window.confirm('Delete this payment? The total paid will be recalculated.')) return;
    setErr('');
    try {
      await api.delete(`/api/admin/finance/expenses/${expense.id}/payments/${pid}`);
      await onChanged();
    } catch (e) {
      setErr(apiError(e, 'Could not delete payment'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Payments
            </div>
            <div className="text-lg font-extrabold text-ink-950">{expense.description}</div>
            <div className="mt-0.5 text-xs text-slate-500">{expense.bucket || 'No fund'}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* Quotation / paid / outstanding recap */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="text-[11px] uppercase text-slate-400">Quotation</div>
            <div className="text-sm font-bold text-slate-700">
              {expense.quotationAmount > 0 ? inr(expense.quotationAmount) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="text-[11px] uppercase text-slate-400">Total paid</div>
            <div className="text-sm font-bold text-rose-600">{inr(expense.amount)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <div className="text-[11px] uppercase text-slate-400">Outstanding</div>
            <div className={`text-sm font-bold ${expense.outstanding > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {expense.quotationAmount > 0 ? inr(expense.outstanding) : '—'}
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        {/* Installments */}
        <div className="mt-4">
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              No payments recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-1.5">Date</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                  <th className="px-2 py-1.5">Fund</th>
                  <th className="px-2 py-1.5">Method</th>
                  <th className="px-2 py-1.5">Note</th>
                  <th className="px-2 py-1.5 text-center">Receipt</th>
                  <th className="px-2 py-1.5 text-right" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{fmtDate(p.paidAt)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-rose-600">{inr(p.amount)}</td>
                    <td className="px-2 py-1.5">
                      {p.bucket ? (
                        <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {p.bucket}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{METHOD_LABEL[p.method] || p.method}</td>
                    <td className="px-2 py-1.5 text-slate-500">{p.note || '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      {p.hasProof ? (
                        <button
                          type="button"
                          onClick={() => setView(p.id)}
                          className="rounded-lg px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          🧾 View
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">none</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removePayment(p.id)}
                        className="rounded-lg px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / edit payment */}
        {formOpen ? (
          <form onSubmit={savePayment} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="text-sm font-bold text-slate-800">
              {editingPid ? 'Edit payment' : 'Add a payment'}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Amount (₹) *</span>
                <input
                  type="number"
                  min={0}
                  value={pf.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Paid from (fund)</span>
                <select
                  value={pf.bucket}
                  onChange={(e) => setField('bucket', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                >
                  <option value="">Select fund…</option>
                  {bucketNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Method</span>
                <select
                  value={pf.method}
                  onChange={(e) => setField('method', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                >
                  {METHODS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Date</span>
                <input
                  type="date"
                  value={pf.paidAt}
                  onChange={(e) => setField('paidAt', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Receipt {pf.method === 'upi' ? '*' : ''}{' '}
                  {editingPid ? <span className="font-normal text-slate-400">(pick to replace)</span> : ''}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickProof(e.target.files?.[0])}
                  className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-ink-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-800"
                />
                {proofBusy && <span className="text-xs text-slate-400">Processing…</span>}
                {pf.proof && !proofBusy && (
                  <span className="text-xs font-medium text-emerald-600">✓ Attached</span>
                )}
                {!pf.proof && !proofBusy && editingPayment?.hasProof && (
                  <span className="text-xs text-slate-400">Existing receipt kept</span>
                )}
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">Note</span>
              <input
                type="text"
                value={pf.note}
                onChange={(e) => setField('note', e.target.value)}
                placeholder="e.g. advance, final settlement (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy || proofBusy}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save payment'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white hover:bg-ink-800"
          >
            + Add payment
          </button>
        )}

        {view && (
          <ProofModal id={expense.id} paymentId={view} onClose={() => setView(null)} />
        )}
      </div>
    </div>
  );
}

export default function FinancePanel() {
  const [data, setData] = useState(null); // { summary, byCategory, expenses }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [proofView, setProofView] = useState(null); // { id, kind: 'quotation' }
  const [paymentsFor, setPaymentsFor] = useState(null); // expense id
  // Fund mapping editor.
  const [showFunds, setShowFunds] = useState(false);
  const [fundDraft, setFundDraft] = useState([]); // [{ name, methods: [] }]
  const [methodLabels, setMethodLabels] = useState([]);
  const [savingFunds, setSavingFunds] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/admin/finance');
      setData(res.data);
    } catch (err) {
      setError(apiError(err, 'Could not load finance data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary;
  const balanceNegative = summary && summary.balance < 0;
  const selectedFund = useMemo(
    () => (data?.funds || []).find((f) => f.name === form.bucket) || null,
    [data, form.bucket],
  );
  // The fund the inline payment draws from (its own, or the expense default).
  const paymentFund = useMemo(() => {
    const name = form.paymentBucket || form.bucket;
    return (data?.funds || []).find((f) => f.name === name) || null;
  }, [data, form.paymentBucket, form.bucket]);
  // Whether the expense being edited already has a receipt / quotation stored.
  const editingExpense = useMemo(
    () => (editingId ? (data?.expenses || []).find((e) => e.id === editingId) : null),
    [editingId, data],
  );
  const editingHasQuote = Boolean(editingExpense?.hasQuotationProof);
  const proofRequired = form.paymentMethod === 'upi';
  // Live outstanding preview in the form = quotation − total paid (≥ 0). On
  // edit, total paid is the saved sum of installments (not an editable field).
  const formOutstanding = useMemo(() => {
    const q = Number(form.quotationAmount) || 0;
    const paid = editingId ? Number(editingExpense?.amount) || 0 : Number(form.amount) || 0;
    return q > 0 ? Math.max(0, q - paid) : 0;
  }, [form.quotationAmount, form.amount, editingId, editingExpense]);

  const cards = useMemo(
    () => [
      ['Collected', inr(summary?.collected), 'text-emerald-600', `${summary?.collectedCount || 0} paid`],
      ['Spent (paid)', inr(summary?.spent), 'text-rose-600', `${summary?.expenseCount || 0} entries`],
      [
        'Balance left',
        inr(summary?.balance),
        balanceNegative ? 'text-rose-600' : 'text-indigo-600',
        balanceNegative ? 'Over budget!' : 'Available now',
      ],
      [
        'Outstanding',
        inr(summary?.outstanding),
        (summary?.outstanding || 0) > 0 ? 'text-amber-600' : 'text-slate-400',
        'Still owed to vendors',
      ],
    ],
    [summary, balanceNegative],
  );

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickImage = async (file, field, setBusy) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await compressImage(file, { maxDim: 1200, quality: 0.7 });
      setField(field, dataUrl);
    } catch (err) {
      setError(apiError(err, 'Could not process that image'));
    } finally {
      setBusy(false);
    }
  };
  const onPickProof = (file) => onPickImage(file, 'proof', setProofBusy);
  const onPickQuote = (file) => onPickImage(file, 'quotationProof', setQuoteBusy);

  const openAdd = () => {
    setEditingId(null);
    // Default the fund to the first configured one for convenience.
    const def = data?.bucketNames?.[0] || '';
    setForm({ ...EMPTY_FORM, bucket: def, paymentBucket: def });
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({
      description: e.description || '',
      category: e.category || 'Miscellaneous',
      quotationAmount: e.quotationAmount ? String(e.quotationAmount) : '',
      // Blank — this field records a NEW payment on edit, not the running total.
      amount: '',
      bucket: e.bucket || '',
      paymentBucket: e.bucket || '',
      paidBy: e.paidBy || '',
      paidTo: e.paidTo || '',
      paymentMethod: e.paymentMethod || 'cash',
      spentAt: e.spentAt ? new Date(e.spentAt).toISOString().slice(0, 10) : '',
      note: e.note || '',
      // Leave proofs null in edit mode → unchanged unless a new file is picked.
      proof: null,
      quotationProof: null,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    if (!form.description.trim()) return setError('Please enter what the money was spent on');
    if (!form.bucket.trim()) return setError('Please choose which fund the money was paid from');

    // An optional payment can be recorded inline (the "Advance / payment" /
    // "Add a payment" field) on both create and edit.
    const payAmount = Number(form.amount) || 0;
    if (payAmount > 0 && form.paymentMethod === 'upi' && !form.proof) {
      return setError('A receipt is required for a UPI payment');
    }

    // Metadata common to create + edit.
    const meta = {
      description: form.description.trim(),
      category: form.category.trim() || 'Other',
      quotationAmount: Number(form.quotationAmount) || 0,
      bucket: form.bucket.trim() || null,
      // Default "who paid" to the fund holder when not separately specified.
      paidBy: form.paidBy.trim() || form.bucket.trim(),
      paidTo: form.paidTo.trim() || null,
      spentAt: form.spentAt || undefined,
      note: form.note.trim() || null,
    };
    if (form.quotationProof) meta.quotationProof = form.quotationProof;

    setSaving(true);
    try {
      if (editingId) {
        // Update metadata, then record the extra payment (if any) as a new
        // installment on the existing expense.
        await api.patch(`/api/admin/finance/expenses/${editingId}`, meta);
        if (payAmount > 0) {
          await api.post(`/api/admin/finance/expenses/${editingId}/payments`, {
            amount: payAmount,
            method: form.paymentMethod,
            bucket: form.paymentBucket || form.bucket || null,
            paidAt: form.spentAt || undefined,
            proof: form.proof || undefined,
          });
        }
      } else {
        // Create the expense; its initial payment (if any) is recorded inline.
        const payload = { ...meta };
        if (payAmount > 0) {
          payload.amount = payAmount;
          payload.paymentMethod = form.paymentMethod;
          payload.paymentBucket = form.paymentBucket || form.bucket || null;
          if (form.proof) payload.proof = form.proof;
        }
        await api.post('/api/admin/finance/expenses', payload);
      }
      await load();
      cancelForm();
    } catch (err) {
      setError(apiError(err, 'Could not save the expense'));
    } finally {
      setSaving(false);
    }
  };

  const openFunds = async () => {
    setError('');
    try {
      const res = await api.get('/api/admin/finance/buckets');
      setFundDraft(
        (res.data.buckets || []).map((b) => ({ name: b.name, methods: [...(b.methods || [])] })),
      );
      setMethodLabels(res.data.methodLabels || []);
      setShowFunds(true);
    } catch (err) {
      setError(apiError(err, 'Could not load fund settings'));
    }
  };

  const setFundName = (i, name) =>
    setFundDraft((d) => d.map((b, idx) => (idx === i ? { ...b, name } : b)));
  const toggleFundMethod = (i, label) =>
    setFundDraft((d) =>
      d.map((b, idx) =>
        idx === i
          ? {
              ...b,
              methods: b.methods.includes(label)
                ? b.methods.filter((m) => m !== label)
                : [...b.methods, label],
            }
          : b,
      ),
    );
  const addFund = () => setFundDraft((d) => [...d, { name: '', methods: [] }]);
  const removeFund = (i) => setFundDraft((d) => d.filter((_, idx) => idx !== i));

  const saveFunds = async () => {
    const cleaned = fundDraft
      .map((b) => ({ name: b.name.trim(), methods: b.methods }))
      .filter((b) => b.name);
    if (cleaned.length === 0) return setError('Add at least one fund');
    const names = cleaned.map((b) => b.name.toLowerCase());
    if (new Set(names).size !== names.length) return setError('Fund names must be unique');

    setSavingFunds(true);
    setError('');
    try {
      await api.put('/api/admin/finance/buckets', { buckets: cleaned });
      setShowFunds(false);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not save fund settings'));
    } finally {
      setSavingFunds(false);
    }
  };

  const togglePublish = async () => {
    const next = !data?.financePublic;
    if (
      next &&
      !window.confirm(
        'Publish the accounts on the public landing page? Everyone will see the quotation, paid and due per expense, plus the collected/spent/balance totals (no receipts, funds or names).',
      )
    ) {
      return;
    }
    setPublishing(true);
    setError('');
    try {
      await api.patch('/api/admin/finance/publish', { published: next });
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not update publish state'));
    } finally {
      setPublishing(false);
    }
  };

  const remove = async (e) => {
    if (!window.confirm(`Delete expense "${e.description}" (${inr(e.amount)})? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/finance/expenses/${e.id}`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not delete the expense'));
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">💰 Expenditure &amp; balance</h2>
          <p className="text-sm text-slate-500">
            Track every rupee spent — who paid, how much, and what&apos;s left from the collection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <button
              type="button"
              onClick={togglePublish}
              disabled={publishing}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-50 ${
                data?.financePublic
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200'
              }`}
              title="Show or hide the public accounts panel on the landing page"
            >
              <span
                className={`h-2 w-2 rounded-full ${data?.financePublic ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {publishing
                ? 'Saving…'
                : data?.financePublic
                ? 'Accounts: Published'
                : 'Accounts: Hidden'}
            </button>
          )}
          <button
            type="button"
            onClick={openFunds}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ⚙ Manage funds
          </button>
          <button
            type="button"
            onClick={showForm && !editingId ? cancelForm : openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white hover:bg-ink-800"
          >
            {showForm && !editingId ? 'Close' : '+ Add expense'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading finances…</div>
      ) : (
        <>
          {/* Collected / Spent / Balance / Outstanding */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(([label, value, accent, sub]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</div>
                <div className="text-xs text-slate-400">{sub}</div>
              </div>
            ))}
          </div>

          {(summary?.outstanding || 0) > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              After clearing all vendor dues ({inr(summary.outstanding)}), the projected balance
              would be{' '}
              <span
                className={`font-bold ${summary.balanceAfterDues < 0 ? 'text-rose-600' : 'text-indigo-600'}`}
              >
                {inr(summary.balanceAfterDues)}
              </span>
              .
            </div>
          )}

          {balanceNegative && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              ⚠ Spending has exceeded what&apos;s been collected. Review the entries below.
            </div>
          )}

          {/* Per-fund balances (who holds how much, and what's left) */}
          {data.funds?.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">Funds (per money-holder)</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.funds.map((f) => {
                  const over = f.balance < 0;
                  return (
                    <div key={f.name} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{f.name}</span>
                        <span
                          className={`text-xs font-semibold ${over ? 'text-rose-600' : 'text-indigo-600'}`}
                        >
                          {over ? 'Over' : 'Remaining'}
                        </span>
                      </div>
                      <div className={`mt-1 text-2xl font-extrabold ${over ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {inr(f.balance)}
                      </div>
                      <div className="mt-2 flex justify-between text-xs">
                        <span className="text-slate-500">
                          Collected <span className="font-semibold text-emerald-600">{inr(f.collected)}</span>
                        </span>
                        <span className="text-slate-500">
                          Spent <span className="font-semibold text-rose-600">{inr(f.spent)}</span>
                        </span>
                      </div>
                      {/* Simple collected-vs-spent bar. */}
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{
                            width: `${f.collected > 0 ? Math.min(100, Math.round((f.spent / f.collected) * 100)) : (f.spent > 0 ? 100 : 0)}%`,
                          }}
                        />
                      </div>
                      {f.methods.length > 0 && (
                        <div className="mt-2 text-[11px] text-slate-400">
                          {f.methods.map((m) => m.label).join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collections not mapped to any fund — nudge the admin to assign. */}
          {data.unassigned?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-semibold">Unassigned collections:</span>{' '}
              {data.unassigned.map((u) => `${u.label} (${inr(u.amount)})`).join(', ')}.{' '}
              <button type="button" onClick={openFunds} className="font-semibold underline">
                Assign to a fund
              </button>
            </div>
          )}

          {/* Spend logged against a fund that no longer exists. */}
          {data.orphanSpend?.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <span className="font-semibold">Spend on removed funds:</span>{' '}
              {data.orphanSpend.map((o) => `${o.name} (${inr(o.amount)})`).join(', ')}. Re-create
              the fund or edit those expenses.
            </div>
          )}

          {/* Fund mapping editor */}
          {showFunds && (
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-800">Manage funds</div>
                <button
                  type="button"
                  onClick={addFund}
                  className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  + Add fund
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Each fund holds the money collected via the payment methods you tick. A method
                should belong to only one fund.
              </p>
              {fundDraft.map((b, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={b.name}
                      onChange={(e) => setFundName(i, e.target.value)}
                      placeholder="Fund holder name"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold focus:border-ink-950 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeFund(i)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {methodLabels.length === 0 && (
                      <span className="text-xs text-slate-400">No collection methods seen yet.</span>
                    )}
                    {methodLabels.map((label) => {
                      const on = b.methods.includes(label);
                      // Flag a method already claimed by another fund in the draft.
                      const claimedElsewhere = fundDraft.some(
                        (ob, oi) => oi !== i && ob.methods.includes(label),
                      );
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleFundMethod(i, label)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                            on
                              ? 'bg-indigo-600 text-white ring-indigo-600'
                              : claimedElsewhere
                              ? 'bg-white text-slate-300 ring-slate-200'
                              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-100'
                          }`}
                          title={claimedElsewhere && !on ? 'Already assigned to another fund' : ''}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveFunds}
                  disabled={savingFunds}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingFunds ? 'Saving…' : 'Save funds'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFunds(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Spend by category */}
          {data.byCategory.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">Spent by category</div>
              <div className="flex flex-wrap gap-2">
                {data.byCategory.map((c) => (
                  <span
                    key={c.category}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs"
                  >
                    <span className="font-semibold text-slate-700">{c.category}</span>
                    <span className="font-bold text-rose-600">{inr(c.amount)}</span>
                    <span className="text-slate-400">({c.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add / edit form */}
          {showForm && (
            <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="text-sm font-bold text-slate-800">
                {editingId ? 'Edit expense' : 'New expense'}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">What was it for *</span>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="e.g. Banquet hall advance"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Category <span className="font-normal text-slate-400">(what it&apos;s for)</span>
                  </span>
                  <select
                    value={CATEGORIES.includes(form.category) ? form.category : (form.category ? '__custom__' : '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') setField('category', ' ');
                      else setField('category', v);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  >
                    <option value="">Select a category…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__custom__">Other (type your own)…</option>
                  </select>
                  {/* Free-text box appears when "Other" is chosen or a custom value exists. */}
                  {form.category && !CATEGORIES.includes(form.category) && (
                    <input
                      type="text"
                      autoFocus
                      value={form.category.trim()}
                      onChange={(e) => setField('category', e.target.value)}
                      placeholder="Type a custom category"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                    />
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Quotation amount (₹){' '}
                    <span className="font-normal text-slate-400">agreed price</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.quotationAmount}
                    onChange={(e) => setField('quotationAmount', e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                </label>
                {editingId && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Total paid so far (₹)</span>
                    <input
                      type="text"
                      readOnly
                      value={inr(editingExpense?.amount || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-rose-600"
                    />
                    <button
                      type="button"
                      onClick={() => setPaymentsFor(editingId)}
                      className="mt-1 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      💳 Manage payments ({editingExpense?.paymentCount || 0}) — view / delete installments
                    </button>
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    {editingId ? 'Add a payment (₹)' : 'Advance / payment (₹)'}{' '}
                    <span className="font-normal text-slate-400">
                      {editingId ? 'optional — records a new payment' : 'optional — reduces outstanding'}
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.amount}
                    onChange={(e) => setField('amount', e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">
                    Each amount you enter is logged as a dated payment with its own receipt.
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Paid from (this payment){' '}
                    <span className="font-normal text-slate-400">which fund it comes out of</span>
                  </span>
                  <select
                    value={form.paymentBucket}
                    onChange={(e) => setField('paymentBucket', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  >
                    <option value="">Use default fund</option>
                    {(data?.bucketNames || []).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {Number(form.amount) > 0 && paymentFund && (
                    <span
                      className={`text-xs ${paymentFund.balance < 0 ? 'text-rose-600' : 'text-slate-500'}`}
                    >
                      Available in {paymentFund.name}:{' '}
                      <span className="font-semibold">{inr(paymentFund.balance)}</span>
                    </span>
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Outstanding (₹)</span>
                  <input
                    type="text"
                    readOnly
                    value={Number(form.quotationAmount) > 0 ? inr(formOutstanding) : '—'}
                    className={`w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold ${formOutstanding > 0 ? 'text-amber-600' : 'text-slate-500'}`}
                  />
                  <span className="text-xs text-slate-400">Quotation − total paid (auto)</span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Default fund * <span className="font-normal text-slate-400">for payments</span>
                  </span>
                  <select
                    value={form.bucket}
                    onChange={(e) => setField('bucket', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  >
                    <option value="">Select fund…</option>
                    {(data?.bucketNames || []).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {selectedFund && (
                    <span
                      className={`text-xs ${selectedFund.balance < 0 ? 'text-rose-600' : 'text-slate-500'}`}
                    >
                      {selectedFund.name}: available{' '}
                      <span className="font-semibold">{inr(selectedFund.balance)}</span>
                    </span>
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Who paid (person)</span>
                  <input
                    type="text"
                    value={form.paidBy}
                    onChange={(e) => setField('paidBy', e.target.value)}
                    placeholder="Defaults to the fund holder"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Paid to (vendor)</span>
                  <input
                    type="text"
                    value={form.paidTo}
                    onChange={(e) => setField('paidTo', e.target.value)}
                    placeholder="Shop / caterer / payee"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Method <span className="font-normal text-slate-400">of this payment</span>
                  </span>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setField('paymentMethod', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  >
                    {METHODS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Date</span>
                  <input
                    type="date"
                    value={form.spentAt}
                    onChange={(e) => setField('spentAt', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Receipt {proofRequired && Number(form.amount) > 0 ? '*' : ''}{' '}
                    <span className="font-normal text-slate-400">for this payment</span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickProof(e.target.files?.[0])}
                    className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-ink-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-800"
                  />
                  {proofBusy && <span className="text-xs text-slate-400">Processing image…</span>}
                  {form.proof && !proofBusy && (
                    <span className="text-xs font-medium text-emerald-600">✓ Receipt attached</span>
                  )}
                  {proofRequired && Number(form.amount) > 0 && !form.proof && !proofBusy && (
                    <span className="text-xs text-amber-600">Required for UPI payments</span>
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-2 font-medium text-slate-600">
                    Quotation document{' '}
                    {editingId && <span className="font-normal text-slate-400">(pick to replace)</span>}
                    {editingId && editingHasQuote && (
                      <button
                        type="button"
                        onClick={() => setProofView({ id: editingId, kind: 'quotation' })}
                        className="rounded-lg px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        📄 View current
                      </button>
                    )}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickQuote(e.target.files?.[0])}
                    className="w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-ink-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-800"
                  />
                  {quoteBusy && <span className="text-xs text-slate-400">Processing image…</span>}
                  {form.quotationProof && !quoteBusy && (
                    <span className="text-xs font-medium text-emerald-600">✓ Quotation attached</span>
                  )}
                  {!form.quotationProof && !quoteBusy && editingHasQuote && (
                    <span className="text-xs text-slate-400">Existing quotation kept</span>
                  )}
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Note</span>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setField('note', e.target.value)}
                  placeholder="Reference no., context, etc. (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || proofBusy || quoteBusy}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Ledger */}
          {data.expenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              No expenses logged yet. Add the first one to start the ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Fund</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Paid by</th>
                    <th className="px-2 py-2">Paid to</th>
                    <th className="px-2 py-2">Method</th>
                    <th className="px-2 py-2 text-right">Paid / Quote</th>
                    <th className="px-2 py-2 text-center">Docs</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2 whitespace-nowrap text-slate-500">{fmtDate(e.spentAt)}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-800">{e.description}</div>
                        {e.note && <div className="text-xs text-slate-400">{e.note}</div>}
                      </td>
                      <td className="px-2 py-2">
                        {(() => {
                          const funds = [
                            ...new Set((e.payments || []).map((p) => p.bucket).filter(Boolean)),
                          ];
                          const show = funds.length ? funds : e.bucket ? [e.bucket] : [];
                          if (show.length === 0) return <span className="text-xs text-slate-300">—</span>;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {show.map((b) => (
                                <span
                                  key={b}
                                  className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{e.category}</td>
                      <td className="px-2 py-2 text-slate-600">{e.paidBy}</td>
                      <td className="px-2 py-2 text-slate-500">{e.paidTo || '—'}</td>
                      <td className="px-2 py-2 text-slate-500">{METHOD_LABEL[e.paymentMethod] || e.paymentMethod}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="font-bold text-rose-600">{inr(e.amount)}</div>
                        {e.quotationAmount > 0 && (
                          <div className="text-[11px] text-slate-400">of {inr(e.quotationAmount)}</div>
                        )}
                        {e.outstanding > 0 && (
                          <div className="text-[11px] font-semibold text-amber-600">
                            Due {inr(e.outstanding)}
                          </div>
                        )}

                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPaymentsFor(e.id)}
                            className="rounded-lg px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                            title="View / add payments and their receipts"
                          >
                            💳 Payments ({e.paymentCount || 0})
                          </button>
                          {e.hasQuotationProof && (
                            <button
                              type="button"
                              onClick={() => setProofView({ id: e.id, kind: 'quotation' })}
                              className="rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              📄 Quote
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(e)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold text-slate-800">
                    <td className="px-2 py-2" colSpan={7}>
                      Total spent
                    </td>
                    <td className="px-2 py-2 text-right text-rose-600">{inr(summary?.spent)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {proofView && (
        <ProofModal id={proofView.id} kind={proofView.kind} onClose={() => setProofView(null)} />
      )}
      {paymentsFor && data?.expenses?.find((e) => e.id === paymentsFor) && (
        <PaymentsModal
          expense={data.expenses.find((e) => e.id === paymentsFor)}
          bucketNames={data.bucketNames || []}
          onChanged={load}
          onClose={() => setPaymentsFor(null)}
        />
      )}
    </div>
  );
}
