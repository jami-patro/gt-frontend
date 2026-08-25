import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useAuth } from '../context/AuthContext.jsx';
import Gallery from '../components/Gallery.jsx';

// Fallback event details if the API hasn't loaded yet. The backend
// (/api/public/event) is the source of truth and overrides these.
const EVENT_DETAILS_FALLBACK = {
  venue: 'Bhubaneswar',
  time: '5:00 PM – 10:00 PM (TBD)',
  contacts: [{ name: 'Mrunal Jena', phone: '' }],
  locationUrl: '',
  // Programme / running order for the day. The backend (/api/public/event)
  // is the source of truth and overrides this.
  schedule: [
    { time: '1:00 – 2:00 PM', title: '🍽️ Welcome Drinks, Lunch, Registration & T-Shirt Distribution' },
    { time: '2:00 – 2:45 PM', title: '🎤 Welcome & Ice Breaker' },
    { time: '2:45 – 3:30 PM', title: '📸 Guess Who? — Old Photo Slider' },
    { time: '3:30 – 4:15 PM', title: '😂 Fun Games' },
    { time: '4:15 – 5:00 PM', title: '❤️ Old Memories Session' },
    { time: '5:00 – 5:30 PM', title: '☕ Tea & Snacks' },
    { time: '5:30 – 6:15 PM', title: '🎭 Cultural & Fun Performances' },
    { time: '7:00 – 7:45 PM', title: '🏅 Awards, Souvenirs & Reunion Moments' },
    { time: '7:45 – 8:30 PM', title: '🎤 Open Mic & Friendship Time' },
    { time: '8:30 PM onwards', title: '💃 Music, Dance & Grand Closing' },
  ],
};

// Parse a `YYYY-MM-DD` string as a LOCAL date (midnight in the viewer's own
// timezone). `new Date('2026-12-19')` would parse as UTC midnight, which then
// rolls back a day for anyone west of UTC (e.g. the US) when formatted with
// toLocaleDateString — showing "Dec 18" instead of "Dec 19". Building the date
// from explicit parts keeps it stable in every timezone. Falls back to the
// native parser for any other date shape the API might send.
function parseEventDate(value) {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
  }
  return new Date(value);
}

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

function ProgrammeTimeline({ schedule }) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Programme for the day</h2>
      <div className="card">
        <ol className="relative space-y-6 border-l-2 border-brand-200 pl-6">
          {schedule.map((item, i) => (
            <li key={i} className="relative">
              {/* Timeline dot */}
              <span className="absolute -left-[31px] top-1 grid h-4 w-4 place-items-center rounded-full bg-brand-400 ring-4 ring-brand-100" />
              {item.time && (
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {item.time}
                </div>
              )}
              <div className="mt-0.5 font-semibold text-slate-900">{item.title}</div>
              {item.description && (
                <div className="mt-0.5 text-sm text-slate-500">{item.description}</div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
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

function AttendeeWall({ attendees, branchFilter, setBranchFilter, attendFilter, setAttendFilter }) {
  // "Paid only" / "Needs stay" are independent toggles layered on top of the
  // attendance filter. Kept local since they don't need to survive a remount.
  const [paidOnly, setPaidOnly] = useState(false);
  const [stayOnly, setStayOnly] = useState(false);

  // Attendance filter is applied first so the branch chip counts always
  // reflect the currently-selected attendance group.
  const byAttendance =
    attendFilter === 'all' ? attendees : attendees.filter((a) => a.attendance === attendFilter);

  // Chip counts for the current attendance group.
  const paidCount = byAttendance.filter((a) => a.paid).length;
  const stayCount = byAttendance.filter((a) => a.needsStay).length;

  // Layer the paid-only and needs-stay toggles on top before computing branch
  // chips so the branch counts stay in sync with what's actually shown.
  const byPaid = paidOnly ? byAttendance.filter((a) => a.paid) : byAttendance;
  const byStay = stayOnly ? byPaid.filter((a) => a.needsStay) : byPaid;

  // Build the branch chip list from whoever matches the active filters.
  const branchCounts = byStay.reduce((acc, a) => {
    const b = a.branch || 'Other';
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});
  const branches = Object.keys(branchCounts).sort();

  // Attendance counts come from the full list so the tallies never change
  // as you click around.
  const yesCount = attendees.filter((a) => a.attendance === 'yes').length;
  const maybeCount = attendees.filter((a) => a.attendance === 'maybe').length;

  // Guard against a stale branch selection that isn't present in the current
  // attendance subset (e.g. you picked a branch under "All", then switched to
  // "Maybe" where nobody from that branch voted). Fall back to showing all.
  const effectiveBranch = branchFilter !== 'all' && !branchCounts[branchFilter] ? 'all' : branchFilter;

  const filtered =
    effectiveBranch === 'all'
      ? byStay
      : byStay.filter((a) => (a.branch || 'Other') === effectiveBranch);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Who's coming {attendees.length > 0 && `(${attendees.length})`}
        </h2>
      </div>

      {attendees.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          No votes yet — be the first to RSVP!
        </div>
      ) : (
        <>
          {/* Attendance filter */}
          <div className="mb-2 flex flex-wrap gap-2">
            <FilterChip
              label="All"
              count={attendees.length}
              active={attendFilter === 'all'}
              onClick={() => {
                setAttendFilter('all');
                setBranchFilter('all');
              }}
            />
            <FilterChip
              label="Going"
              count={yesCount}
              active={attendFilter === 'yes'}
              onClick={() => {
                setAttendFilter('yes');
                setBranchFilter('all');
              }}
            />
            <FilterChip
              label="Maybe"
              count={maybeCount}
              active={attendFilter === 'maybe'}
              onClick={() => {
                setAttendFilter('maybe');
                setBranchFilter('all');
              }}
            />
            {/* Independent "contributed" toggle — positive-only, never shows
                who hasn't paid. */}
            <FilterChip
              label="💚 Paid"
              count={paidCount}
              active={paidOnly}
              onClick={() => {
                setPaidOnly((v) => !v);
                setBranchFilter('all');
              }}
            />
            {/* Needs accommodation help (travelling in). */}
            <FilterChip
              label="🏨 Needs stay"
              count={stayCount}
              active={stayOnly}
              onClick={() => {
                setStayOnly((v) => !v);
                setBranchFilter('all');
              }}
            />
          </div>

          {/* Smart branch filter */}
          {branches.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterChip
                label="All branches"
                count={byAttendance.length}
                active={effectiveBranch === 'all'}
                onClick={() => setBranchFilter('all')}
              />
              {branches.map((b) => (
                <FilterChip
                  key={b}
                  label={b}
                  count={branchCounts[b]}
                  active={effectiveBranch === b}
                  onClick={() => setBranchFilter(b)}
                />
              ))}
            </div>
          )}

          {/* Names — capped height so the page never grows endlessly; scrolls inside */}
          <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                No one here yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filtered.map((a, i) => (
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
                    {a.paid && (
                      <span
                        className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                        title="Contributed"
                      >
                        ✓ Paid
                      </span>
                    )}
                    {a.needsStay && (
                      <span
                        className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700"
                        title="Needs accommodation help"
                      >
                        🏨 Stay
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ContributorsWall({ contributors, count }) {
  // Only renders when at least one person has paid. This is a positive
  // "thank you" wall — it never shows who hasn't paid.
  if (count === 0) return null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Contributors</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          {count} paid 🎉
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
        <div className="flex flex-wrap gap-2">
          {contributors.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
            >
              {c.name}
              {c.branch && <span className="text-xs opacity-60">· {c.branch}</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        A big thank you to everyone who has contributed. Paid your share? Ping the organizers if
        your name isn't here yet.
      </p>
    </section>
  );
}

function ContributionCTA({ amount, note, user }) {
  // Only show once an amount is configured.
  if (!amount || amount <= 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink-950 p-6 text-white shadow-card sm:p-10">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-400/40 blur-[90px]" />
      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            Contribution
          </span>
          <div className="mt-3 text-3xl font-extrabold sm:text-4xl">
            ₹{Number(amount).toLocaleString('en-IN')}
            <span className="ml-2 align-middle text-sm font-medium text-slate-400">per person</span>
          </div>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            {note || 'Your contribution covers venue, food, T-shirt and souvenirs. Log in to pay and upload your payment proof.'}
          </p>
        </div>
        <Link to={user ? '/dashboard' : '/login'} className="btn-accent shrink-0">
          {user ? 'Contribute now' : 'Log in to contribute'}
        </Link>
      </div>
    </section>
  );
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [event, setEvent] = useState({
    name: 'Batch Reunion',
    date: '2026-12-19',
    ...EVENT_DETAILS_FALLBACK,
  });
  const [stats, setStats] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [attendFilter, setAttendFilter] = useState('all');
  const [contributors, setContributors] = useState({ count: 0, contributors: [] });
  const [payment, setPayment] = useState(null); // { amount, note, enabled, ... }
  const countdown = useCountdown(parseEventDate(event.date));

  useEffect(() => {
    // Event details rarely change — fetch once. Guard against non-JSON replies.
    api
      .get('/api/public/event')
      .then((r) => {
        if (r.data && typeof r.data === 'object' && r.data.name) {
          setEvent((prev) => ({ ...prev, ...r.data }));
        }
      })
      .catch(() => {});

    // Contribution amount + note (public info). Fetched once.
    api
      .get('/api/public/payment')
      .then((r) => {
        if (r.data && typeof r.data === 'object') setPayment(r.data);
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
      api
        .get('/api/public/contributors')
        .then((r) =>
          setContributors({
            count: r.data?.count || 0,
            contributors: Array.isArray(r.data?.contributors) ? r.data.contributors : [],
          }),
        )
        .catch(() => {});
    };
    // Only poll while the tab is actually visible — backgrounded tabs stop
    // hitting the API, which keeps serverless usage low. Refresh once on load
    // and again whenever the tab regains focus, plus every 30s while visible.
    let id = null;
    const start = () => {
      if (id) return;
      refresh();
      id = setInterval(refresh, 30000);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const prettyDate = parseEventDate(event.date).toLocaleDateString('en-US', {
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
            <div className="mt-1 font-bold text-brand-700">📍 {event.venue}</div>
            {event.locationUrl ? (
              <a
                href={event.locationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-block text-xs font-semibold text-blue-600 hover:underline"
              >
                View on map →
              </a>
            ) : (
              <div className="mt-0.5 text-xs text-slate-400">Exact venue to be announced</div>
            )}
            {event.videoUrl && (
              <a
                href={event.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block text-xs font-semibold text-rose-600 hover:underline"
              >
                ▶ Watch venue tour
              </a>
            )}
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time</div>
            <div className="mt-1 font-bold text-brand-700">🕔 {event.time}</div>
            <div className="mt-0.5 text-xs text-slate-400">{prettyDate}</div>
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</div>
            <div className="mt-1 space-y-0.5">
              {(event.contacts || []).map((c, i) => (
                <div key={i} className="font-bold text-brand-700">
                  📞 {c.name}
                  {c.phone && (
                    <>
                      {' — '}
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="text-blue-600 hover:underline">
                        {c.phone}
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">For any queries</div>
          </div>
        </div>
      </section>

      {/* Programme / running order for the day */}
      <ProgrammeTimeline schedule={event.schedule} />

      {/* Contribution CTA — links to login/dashboard to pay */}
      <ContributionCTA amount={payment?.amount} note={payment?.note} user={user} />

      {/* Live stats */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Live count</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={stats?.attending ?? '—'} label="Attending" accent="text-emerald-600" />
          <StatCard value={stats?.maybe ?? '—'} label="Maybe" accent="text-amber-500" />
          <StatCard value={stats?.headcount ?? '—'} label="Total headcount" accent="text-slate-900" />
          <StatCard value={stats?.registered ?? '—'} label="Registered" accent="text-slate-900" />
          {contributors.count > 0 && (
            <StatCard value={contributors.count} label="Contributed" accent="text-emerald-600" />
          )}
          {stats?.checkedIn > 0 && (
            <StatCard value={stats.checkedIn} label="✅ Checked in" accent="text-emerald-600" />
          )}
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
      {/* Attendee + contributor walls, side by side on wider screens.
          Falls back to full-width attendee wall when nobody has paid yet. */}
      <div className={contributors.count > 0 ? 'grid grid-cols-1 gap-8 lg:grid-cols-2' : ''}>
        <AttendeeWall
          attendees={attendees}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          attendFilter={attendFilter}
          setAttendFilter={setAttendFilter}
        />

        {/* Contributors — public "thank you" wall (paid members only) */}
        <ContributorsWall contributors={contributors.contributors} count={contributors.count} />
      </div>
    </div>
  );
}
