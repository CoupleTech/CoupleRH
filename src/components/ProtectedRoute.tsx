import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Carregando ambiente seguro...</p>
      </div>
    );
  }

  if (!session) {
    // Redireciona para o login salvando a rota original que ele tentou acessar
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver logado, renderiza as rotas filhas (DashboardLayout)
  return <Outlet />;
}
