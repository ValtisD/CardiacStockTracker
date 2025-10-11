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

    // Poll navigator.onLine every second to catch changes that don't fire events
    // (DevTools offline mode doesn't always fire events reliably)
    const pollInterval = setInterval(() => {
      const currentStatus = navigator.onLine;
      if (currentStatus !== isOnline) {
        setIsOnline(currentStatus);
      }
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [isOnline]);

  const handleSync = () => {
    syncManager.sync();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Always show connection status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={!isOnline ? "secondary" : "outline"} 
              className="gap-1.5"
            >
              {!isOnline ? (
                <>
                  <CloudOff className="h-3.5 w-3.5" />
                  {t('offline.offlineMode')}
                </>
              ) : (
                <>
                  <Cloud className="h-3.5 w-3.5 text-green-600" />
                  {t('offline.onlineMode', 'Online')}
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {!isOnline 
                ? t('offline.workingOffline') 
                : t('offline.connectedToServer', 'Connected to server')}
            </p>
          </TooltipContent>
        </Tooltip>

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
