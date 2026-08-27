import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../lib/api.js';

// Event-day "Reveal" slideshow. Admin-only (guarded by the route). Plays all
// collected photos & videos full-screen — connect the phone/laptop to a TV or
// projector (HDMI / Chromecast / AirPlay / screen-mirror) to show the room.
//
// Filters: All · Reunion memories · Guess Who (with tap-to-reveal answer).
export default function RevealPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('public'); // 'all' | 'public' | 'guesswho'
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const timerRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/gallery/all')
      .then((r) => setItems(r.data?.items || []))
      .catch((e) => setError(apiError(e, 'Could not load the gallery')))
      .finally(() => setLoading(false));
  }, []);

  // Filtered + optionally shuffled list. Shuffle is stable per toggle via seed.
  const list = useMemo(() => {
    let arr = items;
    if (filter !== 'all') arr = items.filter((i) => (i.category || 'public') === filter);
    if (shuffle) arr = [...arr].sort(() => Math.random() - 0.5);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, shuffle]);

  const current = list[index] || null;

  // Keep index valid when the list changes.
  useEffect(() => {
    setIndex(0);
    setRevealed(false);
  }, [filter, shuffle]);

  const next = useCallback(() => {
    setRevealed(false);
    setIndex((i) => (list.length ? (i + 1) % list.length : 0));
  }, [list.length]);

  const prev = useCallback(() => {
    setRevealed(false);
    setIndex((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
  }, [list.length]);

  // Auto-advance: images after 6s; videos advance when they finish (handled by
  // the <video onEnded>). Guess Who images don't auto-advance so the host can
  // reveal at their own pace.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!playing || !current) return;
    const isGuess = (current.category || 'public') === 'guesswho';
    if (current.type === 'image' && !isGuess) {
      timerRef.current = setTimeout(next, 6000);
    }
    return () => clearTimeout(timerRef.current);
  }, [current, playing, next]);

  // Keyboard controls (handy when driving from a laptop).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const goFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
        <div className="flex items-center gap-1">
          {[
            ['public', '📸 Memories'],
            ['guesswho', '🤔 Guess Who'],
            ['all', '🎞️ All'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-full px-3 py-1 font-semibold ${
                filter === val ? 'bg-brand-400 text-ink-950' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50">
            {list.length ? `${index + 1} / ${list.length}` : '0'}
          </span>
          <button onClick={goFullscreen} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" title="Fullscreen">
            ⛶
          </button>
          <Link to="/admin" className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
            ✕ Exit
          </Link>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : error ? (
          <div className="text-rose-300">{error}</div>
        ) : !current ? (
          <div className="text-center text-white/60">
            <div className="text-2xl">Nothing here yet</div>
            <div className="mt-1 text-sm">No {filter === 'guesswho' ? 'Guess Who' : ''} items collected.</div>
          </div>
        ) : current.type === 'video' ? (
          <video
            key={current.id}
            src={current.url}
            className="max-h-full max-w-full"
            autoPlay
            controls
            onEnded={() => playing && next()}
          />
        ) : (
          <img key={current.id} src={current.url} alt="" className="max-h-full max-w-full object-contain" />
        )}

        {/* Tap zones for prev/next on touch screens */}
        {current && (
          <>
            <button onClick={prev} className="absolute inset-y-0 left-0 w-1/4" aria-label="Previous" />
            <button onClick={next} className="absolute inset-y-0 right-0 w-1/4" aria-label="Next" />
          </>
        )}

        {/* Guess Who caption / reveal */}
        {current && (current.category || 'public') === 'guesswho' && (
          <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-2">
            {revealed ? (
              <div className="rounded-2xl bg-black/70 px-5 py-3 text-center">
                <div className="text-2xl font-extrabold text-brand-300">
                  {current.guessAnswer || 'No answer given'}
                </div>
                {current.uploaderName && (
                  <div className="text-sm text-white/60">shared by {current.uploaderName}</div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="rounded-full bg-brand-400 px-6 py-3 text-lg font-extrabold text-ink-950 shadow"
              >
                👀 Reveal answer
              </button>
            )}
          </div>
        )}

        {/* Uploader caption for normal memories */}
        {current && (current.category || 'public') !== 'guesswho' && current.uploaderName && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm">
            shared by {current.uploaderName}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-3">
        <button onClick={prev} className="rounded-full bg-white/10 px-4 py-2 text-lg hover:bg-white/20">⏮</button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full bg-brand-400 px-6 py-2 text-lg font-bold text-ink-950"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={next} className="rounded-full bg-white/10 px-4 py-2 text-lg hover:bg-white/20">⏭</button>
        <button
          onClick={() => setShuffle((s) => !s)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            shuffle ? 'bg-brand-400 text-ink-950' : 'bg-white/10 hover:bg-white/20'
          }`}
          title="Shuffle"
        >
          🔀 Shuffle
        </button>
      </div>
    </div>
  );
}
