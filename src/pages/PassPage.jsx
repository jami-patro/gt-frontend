import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Volunteer check-in screen. A member's QR encodes /pass/<token>; scanning it
// with a phone camera opens this page. Marking requires an organizer (admin)
// login, so only staff can tick redemptions off.

function ToggleTile({ label, emoji, done, onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-4 text-left transition disabled:opacity-60 ${
        done
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <span className="text-base font-bold text-slate-800">{label}</span>
      </span>
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {done ? '✓' : ''}
      </span>
    </button>
  );
}

export default function PassPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null); // { name, branch, status, ... }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    api
      .get(`/api/admin/pass/${token}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(apiError(e, 'Could not load this pass')))
      .finally(() => setLoading(false));
  }, [token, authLoading, isAdmin]);

  const update = async (patch, key) => {
    setErr('');
    setBusy(key);
    try {
      const r = await api.patch(`/api/admin/pass/${token}`, patch);
      setData((d) => ({ ...d, status: r.data.status }));
    } catch (e) {
      setErr(apiError(e, 'Could not update'));
    } finally {
      setBusy('');
    }
  };

  if (authLoading || loading) {
    return <div className="grid min-h-[40vh] place-items-center text-slate-400">Loading…</div>;
  }

  // Not an organizer — prompt to log in (or explain, if a member scanned it).
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card space-y-3 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-slate-900">Organizer check-in</h1>
          {user ? (
            <p className="text-sm text-slate-600">
              You're signed in as a member. Only organizers can check people in at the venue.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Please log in with the organizer account to scan and check in guests.
            </p>
          )}
          <Link to="/login" className="btn-primary inline-block">
            Log in as organizer
          </Link>
        </div>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card space-y-2 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-slate-900">Pass not found</h1>
          <p className="text-sm text-slate-600">{err}</p>
          <Link to="/admin" className="btn bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            Back to admin
          </Link>
        </div>
      </div>
    );
  }

  const s = data?.status || {};
  const isPaid = data?.paymentStatus === 'paid';

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-1 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-500">
          Event Pass
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{data?.name}</h1>
        <div className="text-sm text-slate-500">
          {[data?.branch, data?.rollNumber].filter(Boolean).join(' · ') || '—'}
        </div>
        {!isPaid && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Heads up: this member is not marked <strong>paid</strong> in the system.
          </div>
        )}
      </div>

      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      <div className="space-y-3">
        <ToggleTile
          label="Check in"
          emoji="✅"
          done={s.checkedIn}
          busy={busy === 'checkedIn'}
          onClick={() => update({ checkedIn: !s.checkedIn }, 'checkedIn')}
        />
        <ToggleTile
          label="T-shirt collected"
          emoji="👕"
          done={s.tshirt}
          busy={busy === 'tshirt'}
          onClick={() => update({ tshirt: !s.tshirt }, 'tshirt')}
        />
        <ToggleTile
          label="Souvenir collected"
          emoji="🎁"
          done={s.souvenir}
          busy={busy === 'souvenir'}
          onClick={() => update({ souvenir: !s.souvenir }, 'souvenir')}
        />

        {/* Drinks — running count, capped at 2 */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              <span className="text-2xl">🥤</span>
              <span className="text-base font-bold text-slate-800">Drinks</span>
            </span>
            <span className="text-sm font-semibold text-slate-500">{s.drinks || 0} / 2 used</span>
          </div>
          <div className="mt-3 flex gap-2">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy === 'drinks'}
                onClick={() => update({ drinks: n }, 'drinks')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold ring-1 transition disabled:opacity-60 ${
                  (s.drinks || 0) === n
                    ? 'bg-brand-500 text-white ring-brand-500'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Link
        to="/admin"
        className="block text-center text-sm font-semibold text-slate-400 hover:text-slate-600"
      >
        ← Back to admin
      </Link>
    </div>
  );
}
