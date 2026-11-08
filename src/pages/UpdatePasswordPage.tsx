import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Wallet, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery flow: the email link returns the user to the app
    // with a session in the URL hash. getSession resolves it into a valid session.
    let mounted = true;
    (async () => {
      try {
        await supabase.auth.getSession();
      } catch {
        // ignore — the form will surface any real error on submit
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Informe a nova senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ink-50 dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-100">
            Grana<span className="text-brand-600">+</span>
          </span>
        </div>

        <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-sm border border-ink-200 dark:border-ink-800 p-8">
          {!ready ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-sm text-ink-500 dark:text-ink-400">Verificando link de recuperação...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 size={48} className="text-brand-600" />
              <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Senha atualizada!</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Sua senha foi redefinida com sucesso. Você já pode entrar com a nova senha.
              </p>
              <a
                href="#/"
                className="btn-primary w-full py-3 text-center mt-2"
              >
                Voltar para o login
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-ink-900 dark:text-ink-100 mb-2">Defina uma nova senha</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">
                Informe e confirme sua nova senha para voltar a acessar sua conta.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="label">Nova senha</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pl-11 pr-11"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pl-11"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-coral-50 dark:bg-coral-900/30 border border-coral-200 dark:border-coral-800 px-4 py-3 text-sm text-coral-700 dark:text-coral-300">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
