import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

interface Company {
  id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  setSelectedCompanyId: (id: string | null) => void;
  loading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(() => {
    // Tenta recuperar do localStorage ao iniciar
    return localStorage.getItem("@coupleRH:selectedCompanyId") || null;
  });
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("id, corporate_name, trade_name, cnpj")
        .order("corporate_name", { ascending: true });

      if (error) throw error;

      if (data) {
        setCompanies(data);
        
        // Se houver empresas cadastradas mas nenhuma selecionada (ou a selecionada não existe mais),
        // seleciona a primeira por padrão
        if (data.length > 0) {
          const exists = data.find(c => c.id === selectedCompanyId);
          if (!selectedCompanyId || !exists) {
            setSelectedCompanyId(data[0].id);
          }
        } else {
          setSelectedCompanyId(null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar empresas para o contexto:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  const setSelectedCompanyId = (id: string | null) => {
    setSelectedCompanyIdState(id);
    if (id) {
      localStorage.setItem("@coupleRH:selectedCompanyId", id);
    } else {
      localStorage.removeItem("@coupleRH:selectedCompanyId");
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        selectedCompany,
        setSelectedCompanyId,
        loading,
        refreshCompanies: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
