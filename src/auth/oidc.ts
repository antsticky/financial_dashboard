const PROJECT_ID = "397284029780523341";

export function readOidcEnv(): { authority: string; clientId: string } | null {
  const authority = import.meta.env.VITE_ZITADEL_AUTHORITY?.trim() ?? "";
  const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID?.trim() ?? "";
  if (!authority || !clientId) return null;
  return { authority, clientId };
}

function publicPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

export function createOidcConfig(authority: string, clientId: string) {
  const origin = window.location.origin;
  const callbackPath = publicPath("/callback");
  return {
    authority,
    client_id: clientId,
    redirect_uri: `${origin}${callbackPath}`,
    post_logout_redirect_uri: `${origin}${publicPath("/")}`,
    response_type: "code" as const,
    scope: `openid profile email urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud`,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, callbackPath);
    },
  };
}
