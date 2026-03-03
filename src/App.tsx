import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { TutorialStepManager } from "@/components/tutorial/TutorialStepManager";
import { PwaStatus } from "@/components/PwaStatus";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Categories = lazy(() => import("./pages/Categories"));
const Budget = lazy(() => import("./pages/Budget"));
const Investments = lazy(() => import("./pages/Investments"));
const Import = lazy(() => import("./pages/Import"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppContent = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", handleUpdate);

    return () => window.removeEventListener("sw-update-available", handleUpdate);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PwaStatus hasUpdate={updateAvailable} />
          <BrowserRouter>
            <TutorialProvider>
              <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Dashboard /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/transactions"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Transactions /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/categories"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Categories /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budget"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Budget /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/investments"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Investments /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/import"
                    element={
                      <ProtectedRoute>
                        <MainLayout><Import /></MainLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <TutorialStepManager />
            </TutorialProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};


const App = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
