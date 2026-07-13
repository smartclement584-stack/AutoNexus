import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Centralized route guard, used as a React Router v6 layout route wrapping
 * one or more child routes:
 *
 *   <Route element={<ProtectedRoute requireAuth />}>
 *     <Route path="dashboard" element={<DashboardPage />} />
 *   </Route>
 *
 *   <Route element={<ProtectedRoute requireAuth requireAdmin />}>
 *     <Route path="admin" element={<AdminPage />} />
 *   </Route>
 *
 * Why this exists instead of the previous per-page `useEffect` checks:
 *
 * 1. Single source of truth. Every protected route nests under one of these
 *    wrappers instead of hand-copying a redirect effect into each page —
 *    there's nothing to forget when a new protected page is added later.
 *
 * 2. Fixes the refresh race condition at its root. AuthContext's `loading`
 *    flag is true until the initial GET /auth/me call resolves. The old
 *    per-page checks ignored it and read `isAuthenticated` immediately on
 *    mount — which is `false` for a split second on every hard refresh,
 *    even for a perfectly valid session, because the token hasn't been
 *    verified yet. This component waits for `loading` to finish before
 *    making ANY authorization decision, so that bug is fixed once, here,
 *    for every route — not patched separately in three places.
 *
 * 3. Blocks rendering, not just side effects. An unauthorized page's
 *    component function never runs at all — its data-fetching effects
 *    never fire — because <Outlet /> (and therefore the child route) only
 *    renders after this component has already approved it.
 */
const ProtectedRoute = ({
  requireAuth = true,
  requireAdmin = false,
  requireSeller = false,
}) => {
  const { loading, isAuthenticated, isAdmin, isSeller } = useAuth();
  const location = useLocation();

  // Session is still being verified (e.g. right after a hard refresh) —
  // show a neutral loading state instead of guessing. This is the fix for
  // the "logged-in user gets bounced to /login on refresh" bug.
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="auth-loading">
        <Loader2 className="animate-spin text-[#1a5c38]" size={32} />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    // Remember where they were headed so LoginPage can send them back
    // after a successful login instead of always landing on "/".
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireSeller && !isSeller) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

/**
 * Inverse guard for pages that only make sense when logged OUT — currently
 * just /login. If an already-authenticated user navigates here directly
 * (bookmark, typed URL, back button), send them back where they came from
 * instead of showing the login form again.
 */
export const GuestOnlyRoute = () => {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="auth-loading">
        <Loader2 className="animate-spin text-[#1a5c38]" size={32} />
      </div>
    );
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
