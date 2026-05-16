import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n-context";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import PatientsList from "@/pages/patients/index";
import PatientNew from "@/pages/patients/new";
import PatientDetail from "@/pages/patients/detail";
import PregnanciesList from "@/pages/pregnancies/index";
import PregnancyNew from "@/pages/pregnancies/new";
import PregnancyDetail from "@/pages/pregnancies/detail";
import AlertsList from "@/pages/alerts";
import UserGuide from "@/pages/guide";

const queryClient = new QueryClient();

function Router() {
  return (
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
        <Route path="/guide" component={UserGuide} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
