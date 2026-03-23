import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { InputSubpageShell } from "@/components/layout/InputSubpageShell";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { TutorialStepManager } from "@/components/tutorial/TutorialStepManager";
import { PwaStatus } from "@/components/PwaStatus";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";

const Auth = lazy(() => import("./pages/Auth"));
const View = lazy(() => import("./pages/View"));
const Input = lazy(() => import("./pages/Input"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Categories = lazy(() => import("./pages/Categories"));
const Budget = lazy(() => import("./pages/Budget"));
const Investments = lazy(() => import("./pages/Investments"));
const Analyze = lazy(() => import("./pages/Analyze"));
const Profile = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
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

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isStandalone = (window.navigator as any).standalone === true;

    document.documentElement.dataset.iosStandalone = isIOS && isStandalone ? "true" : "false";
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
                  <Route path="/" element={<Navigate to="/view" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  <Route
                    path="/view"
                    element={<ProtectedRoute><MainLayout><View /></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/input"
                    element={<ProtectedRoute><MainLayout><Input /></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/input/transactions"
                    element={<ProtectedRoute><MainLayout><InputSubpageShell><Transactions /></InputSubpageShell></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/input/categories"
                    element={<ProtectedRoute><MainLayout><InputSubpageShell><Categories /></InputSubpageShell></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/input/budget"
                    element={<ProtectedRoute><MainLayout><InputSubpageShell><Budget /></InputSubpageShell></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/input/investments"
                    element={<ProtectedRoute><MainLayout><InputSubpageShell><Investments /></InputSubpageShell></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/analyze"
                    element={<ProtectedRoute><MainLayout><Analyze /></MainLayout></ProtectedRoute>}
                  />
                  <Route
                    path="/profile"
                    element={<ProtectedRoute><MainLayout><Profile /></MainLayout></ProtectedRoute>}
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
