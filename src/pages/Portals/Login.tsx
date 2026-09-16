import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function EmployeePortalLogin() {
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Simple CPF mask
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 9) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/(\d{3})(\d{3})/, "$1.$2");
    }
    setCpf(value);
  };

  // Simple Date mask (DDMMAAAA to DD/MM/AAAA)
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    // As the user requested to type DDMMAAAA, we can mask it for better UX, or let it be raw
    if (value.length > 4) {
      value = value.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
    } else if (value.length > 2) {
      value = value.replace(/(\d{2})(\d{1,2})/, "$1/$2");
    }
    
    setBirthDate(value);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const rawCpf = cpf.replace(/\D/g, '');
      const rawDate = birthDate.replace(/\D/g, ''); // Expecting DDMMAAAA

      if (rawCpf.length !== 11) {
        throw new Error('CPF incompleto.');
      }
      if (rawDate.length !== 8) {
        throw new Error('Data de nascimento incompleta.');
      }

      // We call our RPC to authenticate
      const { data, error: rpcError } = await supabase.rpc('authenticate_employee', {
        p_cpf: rawCpf,
        p_birth_date: rawDate
      });

      if (rpcError) throw rpcError;

      if (!data || data.length === 0) {
        throw new Error('Credenciais inválidas. Verifique seu CPF e Data de Nascimento.');
      }

      // Validated! Save to local storage
      const authData = data[0];
      localStorage.setItem('@coupleRH:employeeAuth', JSON.stringify({
        isAuthenticated: true,
        workerId: authData.worker_id,
        personId: authData.person_id,
        companyId: authData.company_id,
        fullName: authData.full_name
      }));

      // Redirect to dashboard
      navigate('/portal/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-primary-500/10 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-blue-500/10 blur-3xl" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 shadow-xl shadow-primary-500/30 mb-6">
            <span className="text-white font-extrabold text-2xl font-display">cR</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            Portal do Colaborador
          </h1>
          <p className="text-slate-500 mt-2">
            Acesse seus holerites, folha de ponto e muito mais.
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">CPF</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-900 font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Data de Nascimento <span className="text-slate-400 font-normal">(Senha)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  placeholder="DD/MM/AAAA"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-900 font-medium"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Digite os 8 números da sua data de nascimento (ex: 29091995)
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3.5 text-base shadow-lg shadow-primary-500/30"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    Acessar meu Portal <ArrowRight size={18} />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-8 text-sm text-slate-500">
          <p className="flex items-center justify-center gap-1.5">
            <Lock size={14} className="text-slate-400" />
            Acesso seguro e restrito
          </p>
        </div>
      </div>
    </div>
  );
}
