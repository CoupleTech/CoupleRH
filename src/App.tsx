import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-500/20 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-3xl" />
      
      <main className="glass w-full max-w-4xl rounded-2xl p-8 md:p-12 relative z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-xl mb-6">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Bem-vindo ao <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-500">coupleRH</span>
        </h1>
        
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          O motor definitivo para Departamento Pessoal e Gestão de RH. Conformidade legal estrita, segurança de nível empresarial e uma experiência premium.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/login')}
            className="px-8 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/30 active:scale-95">
            Acessar Sistema
          </button>
          <button className="px-8 py-3 rounded-lg bg-white text-slate-700 border border-slate-200 font-medium hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            Documentação
          </button>
        </div>
      </main>
      
      <footer className="mt-12 text-slate-400 text-sm font-medium relative z-10">
        Fase 0 - Descoberta e Fundação
      </footer>
    </div>
  );
}

export default App;
