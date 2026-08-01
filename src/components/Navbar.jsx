import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-950 text-sm font-bold text-brand-400">
            25
          </span>
          <span className="hidden sm:inline">Batch Reunion</span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className="btn-ghost">
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="btn-ghost">
                My RSVP
              </Link>
              <button onClick={handleLogout} className="btn-primary">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Log in
              </Link>
              <Link to="/register" className="btn-primary">
                RSVP now
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
