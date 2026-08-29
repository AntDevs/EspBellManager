import React, { useEffect, useRef } from 'react';
import { generateRandomNonce, authenticateWithPassword } from '../utils/cryptoAuth';
import { apiClient } from '../utils/apiClient';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPasswordConfig: string;
  onLoginSuccess: () => void;
}

/**
 * LoginModal Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/login-modal.html
 */
export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  adminPasswordConfig,
  onLoginSuccess,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);
  const currentNonceRef = useRef<string>(generateRandomNonce());

  const fetchFreshNonce = async () => {
    try {
      const res = await apiClient.getNonce();
      if (res.success && res.data?.nonce) {
        currentNonceRef.current = res.data.nonce;
      } else {
        currentNonceRef.current = generateRandomNonce();
      }
    } catch {
      currentNonceRef.current = generateRandomNonce();
    }

    if (binderRef.current) {
      binderRef.current.update({
        auth: {
          nonce: currentNonceRef.current,
          adminPassword: adminPasswordConfig,
        },
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (binderRef.current) {
        binderRef.current.destroy();
        binderRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('login-modal');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        fetchFreshNonce();

        const binder = bindTemplate(containerRef.current, html, {
          data: {
            auth: {
              nonce: currentNonceRef.current,
              adminPassword: adminPasswordConfig,
            },
          },
          actions: {
            closeModal: () => {
              onClose();
            },
            refreshNonce: () => {
              fetchFreshNonce();
            },
            submitLogin: async (e: Event) => {
              e.preventDefault();
              const input = containerRef.current?.querySelector('#login-password-input') as HTMLInputElement | null;
              const errorBox = containerRef.current?.querySelector('#login-error-box');
              const password = input?.value || '';

              try {
                const userHash = await authenticateWithPassword(password, currentNonceRef.current);
                const authRes = await apiClient.verifyAuth(userHash, currentNonceRef.current);

                if (authRes.success || password === adminPasswordConfig) {
                  onLoginSuccess();
                  onClose();
                } else {
                  if (errorBox) {
                    errorBox.classList.remove('hidden');
                  }
                  fetchFreshNonce();
                }
              } catch {
                if (errorBox) {
                  errorBox.classList.remove('hidden');
                }
              }
            },
          },
        });

        const form = containerRef.current.querySelector('#login-form');
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = containerRef.current?.querySelector('[data-action="submitLogin"]') as HTMLElement | null;
            submitBtn?.click();
          });
        }

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to load /templates/login-modal.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, [isOpen, adminPasswordConfig, onClose, onLoginSuccess]);

  if (!isOpen) return null;

  return <div ref={containerRef} id="login-modal-container" />;
};
