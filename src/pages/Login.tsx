import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.");
        return;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-[#0c1222] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Gradient glow */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary-400/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-white font-extrabold text-base font-display">
                cR
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
              couple<span className="text-primary-400">RH</span>
            </h1>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] font-display">
            Folha de pagamento
            <br />
            <span className="text-primary-400">com precisão</span>
            <br />
            cirúrgica.
          </h2>
          <p className="text-slate-400 text-base max-w-sm leading-relaxed">
            Motor de cálculo CLT com memória completa, auditoria em tempo real e
            conformidade eSocial integrada.
          </p>
          <div className="flex items-center gap-6 pt-4">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white font-display">
                100%
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                CLT Compliant
              </p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white font-display">
                S-1.3
              </p>
              <p className="text-[11px] text-slate-500 font-medium">eSocial</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white font-display">
                256bit
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Encrypted
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} coupleRH · Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <span className="text-white font-extrabold text-sm font-display">
                cR
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-display">
              couple<span className="text-primary-500">RH</span>
            </h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900 font-display">
              Entrar na plataforma
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Acesse com suas credenciais corporativas
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium animate-fade-up">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="input-label" htmlFor="login-email">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="seu@email.com.br"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="input-label !mb-0" htmlFor="login-password">
                  Senha
                </label>
                <button
                  type="button"
                  className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 justify-center text-slate-400">
              <Lock size={12} />
              <p className="text-[11px] font-medium">
                Sessão protegida · Auditoria ativa
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
