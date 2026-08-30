import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api, apiError } from '../lib/api.js';

// Volunteer counter station. Opened from a per-counter QR/link the organizer
// hands out — no login needed. The volunteer scans members' passes.
//   • Single-action counters (check-in / T-shirt / souvenir / drinks) mark
//     their one action automatically on scan.
//   • The all-in-one counter shows all four actions to tap after each scan.

const READER_ID = 'qr-reader';

export default function StationPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null); // { station, label, emoji, multi }
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState('');
  const [result, setResult] = useState(null); // single-mode banner
  const [member, setMember] = useState(null); // multi-mode: { name, status, paid }
  const [actionMsg, setActionMsg] = useState('');
  const [busy, setBusy] = useState('');

  const scannerRef = useRef(null);
  const lockRef = useRef(false);
  const scannedPassRef = useRef('');
  const multi = Boolean(info?.multi);

  useEffect(() => {
    api
      .get(`/api/station/${token}`)
      .then((r) => setInfo(r.data))
      .catch((e) => setFatal(apiError(e, 'Invalid counter link')))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) s.stop().catch(() => {}).finally(() => s.clear?.());
    };
  }, []);

  const resumeScan = () => {
    lockRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      /* ignore */
    }
  };

  const handleDecoded = async (decodedText) => {
    if (lockRef.current) return;
    lockRef.current = true;
    scannedPassRef.current = decodedText;
    try {
      await scannerRef.current?.pause(true);
    } catch {
      /* ignore */
    }
    try {
      const r = await api.post(`/api/station/${token}/scan`, { pass: decodedText });
      if (r.data.multi) {
        // All-in-one: show the member + action buttons; stay paused until
        // the volunteer taps "Next guest".
        setMember(r.data);
        setActionMsg('');
      } else {
        // Single counter: show the result, then auto-resume for the next.
        setResult(r.data);
        setTimeout(resumeScan, 2200);
      }
    } catch (e) {
      setResult({ ok: false, message: apiError(e, 'Scan failed') });
      setTimeout(resumeScan, 2200);
    }
  };

  const startScanning = async () => {
    setCamError('');
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleDecoded,
        () => {},
      );
      setScanning(true);
    } catch {
      setCamError(
        'Could not open the camera. Allow camera access in your browser, or open this link in Chrome/Safari.',
      );
    }
  };

  const markAction = async (action) => {
    setBusy(action);
    setActionMsg('');
    try {
      const r = await api.post(`/api/station/${token}/mark`, {
        pass: scannedPassRef.current,
        action,
      });
      setMember((m) => ({ ...m, status: r.data.status }));
      setActionMsg(r.data.message);
    } catch (e) {
      setActionMsg(apiError(e, 'Could not update'));
    } finally {
      setBusy('');
    }
  };

  const nextGuest = () => {
    setMember(null);
    setActionMsg('');
    resumeScan();
  };

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-slate-400">Loading…</div>;
  }

  if (fatal) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card space-y-2 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-slate-900">Counter link not valid</h1>
          <p className="text-sm text-slate-600">{fatal}</p>
          <p className="text-xs text-slate-400">Ask the organizer for an updated link.</p>
        </div>
      </div>
    );
  }

  const good = result?.ok && !result?.already;
  const warn = result?.ok && result?.already;
  const s = member?.status || {};

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-1 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-500">
          Volunteer counter
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {info.emoji} {info.label}
        </h1>
        <p className="text-sm text-slate-500">Scan each guest's reunion pass QR.</p>
      </div>

      {/* Single-counter result banner */}
      {!multi && result && (
        <div
          className={`rounded-2xl border-2 p-4 text-center ${
            good ? 'border-emerald-500 bg-emerald-50' : warn ? 'border-amber-400 bg-amber-50' : 'border-rose-400 bg-rose-50'
          }`}
        >
          <div className="text-3xl">{good ? '✅' : warn ? '⚠️' : '❌'}</div>
          {result.name && <div className="mt-1 text-lg font-extrabold text-slate-900">{result.name}</div>}
          <div className={`text-sm font-bold ${good ? 'text-emerald-700' : warn ? 'text-amber-700' : 'text-rose-700'}`}>
            {result.message}
          </div>
          {/* At the T-shirt counter, show the size to hand over, big and clear. */}
          {result.name && info?.station === 'tshirt' && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white">
              <span className="text-sm">👕 Size</span>
              <span className="text-2xl font-extrabold">{result.tshirtSize || '—'}</span>
              <span className="text-xs opacity-80">{result.tshirtFit === 'womens' ? "Women's" : "Men's"}</span>
            </div>
          )}
          {result.name && info?.station === 'tshirt' && !result.tshirtSize && (
            <div className="mt-1 text-xs font-semibold text-amber-600">No size on file — ask the guest</div>
          )}
          {result.name && result.paid === false && (
            <div className="mt-1 text-xs font-semibold text-rose-600">Not marked paid in system</div>
          )}
        </div>
      )}

      {/* All-in-one: member card with all four actions */}
      {multi && member && (
        <div className="card space-y-3">
          <div className="text-center">
            <div className="text-lg font-extrabold text-slate-900">{member.name}</div>
            {member.branch && <div className="text-xs text-slate-500">{member.branch}</div>}
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-1.5 text-white">
              <span className="text-xs">👕</span>
              <span className="text-lg font-extrabold">{member.tshirtSize || '—'}</span>
              <span className="text-[11px] opacity-80">{member.tshirtFit === 'womens' ? "Women's" : "Men's"}</span>
            </div>
            {!member.tshirtSize && (
              <div className="mt-1 text-xs font-semibold text-amber-600">No T-shirt size on file</div>
            )}
            {member.paid === false && (
              <div className="mt-1 text-xs font-semibold text-rose-600">Not marked paid in system</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ActionButton label="Check in" emoji="✅" done={s.checkedIn} busy={busy === 'checkin'} onClick={() => markAction('checkin')} />
            <ActionButton label="T-shirt" emoji="👕" done={s.tshirt} busy={busy === 'tshirt'} onClick={() => markAction('tshirt')} />
            <ActionButton label="Souvenir" emoji="🎁" done={s.souvenir} busy={busy === 'souvenir'} onClick={() => markAction('souvenir')} />
            <ActionButton
              label={`Drink (${s.drinks || 0}/2)`}
              emoji="🥤"
              done={(s.drinks || 0) >= 2}
              busy={busy === 'drink'}
              onClick={() => markAction('drink')}
            />
          </div>

          {actionMsg && <div className="text-center text-sm font-semibold text-slate-600">{actionMsg}</div>}

          <button onClick={nextGuest} className="btn-primary w-full">
            ✓ Done — scan next guest
          </button>
        </div>
      )}

      {/* Camera */}
      <div className="card space-y-3" style={{ display: multi && member ? 'none' : 'block' }}>
        <div
          id={READER_ID}
          className="mx-auto w-full overflow-hidden rounded-xl bg-slate-900/5"
          style={{ minHeight: scanning ? 260 : 0 }}
        />
        {!scanning ? (
          <button onClick={startScanning} className="btn-primary w-full">
            📷 Start scanning
          </button>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Point the camera at a guest's pass. It scans automatically.
          </p>
        )}
        {camError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{camError}</div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Keep this page open through your shift. No login needed.
      </p>
    </div>
  );
}

function ActionButton({ label, emoji, done, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-sm font-bold transition disabled:opacity-60 ${
        done ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      {label} {done ? '✓' : ''}
    </button>
  );
}
