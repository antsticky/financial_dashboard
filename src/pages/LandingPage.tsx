import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router-dom";
import { readOidcEnv } from "../auth/oidc";

type LandingMode =
  | { kind: "unconfigured" }
  | { kind: "loading" }
  | { kind: "signed-out"; onSignIn: () => void; error?: string }
  | { kind: "ready"; onOpen: () => void; onSignOut: () => void };

export function LandingPage() {
  if (!readOidcEnv()) return <LandingView mode={{ kind: "unconfigured" }} />;
  return <ConfiguredLanding />;
}

function ConfiguredLanding() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.isLoading) return <LandingView mode={{ kind: "loading" }} />;

  if (!auth.isAuthenticated) {
    return (
      <LandingView
        mode={{
          kind: "signed-out",
          error: auth.error?.message,
          onSignIn: () => void auth.signinRedirect(),
        }}
      />
    );
  }

  return (
    <LandingView
      mode={{
        kind: "ready",
        onOpen: () => navigate("/app"),
        onSignOut: () => void auth.signoutRedirect(),
      }}
    />
  );
}

function LandingView({ mode }: { mode: LandingMode }) {
  const [needsSetup, setNeedsSetup] = useState(false);

  return (
    <main className="column landing">
      <div className="landing-copy">
        <p className="eyebrow">Portfolio</p>
        <h1>Dashboard</h1>
        <p className="lede">
          Portfolio value by bank and by ETF, together or one fund at a time.
        </p>
      </div>
      <svg className="spark" viewBox="0 0 320 120" aria-hidden="true">
        <path d="M8 86 C 48 84, 70 70, 104 64 S 168 40, 210 46 280 22, 312 18" />
        <path d="M8 96 C 52 98, 78 90, 118 86 S 176 74, 230 70 286 58, 312 52" />
        <path d="M8 78 C 40 60, 74 72, 110 48 S 170 28, 214 34 276 16, 312 10" />
      </svg>
      <div className="landing-copy">
        {mode.kind === "loading" ? <p className="help">Checking your session.</p> : null}
        {mode.kind === "signed-out" && mode.error ? (
          <p className="error">{mode.error}</p>
        ) : null}
        <div className="actions">
          {mode.kind === "unconfigured" ? (
            <>
              <p id="signin-help" className="help" role="status">
                {needsSetup
                  ? "Sign-in is not set up on this site yet. Add the Zitadel address and client id, then publish again."
                  : "Sign-in needs the Zitadel address and client id before it can open."}
              </p>
              <button
                type="button"
                className="primary"
                aria-describedby="signin-help"
                onClick={() => setNeedsSetup(true)}
              >
                Sign in
              </button>
            </>
          ) : null}
          {mode.kind === "signed-out" ? (
            <button type="button" className="primary" onClick={mode.onSignIn}>
              Sign in
            </button>
          ) : null}
          {mode.kind === "ready" ? (
            <>
              <button type="button" className="primary" onClick={mode.onOpen}>
                Open dashboard
              </button>
              <button type="button" className="secondary" onClick={mode.onSignOut}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
