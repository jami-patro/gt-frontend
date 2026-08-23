import { useEffect, useState } from 'react';
import { api, apiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { compressImage } from '../lib/image.js';

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
    accommodationNeeded: false,
    accommodationType: 'single',
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
            accommodationNeeded: Boolean(x.accommodationNeeded),
            accommodationType: x.accommodationType || 'single',
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
        accommodationType: form.accommodationNeeded ? form.accommodationType : null,
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

        {/* Accommodation help (for out-of-town batchmates) */}
        <div>
          <label className="label">Need accommodation help in Bhubaneswar?</label>
          <div className="flex gap-2">
            <OptionButton
              tone="emerald"
              active={form.accommodationNeeded === true}
              onClick={() => setForm({ ...form, accommodationNeeded: true })}
            >
              Yes, please
            </OptionButton>
            <OptionButton
              tone="rose"
              active={form.accommodationNeeded === false}
              onClick={() => setForm({ ...form, accommodationNeeded: false })}
            >
              No, I'm sorted
            </OptionButton>
          </div>
          {form.accommodationNeeded && (
            <div className="mt-3">
              <label className="label">Room type</label>
              <div className="flex gap-2">
                <OptionButton
                  tone="emerald"
                  active={form.accommodationType === 'single'}
                  onClick={() => setForm({ ...form, accommodationType: 'single' })}
                >
                  🧍 Single person
                </OptionButton>
                <OptionButton
                  tone="emerald"
                  active={form.accommodationType === 'family'}
                  onClick={() => setForm({ ...form, accommodationType: 'family' })}
                >
                  👨‍👩‍👧 Family room
                </OptionButton>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                We'll try to help arrange a stay. The organizers will reach out with options.
              </p>
            </div>
          )}
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

      <ContributionSection userName={user?.name} />
    </div>
  );
}

const STATUS_UI = {
  paid: { label: 'Paid ✓', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  pending: { label: 'Under review', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  rejected: { label: 'Needs re-upload', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  not_paid: { label: 'Not paid', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function ContributionSection({ userName }) {
  const [cfg, setCfg] = useState(null); // { enabled, amount, note, methods }
  const [status, setStatus] = useState(null); // { paymentStatus, ... }
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [txnId, setTxnId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [zoomQr, setZoomQr] = useState(null); // { src, label } for the enlarge popup

  useEffect(() => {
    api.get('/api/public/payment').then((r) => setCfg(r.data)).catch(() => setCfg({ enabled: false }));
    api.get('/api/rsvp/payment').then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (userName && !note) setNote(userName);
  }, [userName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to show until at least one payment method is configured.
  if (!cfg || !cfg.configured) return null;

  // Configured but not open yet — show a greyed-out "coming soon" preview.
  if (!cfg.ready) {
    const amountLabel =
      cfg.amount > 0 ? `₹${Number(cfg.amount).toLocaleString('en-IN')}` : 'Amount TBD';
    return (
      <div className="card space-y-3 opacity-90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Contribution</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            Opens soon
          </span>
        </div>
        <p className="text-sm text-slate-600">{cfg.comingSoonNote}</p>
        <div className="text-sm text-slate-700">
          Suggested amount: <span className="font-bold text-slate-900">{amountLabel}</span>
        </div>
        {/* Greyed-out preview of the payment options so people know what's coming */}
        <div className="pointer-events-none grid grid-cols-1 gap-3 opacity-40 grayscale sm:grid-cols-2">
          {(cfg.methods || []).map((m, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 text-center">
              <div className="text-sm font-semibold text-slate-800">{m.label || 'UPI'}</div>
              {m.qr && (
                <img
                  src={m.qr}
                  alt={`${m.label} QR`}
                  className="mx-auto my-2 h-40 w-40 rounded-lg object-contain"
                />
              )}
              {m.upiId && <div className="break-all text-xs text-slate-500">{m.upiId}</div>}
              {m.phone && <div className="text-xs text-slate-400">📞 {m.phone}</div>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          You'll be able to pay and upload your confirmation here once contributions open.
        </p>
      </div>
    );
  }

  const st = status?.paymentStatus || 'not_paid';
  const ui = STATUS_UI[st] || STATUS_UI.not_paid;
  const amountLabel = cfg.amount > 0 ? `₹${Number(cfg.amount).toLocaleString('en-IN')}` : 'Amount TBD';

  const submit = async () => {
    setErr('');
    // A reference note is always required so the admin can reconcile the
    // payment. A screenshot is OPTIONAL — some UPI apps only allow "Share
    // receipt" (not a screenshot), and some formats (e.g. HEIC) won't load
    // in the browser canvas for compression.
    if (!file && !txnId.trim()) {
      setErr('Attach a payment screenshot or enter the transaction / UTR id.');
      return;
    }
    if (!note.trim()) {
      setErr('Please add a reference note (who paid / UPI name).');
      return;
    }
    setBusy(true);
    try {
      let image;
      if (file) {
        try {
          image = await compressImage(file, { maxDim: 1000, quality: 0.7 });
        } catch {
          setErr("Couldn't read that image. Try a different screenshot, or enter the transaction id instead.");
          setBusy(false);
          return;
        }
      }
      const r = await api.put('/api/rsvp/payment-proof', {
        image,
        note: note.trim(),
        transactionId: txnId.trim() || undefined,
      });
      setStatus(r.data);
      setDone(true);
      setFile(null);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      setErr(apiError(e, 'Could not submit your payment details'));
    } finally {
      setBusy(false);
    }
  };

  const showUploader = st === 'not_paid' || st === 'rejected';

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Contribution</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ui.cls}`}>{ui.label}</span>
      </div>

      {cfg.note && <p className="text-sm text-slate-600">{cfg.note}</p>}
      <div className="text-sm text-slate-700">
        Suggested amount: <span className="font-bold text-slate-900">{amountLabel}</span>
      </div>

      {/* Paid — nothing more to do */}
      {st === 'paid' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Your contribution is confirmed. Thank you! 🎉
        </div>
      )}

      {/* Pending review */}
      {st === 'pending' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Thanks! Your payment proof is <strong>under review</strong>. The organizers will confirm it shortly.
        </div>
      )}

      {/* Rejected — show reason + allow re-upload */}
      {st === 'rejected' && status?.paymentRejectReason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Your proof needs another look: <strong>{status.paymentRejectReason}</strong>. Please re-upload below.
        </div>
      )}

      {/* Payment methods + uploader */}
      {showUploader && (
        <>
          <p className="text-sm font-medium text-slate-700">
            Pay using any one option below, then upload the confirmation.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cfg.methods.map((m, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="text-center text-sm font-bold text-slate-800">{m.label || 'UPI'}</div>
                {m.payeeName && (
                  <div className="text-center text-xs text-slate-400">{m.payeeName}</div>
                )}

                {/* Option 1 — pay in one tap (opens the UPI app on this phone) */}
                {m.upiId && (
                  <div className="mt-3">
                    <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Option 1 · Pay in one tap
                    </div>
                    <a
                      href={`upi://pay?pa=${encodeURIComponent(m.upiId)}&pn=${encodeURIComponent(
                        m.payeeName || m.label || 'OEC Reunion',
                      )}${cfg.amount > 0 ? `&am=${cfg.amount}` : ''}&cu=INR&tn=${encodeURIComponent(
                        'OEC Silver Jubilee Reunion Contribution',
                      )}`}
                      className="mt-2 block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      📲 Pay {amountLabel} now
                    </a>
                    <p className="mt-1 text-center text-[11px] text-slate-400">
                      Opens your UPI app (GPay / PhonePe / Paytm) with details pre-filled. Best on mobile.
                    </p>
                  </div>
                )}

                {/* Option 2 — scan the QR */}
                {m.qr && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Option 2 · Scan QR
                    </div>
                    <button
                      type="button"
                      onClick={() => setZoomQr({ src: m.qr, label: m.label })}
                      className="mx-auto my-2 block rounded-lg ring-1 ring-slate-200 transition hover:ring-slate-400"
                      title="Tap to enlarge"
                    >
                      <img
                        src={m.qr}
                        alt={`${m.label} QR`}
                        className="h-48 w-48 rounded-lg object-contain"
                      />
                    </button>
                    <p className="text-center text-[11px] text-slate-400">
                      Tap the QR to enlarge, then scan with any UPI app (GPay / PhonePe / Paytm)
                    </p>
                  </div>
                )}

                {/* Option 3 — pay to number / UPI id directly */}
                {(m.phone || m.upiId) && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Option 3 · Pay directly
                    </div>
                    {m.phone && (
                      <div className="mt-1 text-center text-sm text-slate-700">
                        To number{' '}
                        <a
                          href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}
                          className="font-bold text-blue-600"
                        >
                          {m.phone}
                        </a>{' '}
                        <span className="text-xs text-slate-400">on GPay / PhonePe</span>
                      </div>
                    )}
                    {m.upiId && (
                      <div className="mt-1 text-center text-sm text-slate-700">
                        UPI ID{' '}
                        <span className="break-all font-semibold text-slate-800">{m.upiId}</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label className="label">
              Reference note <span className="text-rose-500">*</span>
            </label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid from my wife Anita's GPay / sent via my brother's number"
            />
            <p className="text-xs text-slate-400">
              Tell us <strong>whose account the money came from</strong> so we can match it — e.g.
              "Paid from my own PhonePe", "Sent from my wife Anita's GPay", or "My friend Ravi paid
              on my behalf". This helps the organizers cross-check who has contributed.
            </p>
            <label className="label">Payment screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />

            <div className="flex items-center gap-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-100" />
              or
              <span className="h-px flex-1 bg-slate-100" />
            </div>

            <label className="label">Transaction / UTR id</label>
            <input
              className="input"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              placeholder="e.g. UPI ref / UTR number from your payment app"
            />
            <p className="text-xs text-slate-400">
              Provide <strong>either</strong> a screenshot <strong>or</strong> the transaction id —
              whichever is easier. Both are welcome.
            </p>

            {err && <div className="text-sm text-rose-600">{err}</div>}
            {done && <div className="text-sm font-medium text-emerald-600">Submitted — under review ✓</div>}
            {/* Require a screenshot OR a transaction id (plus the note) before
                the submit button is enabled — no more empty submissions. */}
            <button
              onClick={submit}
              disabled={busy || (!file && !txnId.trim()) || !note.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Submitting…' : 'Submit payment proof'}
            </button>
            {(!file && !txnId.trim()) && (
              <p className="text-xs font-medium text-rose-500">
                Add a payment screenshot or the transaction / UTR id to submit.
              </p>
            )}
            <p className="text-xs text-slate-400">
              If you paid from someone else's account, mention whose in the note so we can match it.
            </p>
          </div>
        </>
      )}

      {/* Enlarged QR popup */}
      {zoomQr && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setZoomQr(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{zoomQr.label}</h3>
              <button onClick={() => setZoomQr(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <img src={zoomQr.src} alt={`${zoomQr.label} QR`} className="w-full rounded-lg" />
            <p className="mt-2 text-xs text-slate-500">Scan with any UPI app to pay</p>
          </div>
        </div>
      )}
    </div>
  );
}
