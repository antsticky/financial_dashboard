import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { Link, useNavigate } from "react-router-dom";
import { hasKorteRole } from "../auth/oidc";

export function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isLoading || auth.error) return;
    if (!auth.isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    navigate(hasKorteRole(auth.user?.profile) ? "/app" : "/", { replace: true });
  }, [auth.error, auth.isAuthenticated, auth.isLoading, auth.user?.profile, navigate]);

  return (
    <main className="column landing">
      <div className="landing-copy">
        <h1>{auth.error ? "Sign-in failed" : "Signing in"}</h1>
        <p className={auth.error ? "error" : "lede"}>
          {auth.error
            ? auth.error.message
            : "Waiting for Zitadel to finish signing you in."}
        </p>
        {auth.error ? (
          <div className="actions">
            <Link className="primary" to="/">
              Back
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
