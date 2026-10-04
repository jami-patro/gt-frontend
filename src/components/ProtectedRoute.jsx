import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Guards routes that require a logged-in user (and optionally an admin or volunteer).
export default function ProtectedRoute({ children, adminOnly = false, allowVolunteer = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (allowVolunteer && user.role !== 'admin' && user.role !== 'volunteer') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
