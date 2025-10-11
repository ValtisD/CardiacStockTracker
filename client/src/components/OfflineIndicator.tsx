import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { syncManager, type SyncStatus } from '@/lib/syncManager';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function OfflineIndicator() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncManager.onStatusChange((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });

    // Initial pending count
    syncManager.getPendingCount().then(setPendingCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleSync = () => {
    syncManager.sync();
  };

  if (isOnline && pendingCount === 0 && syncStatus === 'idle') {
    return null; // Don't show anything when online with nothing to sync
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1.5">
                <CloudOff className="h-3.5 w-3.5" />
                {t('offline.offlineMode')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('offline.workingOffline')}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={syncStatus === 'error' ? 'destructive' : 'default'}
                className="gap-1.5"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : syncStatus === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <Cloud className="h-3.5 w-3.5" />
                )}
                {pendingCount} {t('offline.pendingChanges')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {syncStatus === 'syncing' 
                  ? t('offline.syncing')
                  : syncStatus === 'error'
                  ? t('offline.syncError')
                  : t('offline.clickToSync')}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {isOnline && pendingCount > 0 && syncStatus !== 'syncing' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            className="h-7 px-2"
            data-testid="button-sync-now"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
