import { useState } from 'react';
import { galleryImages } from '../data/gallery.js';

export default function Gallery() {
  const [active, setActive] = useState(null);

  // Nothing to show until photos are added to src/data/gallery.js
  if (!galleryImages || galleryImages.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">Memories</h2>

      {/* Responsive grid: 2 cols mobile, 3 cols tablet, 5 cols desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {galleryImages.map((img, i) => {
          const isPhoto = i <= 1; // First two are campus photos
          
          return (
            <button
              key={i}
              onClick={() => setActive(img)}
              className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
            >
              <img
                src={img.src}
                alt={img.caption || 'College memory'}
                loading="lazy"
                className={`h-full w-full transition duration-300 group-hover:scale-105 ${
                  isPhoto ? 'object-cover' : 'object-contain p-3'
                }`}
              />
              {img.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2 text-left text-xs font-semibold text-white">
                  {img.caption}
                </span>
              )}
            </button>
          );
        })}
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
