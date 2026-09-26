import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuthenticateWithGoogle, useGetGoogleAuthConfig } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

type GoogleCredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
            context?: 'signin' | 'signup' | 'use';
            locale?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: 'standard';
              theme: 'outline';
              size: 'large';
              text: 'signin_with' | 'signup_with';
              shape: 'rectangular';
              width: number;
              locale: string;
            },
          ) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const script = existingScript ?? document.createElement('script');
    const onLoad = () => resolve();
    const onError = () => {
      googleScriptPromise = null;
      reject(new Error('Could not load Google Identity Services'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existingScript) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.accounts.id) {
      resolve();
    }
  });

  return googleScriptPromise;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

export function GoogleAuthButton({ mode }: { mode: 'login' | 'register' }) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const configQuery = useGetGoogleAuthConfig();
  const googleAuth = useAuthenticateWithGoogle();
  const buttonContainer = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef<(credential: string) => void>(() => undefined);

  onCredentialRef.current = (credential) => {
    const language = i18n.language.split('-')[0];
    googleAuth.mutate(
      {
        data: {
          credential,
          language: language === 'ar' || language === 'fr' ? language : 'en',
        },
      },
      {
        onSuccess: (response) => {
          login(response.accessToken, response.refreshToken, response.user);
          toast.success(response.isNewUser ? t('auth.register_success') : t('auth.login_success'));
          setLocation(mode === 'register' && response.isNewUser ? '/' : '/dashboard');
        },
        onError: (error) => {
          const status = errorStatus(error);
          toast.error(
            status === 409
              ? t('auth.google_conflict')
              : status === 403
                ? t('auth.google_account_not_allowed')
                : t('auth.google_error'),
          );
        },
      },
    );
  };

  useEffect(() => {
    const clientId = configQuery.data?.clientId;
    const container = buttonContainer.current;
    if (!configQuery.data?.enabled || !clientId || !container) return;

    let cancelled = false;
    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google?.accounts.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          context: mode === 'register' ? 'signup' : 'signin',
          locale: i18n.language.split('-')[0],
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential);
          },
        });
        container.replaceChildren();
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width: Math.max(220, Math.min(400, Math.floor(container.clientWidth))),
          locale: i18n.language.split('-')[0],
        });
      })
      .catch(() => toast.error(t('auth.google_error')));

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [configQuery.data?.clientId, configQuery.data?.enabled, i18n.language, mode, t]);

  if (!configQuery.data?.enabled || !configQuery.data.clientId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span>{t('auth.or_continue_with')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div
        ref={buttonContainer}
        className={`flex min-h-10 justify-center ${googleAuth.isPending ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={googleAuth.isPending}
      />
    </div>
  );
}