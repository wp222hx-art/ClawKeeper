import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { use_auth_store } from './stores/auth-store';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { InvoicesPage } from './pages/invoices/InvoicesPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { ReconciliationPage } from './pages/reconciliation/ReconciliationPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { VendorsPage } from './pages/vendors/VendorsPage';
import { AgentsPage } from './pages/agents/AgentsPage';
import { AgentConsolePage } from './pages/agents/AgentConsolePage';
import { CommandCenterPage } from './pages/agents/CommandCenterPage';

import { LandingPage } from './pages/landing/LandingPage';

// IPOPilot pages
import { IpoProjectsPage } from './pages/ipo/ProjectsPage';
import { IpoNewProjectWizard } from './pages/ipo/NewProjectWizard';
import { IpoProjectDashboard } from './pages/ipo/ProjectDashboard';
import { IpoFinancialDiagnosis } from './pages/ipo/FinancialDiagnosis';
import { IpoProspectusDrafter } from './pages/ipo/ProspectusDrafter';
import { IpoRegulatorQa } from './pages/ipo/RegulatorQA';
import { IpoValuationLab } from './pages/ipo/ValuationLab';
import { IpoStockSimulator } from './pages/ipo/StockSimulator';
import { IpoKnowledgeBase } from './pages/ipo/KnowledgeBase';
import { IpoReviewQueue } from './pages/ipo/ReviewQueue';
import { IpoAgentCatalog } from './pages/ipo/AgentCatalog';
import { AIProvidersPage } from './pages/settings/AIProvidersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { is_authenticated } = use_auth_store();
  
  if (!is_authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
        
        {/* Finance */}
        <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
        <Route path="/reconciliation" element={<ProtectedRoute><ReconciliationPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        
        {/* Contacts */}
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><VendorsPage /></ProtectedRoute>} />
        
        {/* AI Agents */}
        <Route path="/agents/command-center" element={<ProtectedRoute><CommandCenterPage /></ProtectedRoute>} />
        <Route path="/agents/console" element={<ProtectedRoute><AgentConsolePage /></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
        
        {/* IPOPilot */}
        <Route path="/ipo/projects" element={<ProtectedRoute><IpoProjectsPage /></ProtectedRoute>} />
        <Route path="/ipo/projects/new" element={<ProtectedRoute><IpoNewProjectWizard /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id" element={<ProtectedRoute><IpoProjectDashboard /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/financial" element={<ProtectedRoute><IpoFinancialDiagnosis /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/prospectus" element={<ProtectedRoute><IpoProspectusDrafter /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/regulator-qa" element={<ProtectedRoute><IpoRegulatorQa /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/valuation" element={<ProtectedRoute><IpoValuationLab /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/simulator" element={<ProtectedRoute><IpoStockSimulator /></ProtectedRoute>} />
        <Route path="/ipo/projects/:id/review" element={<ProtectedRoute><IpoReviewQueue /></ProtectedRoute>} />
        <Route path="/ipo/knowledge" element={<ProtectedRoute><IpoKnowledgeBase /></ProtectedRoute>} />
        <Route path="/ipo/agents" element={<ProtectedRoute><IpoAgentCatalog /></ProtectedRoute>} />

        {/* System */}
        <Route path="/settings/ai-providers" element={<ProtectedRoute><AIProvidersPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
