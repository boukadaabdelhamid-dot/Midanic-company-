// Minimal declarations to unblock TypeScript until @types/jsonwebtoken is installed.
// These match the subset used by lib/auth.ts — add more if needed.
declare module "jsonwebtoken" {
  export interface JwtPayload {
    [key: string]: unknown;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
  }

  export type SignOptions = {
    expiresIn?: string | number;
    algorithm?: string;
    issuer?: string;
    audience?: string | string[];
    subject?: string;
    [key: string]: unknown;
  };

  export type VerifyOptions = {
    algorithms?: string[];
    audience?: string | string[];
    issuer?: string;
    [key: string]: unknown;
  };

  export type Secret = string | Buffer;

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: Secret,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: Secret,
    options?: VerifyOptions
  ): string | JwtPayload;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): null | string | JwtPayload;
}
