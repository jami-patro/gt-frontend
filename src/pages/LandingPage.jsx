import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useAuth } from '../context/AuthContext.jsx';
import Gallery from '../components/Gallery.jsx';

// Event details — placeholder values, update as plans firm up.
const EVENT_DETAILS = {
  venue: 'Bhubaneswar',
  time: '5:00 PM – 10:00 PM (TBD)',
  contactName: 'Mrunal Jena',
};

function CountBox({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur">
      <div className="text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-white/50">{label}</div>
    </div>
  );
}

function StatCard({ value, label, accent }) {
  return (
    <div className="card text-center transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [event, setEvent] = useState({ name: 'Batch Reunion', date: '2026-12-19' });
  const [stats, setStats] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const countdown = useCountdown(event.date);

  useEffect(() => {
    // Event details rarely change — fetch once. Guard against non-JSON replies.
    api
      .get('/api/public/event')
      .then((r) => {
        if (r.data && typeof r.data === 'object' && r.data.name) setEvent(r.data);
      })
      .catch(() => {});

    // Live data — fetch now, then refresh every 15s so counts stay current.
    // Guard against non-JSON / misshaped responses so a bad reply can never
    // crash the page (e.g. if the API URL is misconfigured).
    const refresh = () => {
      api
        .get('/api/public/stats')
        .then((r) => {
          if (r.data && typeof r.data === 'object' && r.data.food) setStats(r.data);
        })
        .catch(() => {});
      api
        .get('/api/public/attendees')
        .then((r) => setAttendees(Array.isArray(r.data?.attendees) ? r.data.attendees : []))
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const prettyDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-10">
      {/* Hero — dark elegant panel with a soft yellow glow */}
      <section className="relative overflow-hidden rounded-[28px] bg-ink-950 p-6 text-white shadow-card sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-400/50 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-brand-500/20 blur-[90px]" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            Silver Jubilee · 25 Years
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            {event.name.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-brand-400">{event.name.split(' ').slice(-1)}</span>
          </h1>
          <p className="mt-4 text-slate-400">{prettyDate}</p>

          <div className="mt-8 grid max-w-md grid-cols-4 gap-2 sm:gap-3">
            <CountBox value={countdown.days} label="Days" />
            <CountBox value={countdown.hours} label="Hrs" />
            <CountBox value={countdown.minutes} label="Min" />
            <CountBox value={countdown.seconds} label="Sec" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link to="/dashboard" className="btn-accent">
                Update my RSVP
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-accent">
                  Cast your vote
                </Link>
                <Link
                  to="/login"
                  className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  I already registered
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Event details */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Event details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Venue</div>
            <div className="mt-1 font-semibold text-slate-800">📍 {EVENT_DETAILS.venue}</div>
            <div className="mt-0.5 text-xs text-slate-400">Exact venue to be announced</div>
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time</div>
            <div className="mt-1 font-semibold text-slate-800">🕔 {EVENT_DETAILS.time}</div>
            <div className="mt-0.5 text-xs text-slate-400">{prettyDate}</div>
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</div>
            <div className="mt-1 font-semibold text-slate-800">📞 {EVENT_DETAILS.contactName}</div>
            <div className="mt-0.5 text-xs text-slate-400">For any queries</div>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Live count</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={stats?.attending ?? '—'} label="Attending" accent="text-emerald-600" />
          <StatCard value={stats?.maybe ?? '—'} label="Maybe" accent="text-amber-500" />
          <StatCard value={stats?.headcount ?? '—'} label="Total headcount" accent="text-slate-900" />
          <StatCard value={stats?.registered ?? '—'} label="Registered" accent="text-slate-900" />
        </div>

        {stats?.food && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-lg">
            <StatCard value={stats.food.veg} label="Veg" accent="text-green-600" />
            <StatCard value={stats.food.nonVeg} label="Non-veg" accent="text-rose-600" />
            <StatCard value={stats.pending ?? '—'} label="Pending approval" accent="text-amber-600" />
          </div>
        )}
      </section>

      {/* Photo gallery (renders only when photos are added) */}
      <Gallery />

      {/* Attendee wall */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">
          Who's coming {attendees.length > 0 && `(${attendees.length})`}
        </h2>
        {attendees.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">
            No votes yet — be the first to RSVP!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attendees.map((a, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  a.attendance === 'yes'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {a.name}
                {a.branch && <span className="text-xs opacity-60">· {a.branch}</span>}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
