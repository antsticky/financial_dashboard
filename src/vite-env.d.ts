/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZITADEL_AUTHORITY?: string;
  readonly VITE_ZITADEL_CLIENT_ID?: string;
}

declare module "virtual:portfolio" {
  const data: {
    portfolio: unknown;
    series: Record<string, { month: string; value: number }[]>;
  };
  export default data;
}
