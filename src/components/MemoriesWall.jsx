import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api, { apiError } from '../lib/api.js';

// In-site photo & video collection backed by Cloudinary. Guests pick files,
// see a local PREVIEW to confirm, then upload. Uploaded media is NOT shown
// publicly — it's kept hidden as a surprise for the event day (organizers see
// everything via an admin reveal view). We only show an encouraging counter.
//
// Props:
//   galleryUrl  — optional external link (fallback when Cloudinary isn't set up)
//   compact     — tighter layout for the dashboard card
export default function MemoriesWall({ galleryUrl, compact = false }) {
  const [cfg, setCfg] = useState(null); // { cloudName, uploadPreset, enabled }
  const [count, setCount] = useState(0); // how many collected so far (no images)
  const [pending, setPending] = useState([]); // [{ file, previewUrl, isVideo }]
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('gt_gallery_name') || '');
  const [category, setCategory] = useState('public'); // 'public' | 'guesswho'
  const [guessAnswer, setGuessAnswer] = useState('');
  const loggedIn = Boolean(localStorage.getItem('gt_token'));
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/api/public/event')
      .then((r) => alive && setCfg(r.data?.cloudinary || null))
      .catch(() => {});
    refreshCount();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshCount() {
    try {
      const r = await api.get('/api/gallery');
      setCount(r.data?.count || 0);
    } catch {
      /* ignore */
    }
  }

  // Selecting files just stages local previews — nothing uploads yet.
  function onPick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    setNotice('');
    const staged = [];
    for (const f of files) {
      if (f.size > 100 * 1024 * 1024) {
        setError(`"${f.name}" is over 100MB and was skipped. Try a shorter clip.`);
        continue;
      }
      staged.push({ file: f, previewUrl: URL.createObjectURL(f), isVideo: f.type.startsWith('video') });
    }
    setPending((prev) => [...prev, ...staged]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function removePending(idx) {
    setPending((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // Upload one file to Cloudinary via XHR (progress), then record it in our DB.
  function uploadOne(file) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', cfg.uploadPreset);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = async () => {
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error('Upload failed'));
        try {
          const res = JSON.parse(xhr.responseText);
          await api.post('/api/gallery', {
            url: res.secure_url,
            publicId: res.public_id,
            resourceType: res.resource_type,
            format: res.format,
            bytes: res.bytes,
            width: res.width,
            height: res.height,
            uploaderName: loggedIn ? undefined : name || undefined,
            category,
            guessAnswer: category === 'guesswho' ? guessAnswer || undefined : undefined,
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(form);
    });
  }

  async function confirmUpload() {
    if (pending.length === 0) return;
    setError('');
    setNotice('');
    if (!loggedIn && !name.trim()) {
      setError('Please add your name first so we know who shared these.');
      return;
    }
    if (!loggedIn) localStorage.setItem('gt_gallery_name', name.trim());
    setUploading(true);
    try {
      for (const p of pending) {
        setProgress(0);
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(p.file);
      }
      const n = pending.length;
      // Clear staged previews.
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      setGuessAnswer('');
      await refreshCount();
      setNotice(
        `🎁 Thanks! ${n} ${n === 1 ? 'memory' : 'memories'} saved — they'll be revealed on event day. Nothing is shown here to keep it a surprise!`,
      );
    } catch (err) {
      setError(apiError(err, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const enabled = cfg?.enabled;

  return (
    <section
      className={
        compact
          ? 'rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm'
          : 'overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-white p-6 sm:p-8'
      }
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Memories</div>
      <h2 className={compact ? 'mt-1 text-2xl font-extrabold text-ink-950' : 'mt-2 text-2xl font-extrabold text-ink-950 sm:text-3xl'}>
        📸 Share your photos &amp; videos
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Add photos or short clips from your phone or laptop. They stay a{' '}
        <span className="font-semibold text-ink-950">surprise</span> — we collect them now and
        reveal everything on the reunion day! 🎉
      </p>

      {/* Scan-to-upload QR — for printing/showing at the venue. */}
      {!compact && (
        <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3">
          <QRCodeSVG value={window.location.origin} size={96} level="M" includeMargin />
          <div className="text-sm">
            <div className="font-bold text-ink-950">📷 Scan to upload</div>
            <div className="text-xs text-slate-500">
              Point your phone camera here to open this page and add your photos.
            </div>
          </div>
        </div>
      )}

      {enabled ? (
        <div className="mt-4 space-y-3">
          {/* Public memory vs Guess Who? — radio choice */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                category === 'public'
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="memory-category"
                value="public"
                checked={category === 'public'}
                onChange={() => setCategory('public')}
                className="mt-1 accent-brand-500"
              />
              <span>
                <span className="block font-bold text-ink-950">📸 Reunion memory</span>
                <span className="block text-xs text-slate-500">Photos &amp; clips for the reveal.</span>
              </span>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                category === 'guesswho'
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="memory-category"
                value="guesswho"
                checked={category === 'guesswho'}
                onChange={() => setCategory('guesswho')}
                className="mt-1 accent-brand-500"
              />
              <span>
                <span className="block font-bold text-ink-950">🤔 Guess Who? photo</span>
                <span className="block text-xs text-slate-500">Old photo for the game.</span>
              </span>
            </label>
          </div>

          {category === 'guesswho' && (
            <input
              className="input max-w-xs"
              placeholder="Who is it? (optional answer for organizers)"
              value={guessAnswer}
              onChange={(e) => setGuessAnswer(e.target.value)}
            />
          )}

          {!loggedIn && (
            <input
              className="input max-w-xs"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          {/* Local previews (before upload) so the guest can confirm. */}
          {pending.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {pending.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {p.isVideo ? (
                    <video src={p.previewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={p.previewUrl} alt="preview" className="h-full w-full object-cover" />
                  )}
                  {p.isVideo && (
                    <span className="absolute inset-0 grid place-items-center bg-black/25 text-2xl text-white">▶</span>
                  )}
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removePending(i)}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={onPick}
              disabled={uploading}
            />
            {pending.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-extrabold text-ink-950 shadow hover:bg-brand-300 disabled:opacity-60"
              >
                📷 Choose photos &amp; videos
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-extrabold text-ink-950 shadow hover:bg-brand-300 disabled:opacity-60"
                >
                  {uploading ? `Uploading… ${progress}%` : `✅ Confirm & upload (${pending.length})`}
                </button>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-semibold text-brand-700 underline"
                  >
                    + add more
                  </button>
                )}
              </>
            )}
            {galleryUrl && /^https?:\/\//.test(galleryUrl) && (
              <a
                href={galleryUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-brand-700 underline"
              >
                or use the shared album
              </a>
            )}
          </div>

          {uploading && (
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-brand-100">
              <div className="h-full bg-brand-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <p className="text-xs text-slate-500">
            Photos and short videos (up to ~100MB) work great. You'll see a preview to confirm
            before sending — after that they're hidden until the big reveal. 🤫
          </p>
        </div>
      ) : galleryUrl && /^https?:\/\//.test(galleryUrl) ? (
        <a
          href={galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-extrabold text-ink-950 shadow hover:bg-brand-300"
        >
          ⬆️ Upload photos &amp; videos
        </a>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Uploads open soon.</p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* Encouraging counter — no images, keeps the surprise. */}
      {count > 0 && (
        <div className="mt-4 rounded-xl bg-brand-100/60 px-4 py-3 text-center text-sm font-semibold text-brand-800">
          🎁 {count} {count === 1 ? 'memory' : 'memories'} collected so far — revealed on event day!
        </div>
      )}
    </section>
  );
}
