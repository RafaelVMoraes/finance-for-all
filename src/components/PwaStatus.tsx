import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyServiceWorkerUpdate } from "@/lib/serviceWorker";
import { useI18n } from "@/i18n/I18nProvider";

interface PwaStatusProps {
  hasUpdate: boolean;
}

export const PwaStatus = ({ hasUpdate }: PwaStatusProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { t } = useI18n();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm text-white">
          {t('pwa.offline')}
        </div>
      )}
      {hasUpdate && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-3 shadow-lg">
          <p className="mb-2 text-sm">{t('pwa.updateAvailableTitle')}</p>
          <Button
            size="sm"
            onClick={() => {
              applyServiceWorkerUpdate();
              window.location.reload();
            }}
          >
            {t('pwa.refreshNow')}
          </Button>
        </div>
      )}
    </>
  );
};
