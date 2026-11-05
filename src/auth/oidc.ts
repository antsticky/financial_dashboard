const PROJECT_ID = "397284029780523341";
const ROLE = "korte";

const ROLE_CLAIM_KEYS = [
  `urn:zitadel:iam:org:project:${PROJECT_ID}:roles`,
  "urn:zitadel:iam:org:project:roles",
] as const;

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
    scope: `openid profile email urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud urn:zitadel:iam:org:projects:roles`,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, callbackPath);
    },
  };
}

export function hasKorteRole(
  profile: { [claim: string]: unknown } | undefined,
): boolean {
  if (!profile) return false;
  return ROLE_CLAIM_KEYS.some((key) => {
    const claim = profile[key];
    if (typeof claim !== "object" || claim === null || Array.isArray(claim)) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(claim, ROLE);
  });
}
