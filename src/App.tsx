import { AuthProvider, useAuth } from "react-oidc-context";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createOidcConfig, hasKorteRole, readOidcEnv } from "./auth/oidc";
import { DashboardPage } from "./pages/DashboardPage";
import { CallbackPage } from "./pages/CallbackPage";
import { LandingPage } from "./pages/LandingPage";

export function App() {
  const env = readOidcEnv();
  const routes = (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
      <AppRoutes configured={env !== null} />
    </BrowserRouter>
  );
  if (!env) return routes;
  return (
    <AuthProvider {...createOidcConfig(env.authority, env.clientId)}>
      {routes}
    </AuthProvider>
  );
}

function AppRoutes({ configured }: { configured: boolean }) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/callback"
        element={configured ? <CallbackPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/app"
        element={configured ? <RequireAccess /> : <Navigate to="/" replace />}
      />
      {import.meta.env.DEV ? <Route path="/preview" element={<PreviewRoute />} /> : null}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAccess() {
  const auth = useAuth();
  if (auth.isLoading) {
    return (
      <main className="column landing">
        <div className="landing-copy">
          <h1>Dashboard</h1>
          <p className="help">Checking your session.</p>
        </div>
      </main>
    );
  }
  if (!auth.isAuthenticated || !hasKorteRole(auth.user?.profile)) {
    return <Navigate to="/" replace />;
  }
  return <DashboardPage onSignOut={() => void auth.signoutRedirect()} />;
}

function PreviewRoute() {
  const navigate = useNavigate();
  return <DashboardPage onSignOut={() => navigate("/")} />;
}
