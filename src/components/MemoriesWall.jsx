import { useEffect, useRef, useState } from 'react';
import api, { apiError } from '../lib/api.js';

// In-site photo & video sharing backed by Cloudinary. Guests pick files from
// their phone/laptop; each file uploads directly to Cloudinary (unsigned
// preset) and we then record its URL via /api/gallery. No Google account, no
// app install. Falls back to a Drive/Photos link when Cloudinary isn't set up.
//
// Props:
//   galleryUrl  — optional external link (shown as a fallback / extra option)
//   compact     — tighter layout for the dashboard card
export default function MemoriesWall({ galleryUrl, compact = false }) {
  const [cfg, setCfg] = useState(null); // { cloudName, uploadPreset, enabled }
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState(null); // lightbox item
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
    refresh().finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const r = await api.get('/api/gallery', { params: { limit: 200 } });
      setItems(r.data?.items || []);
    } catch {
      /* ignore */
    }
  }

  // Upload one file to Cloudinary via XHR (so we get progress), then record it.
  function uploadOne(file) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', cfg.uploadPreset);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = async () => {
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error('Upload failed'));
        try {
          const res = JSON.parse(xhr.responseText);
          await api.post('/api/gallery', {
            url: res.secure_url,
            publicId: res.public_id,
            resourceType: res.resource_type, // 'image' | 'video'
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

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    setNotice('');
    if (!loggedIn && !name.trim()) {
      setError('Please add your name first so we know who shared these.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (!loggedIn) localStorage.setItem('gt_gallery_name', name.trim());
    setUploading(true);
    try {
      for (const f of files) {
        setProgress(0);
        // Guard against very large uploads (Cloudinary free video ~100MB).
        if (f.size > 100 * 1024 * 1024) {
          setError(`"${f.name}" is over 100MB and was skipped. Try a shorter clip.`);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(f);
      }
      await refresh();
      setNotice(
        category === 'guesswho'
          ? '🤫 Added to the secret "Guess Who?" pile — it won\'t show in the wall.'
          : '✅ Thanks! Your memories are in the wall below.',
      );
    } catch (err) {
      setError(apiError(err, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const enabled = cfg?.enabled;
  const HeadingTag = compact ? 'h2' : 'h2';

  return (
    <section
      className={
        compact
          ? 'rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm'
          : 'overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-white p-6 sm:p-8'
      }
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Memories</div>
      <HeadingTag className={compact ? 'mt-1 text-2xl font-extrabold text-ink-950' : 'mt-2 text-2xl font-extrabold text-ink-950 sm:text-3xl'}>
        📸 Share your photos &amp; videos
      </HeadingTag>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Pick photos or short clips straight from your phone or laptop — they upload right here, no
        app or Google account needed.
      </p>

      {/* Uploader */}
      {enabled ? (
        <div className="mt-4 space-y-3">
          {/* Public memory vs Guess Who? */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setCategory('public')}
              className={`flex-1 rounded-xl border px-3 py-2 text-left text-sm transition ${
                category === 'public'
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="font-bold text-ink-950">📸 Public memory</div>
              <div className="text-xs text-slate-500">Shows in the shared wall below.</div>
            </button>
            <button
              type="button"
              onClick={() => setCategory('guesswho')}
              className={`flex-1 rounded-xl border px-3 py-2 text-left text-sm transition ${
                category === 'guesswho'
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="font-bold text-ink-950">🤔 Guess Who? (secret)</div>
              <div className="text-xs text-slate-500">
                Old photo for the game — hidden from the wall.
              </div>
            </button>
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
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={onFiles}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-extrabold text-ink-950 shadow hover:bg-brand-300 disabled:opacity-60"
            >
              {uploading ? `Uploading… ${progress}%` : '⬆️ Upload photos & videos'}
            </button>
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
            Photos and short videos (up to ~100MB / a few seconds) work great. You can pick several
            at once.
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

      {/* Wall */}
      {!loading && items.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold text-slate-700">
            {items.length} shared {items.length === 1 ? 'memory' : 'memories'}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white"
                title={it.uploaderName ? `Shared by ${it.uploaderName}` : ''}
              >
                <img
                  src={it.thumbUrl}
                  alt={it.uploaderName || 'Shared memory'}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                {it.type === 'video' && (
                  <span className="absolute inset-0 grid place-items-center bg-black/25 text-2xl text-white">
                    ▶
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {active.type === 'video' ? (
              <video src={active.url} controls autoPlay className="max-h-[80vh] w-auto rounded-lg" />
            ) : (
              <img src={active.url} alt="" className="max-h-[80vh] w-auto rounded-lg bg-white" />
            )}
            {active.uploaderName && (
              <p className="mt-2 text-center text-sm text-white/80">Shared by {active.uploaderName}</p>
            )}
          </div>
          <button
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
