import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from 'sonner';

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has an active session (which they should have if they clicked the invite link)
    // If no session, they shouldn't be here
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError("Erro ao atualizar a senha: " + error.message);
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding (Same as Login) */}
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
            Seja bem-vindo
            <br />
            <span className="text-primary-400">à plataforma</span>
            <br />
            da sua empresa.
          </h2>
          <p className="text-slate-400 text-base max-w-sm leading-relaxed">
            Folha de pagamento segura, transparente e conectada diretamente com o RH.
          </p>
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
              Defina sua Senha
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Crie uma senha segura para o seu primeiro acesso
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium animate-fade-up">
              {error}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-5">
            <div>
              <label className="input-label" htmlFor="new-password">
                Nova Senha
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="confirm-password">
                Confirmar Senha
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input"
                placeholder="Repita a senha"
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
                  Salvando...
                </>
              ) : (
                <>
                  Acessar Plataforma
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
