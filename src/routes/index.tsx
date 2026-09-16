import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';
import { CompanyProvider } from '../contexts/CompanyContext';
import Login from '../pages/Login';
import Templates from '../pages/Documents/Templates';
import SignaturesVault from '../pages/Documents/SignaturesVault';
import PersonalDocsInbox from '../pages/Documents/PersonalDocsInbox';
import EmployeePortal from '../pages/Portals/EmployeePortal';
import EmployeePortalLogin from '../pages/Portals/Login';
import VacationsList from '../pages/Vacations/List';
import VacationWizard from '../pages/Vacations/Wizard';
import LeavesList from '../pages/Leaves/List';
import LeaveWizard from '../pages/Leaves/Wizard';
import BenefitsList from '../pages/Benefits/List';
import BenefitForm from '../pages/Benefits/Form';
import Timesheet from '../pages/TimeTracking/Timesheet';
import PayrollRubrics from '../pages/Payroll/Rubrics';
import PayrollEvents from '../pages/Payroll/Events';
import PayrollCalculations from '../pages/Payroll/Calculations';
import Payslips from '../pages/Payroll/Payslips';
import PayrollReports from '../pages/Payroll/Reports';
import TerminationsList from '../pages/Offboarding/List';
import OffboardingWizard from '../pages/Offboarding/Wizard';
import Movements from '../pages/Movements';
import ESocialDashboard from '../pages/eSocial/Dashboard';
import SstDashboard from '../pages/SST/Dashboard';
import Dashboard from '../pages/Dashboard';
import SettingsDashboard from '../pages/Settings/Dashboard';
import LegalTablesList from '../pages/Settings/LegalTables/List';
import LegalTablesForm from '../pages/Settings/LegalTables/Form';
import LogViewer from '../pages/Audit/LogViewer';
import Help from '../pages/Help';

import CompaniesList from '../pages/Companies/List';
import CompanyForm from '../pages/Companies/Form';
import DepartmentsList from '../pages/Organization/Departments/List';
import DepartmentForm from '../pages/Organization/Departments/Form';
import SectorsList from '../pages/Organization/Sectors/List';
import SectorForm from '../pages/Organization/Sectors/Form';
import PositionsList from '../pages/Organization/Positions/List';
import PositionForm from '../pages/Organization/Positions/Form';
import CostCentersList from '../pages/Organization/CostCenters/List';
import CostCenterForm from '../pages/Organization/CostCenters/Form';
import WorkplacesList from '../pages/Organization/Workplaces/List';
import WorkplaceForm from '../pages/Organization/Workplaces/Form';
import WorkSchedulesList from '../pages/Timekeeping/WorkSchedules/List';
import WorkScheduleForm from '../pages/Timekeeping/WorkSchedules/Form';
import HolidaysList from '../pages/Timekeeping/Holidays/List';
import HolidayForm from '../pages/Timekeeping/Holidays/Form';
import ContractTypesList from '../pages/Organization/ContractTypes/List';
import ContractTypeForm from '../pages/Organization/ContractTypes/Form';
import EmployeesList from '../pages/Employees/List';
import EmployeeProfile from '../pages/Employees/Profile';

export function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/portal/login" element={<EmployeePortalLogin />} />
          <Route path="/portal/dashboard" element={<EmployeePortal />} />
          
          {/* Rotas Administrativas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={
              <CompanyProvider>
                <DashboardLayout />
              </CompanyProvider>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              
              <Route path="/empresas" element={<CompaniesList />} />
              <Route path="/empresas/nova" element={<CompanyForm />} />
              <Route path="/empresas/:id" element={<CompanyForm />} />
              <Route path="/cargos" element={<PositionsList />} />
              
              <Route path="/funcionarios/movimentacoes" element={<Movements />} />
              
              <Route path="/desligamentos" element={<TerminationsList />} />
              <Route path="/desligamentos/novo" element={<OffboardingWizard />} />
              
              <Route path="/ponto/espelho" element={<Timesheet />} />
              
              <Route path="/ferias" element={<VacationsList />} />
              <Route path="/ferias/novo" element={<VacationWizard />} />
              <Route path="/afastamentos" element={<LeavesList />} />
              <Route path="/afastamentos/novo" element={<LeaveWizard />} />
              <Route path="/afastamentos/:id" element={<LeaveWizard />} />
              <Route path="/beneficios" element={<BenefitsList />} />
              <Route path="/beneficios/novo" element={<BenefitForm />} />
              
              <Route path="/folha/processamento" element={<PayrollCalculations />} />
              <Route path="/folha/lancamentos" element={<PayrollEvents />} />
              <Route path="/folha/holerites" element={<Payslips />} />
              <Route path="/folha/rubricas" element={<PayrollRubrics />} />
              <Route path="/folha/relatorios" element={<PayrollReports />} />
              
              <Route path="/esocial" element={<ESocialDashboard />} />
              <Route path="/sst" element={<SstDashboard />} />
              
              <Route path="/documentos/templates" element={<Templates />} />
              <Route path="/documentos/cofre" element={<SignaturesVault />} />
              <Route path="/documentos/recepcao" element={<PersonalDocsInbox />} />
              
              <Route path="/departamentos" element={<DepartmentsList />} />
              <Route path="/departamentos/novo" element={<DepartmentForm />} />
              <Route path="/departamentos/:id" element={<DepartmentForm />} />

              <Route path="/setores" element={<SectorsList />} />
              <Route path="/setores/novo" element={<SectorForm />} />
              <Route path="/setores/:id" element={<SectorForm />} />

              <Route path="/cargos" element={<PositionsList />} />
              <Route path="/cargos/novo" element={<PositionForm />} />
              <Route path="/cargos/:id" element={<PositionForm />} />

              <Route path="/funcionarios" element={<EmployeesList />} />
              <Route path="/funcionarios/novo" element={<EmployeeProfile />} />
              <Route path="/funcionarios/:id" element={<EmployeeProfile />} />

              <Route path="/tipos-de-contrato" element={<ContractTypesList />} />
              <Route path="/tipos-de-contrato/novo" element={<ContractTypeForm />} />
              <Route path="/tipos-de-contrato/:id" element={<ContractTypeForm />} />

              <Route path="/centros-de-custo" element={<CostCentersList />} />
              <Route path="/centros-de-custo/novo" element={<CostCenterForm />} />
              <Route path="/centros-de-custo/:id" element={<CostCenterForm />} />

              <Route path="/lotacoes" element={<WorkplacesList />} />
              <Route path="/lotacoes/nova" element={<WorkplaceForm />} />
              <Route path="/lotacoes/:id" element={<WorkplaceForm />} />

              <Route path="/jornadas" element={<WorkSchedulesList />} />
              <Route path="/jornadas/nova" element={<WorkScheduleForm />} />
              <Route path="/jornadas/:id" element={<WorkScheduleForm />} />

              <Route path="/feriados" element={<HolidaysList />} />
              <Route path="/feriados/novo" element={<HolidayForm />} />
              <Route path="/feriados/:id" element={<HolidayForm />} />
              
              {/* Rotas genéricas de placeholder para visualização */}
              <Route path="/ajuda" element={<Help />} />
              <Route path="/auditoria" element={<LogViewer />} />
              <Route path="/configuracoes" element={<SettingsDashboard />} />
              <Route path="/configuracoes/tabelas-legais" element={<LegalTablesList />} />
              <Route path="/configuracoes/tabelas-legais/nova" element={<LegalTablesForm />} />
              <Route path="/configuracoes/tabelas-legais/:id" element={<LegalTablesForm />} />
            </Route>
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
