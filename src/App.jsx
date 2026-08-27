import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import PassPage from './pages/PassPage.jsx';
import StationPage from './pages/StationPage.jsx';
import RevealPage from './pages/RevealPage.jsx';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          {/* Event-day full-screen reveal slideshow (admin only). */}
          <Route
            path="/reveal"
            element={
              <ProtectedRoute adminOnly>
                <RevealPage />
              </ProtectedRoute>
            }
          />
          {/* Event-day pass check-in (scanned from a member's QR). Auth is
              handled inside the page so volunteers get a clear login prompt. */}
          <Route path="/pass/:token" element={<PassPage />} />
          {/* Volunteer counter station (opened from a per-counter QR link,
              no login). Scans member passes to mark redemptions. */}
          <Route path="/station/:token" element={<StationPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-400">
        Made with love for our batch reunion · 19 Dec 2026
      </footer>
    </div>
  );
}
