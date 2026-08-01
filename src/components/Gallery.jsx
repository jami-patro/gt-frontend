import { useState } from 'react';
import { galleryImages } from '../data/gallery.js';

export default function Gallery() {
  const [active, setActive] = useState(null);

  // Nothing to show until photos are added to src/data/gallery.js
  if (!galleryImages || galleryImages.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Memories</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {galleryImages.map((img, i) => (
          <button
            key={i}
            onClick={() => setActive(img)}
            className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {/* object-contain keeps logos/photos fully visible and centered */}
            <img
              src={img.src}
              alt={img.caption || 'College memory'}
              loading="lazy"
              className="max-h-full max-w-full object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
            />
            {img.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-left text-xs font-medium text-white">
                {img.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={active.src}
              alt={active.caption || 'College memory'}
              className="max-h-[80vh] w-auto rounded-lg bg-white"
            />
            {active.caption && (
              <p className="mt-2 text-center text-sm text-white/80">{active.caption}</p>
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
