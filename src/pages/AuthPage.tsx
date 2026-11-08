import { useState } from 'react';
import { Wallet, Mail, Lock, User as UserIcon, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Mode = 'login' | 'signup' | 'reset';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'reset') {
      if (!email) {
        setError('Informe seu e-mail.');
        return;
      }
      setLoading(true);
      const { error: err } = await resetPassword(email);
      setLoading(false);
      if (err) {
        setError(err);
      } else {
        setSuccess('Enviamos um link de recuperação para seu e-mail. Verifique sua caixa de entrada.');
        setMode('login');
      }
      return;
    }

    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Informe seu nome.');
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
    }

    setLoading(true);
    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    } else {
      const { error: err } = await signUp(email, name.trim(), password);
      if (err) setError(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand */}
      <div className="lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-ink-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tight">Grana<span className="text-brand-200">+</span></span>
        </div>

        <div className="relative my-12 lg:my-0">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
            Seu dinheiro,<br />sob controle total.
          </h1>
          <p className="text-brand-100 text-base lg:text-lg leading-relaxed max-w-md">
            Acompanhe receitas, despesas, orçamentos e metas em um só lugar.
            Simples, visual e feito para o seu dia a dia.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Dashboard com gráficos interativos',
              'Orçamentos por categoria',
              'Metas de economia com acompanhamento',
              'Movimentações recorrentes automáticas',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-brand-100">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-300" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-brand-200/70 text-xs">
          Seus dados ficam protegidos na nuvem com criptografia e isolamento entre contas.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-ink-50 dark:bg-ink-950">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-ink-900 dark:text-ink-100 mb-2">
            {mode === 'login' && 'Bem-vindo de volta'}
            {mode === 'signup' && 'Crie sua conta'}
            {mode === 'reset' && 'Recuperar senha'}
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-8">
            {mode === 'login' && 'Entre para gerenciar suas finanças.'}
            {mode === 'signup' && 'Comece a controlar seu dinheiro agora.'}
            {mode === 'reset' && 'Informe seu e-mail e uma nova senha.'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Nome</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input pl-11"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  className="input pl-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </div>
            </div>

            {mode !== 'reset' && (
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-11 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
            )}

            {mode === 'signup' && (
            <div>
              <label className="label">Confirmar senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pl-11 pr-11"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            )}

            {error && (
              <div className="rounded-xl bg-coral-50 dark:bg-coral-900/30 border border-coral-200 dark:border-coral-800 px-4 py-3 text-sm text-coral-700 dark:text-coral-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
                {success}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading
                ? 'Carregando...'
                : mode === 'login'
                ? 'Entrar'
                : mode === 'signup'
                ? 'Criar conta'
                : 'Redefinir senha'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode === 'login' && (
              <>
                <p className="text-ink-500 dark:text-ink-400 text-center">
                  Não tem conta?{' '}
                  <button
                    className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
                    onClick={() => { setMode('signup'); setError(''); }}
                  >
                    Cadastre-se
                  </button>
                </p>
                <p className="text-center">
                  <button
                    className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 text-xs hover:underline"
                    onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                  >
                    Esqueci minha senha
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-ink-500 dark:text-ink-400 text-center">
                Já tem conta?{' '}
                <button
                  className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  Entrar
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-center">
                <button
                  className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 text-xs hover:underline inline-flex items-center gap-1"
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                >
                  <ArrowLeft size={14} /> Voltar para login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
