import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ConsentBanner } from "@/components/consent-banner";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import PatientsList from "@/pages/patients/index";
import PatientNew from "@/pages/patients/new";
import PatientDetail from "@/pages/patients/detail";
import PregnanciesList from "@/pages/pregnancies/index";
import PregnancyNew from "@/pages/pregnancies/new";
import PregnancyDetail from "@/pages/pregnancies/detail";
import AlertsList from "@/pages/alerts";
import AppointmentsPage from "@/pages/appointments";
import UserGuide from "@/pages/guide";
import LoginPage from "@/pages/login";
import PrivacyPage from "@/pages/privacy";
import UsersPage from "@/pages/users/index";
import ReportsPage from "@/pages/reports";
import ReferencePage from "@/pages/admin/reference";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#006633" }}>
        <div className="text-white text-center space-y-3">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-sm opacity-80">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <ConsentBanner />
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/patients" component={PatientsList} />
          <Route path="/patients/new" component={PatientNew} />
          <Route path="/patients/:id" component={PatientDetail} />
          <Route path="/pregnancies" component={PregnanciesList} />
          <Route path="/pregnancies/new" component={PregnancyNew} />
          <Route path="/pregnancies/:id" component={PregnancyDetail} />
          <Route path="/alerts" component={AlertsList} />
          <Route path="/appointments" component={AppointmentsPage} />
          <Route path="/guide" component={UserGuide} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/users" component={UsersPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/admin/reference" component={ReferencePage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedApp />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
