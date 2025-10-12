import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { syncManager, type SyncStatus } from '@/lib/syncManager';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { offlineState } from '@/lib/offlineState';
import { queryClient } from '@/lib/queryClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function OfflineIndicator() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(!offlineState.isOffline());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [isPWA, setIsPWA] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);

  useEffect(() => {
    console.log('📱 OfflineIndicator useEffect running');
    
    // Check if running as PWA
    const checkPWA = () => {
      const pwa = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone ||
                  document.referrer.includes('android-app://');
      setIsPWA(pwa);
      console.log(`📱 PWA Mode: ${pwa ? 'YES' : 'NO'}`);
    };
    
    // Check storage persistence
    const checkPersistence = async () => {
      if (navigator.storage && navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsPersisted(persisted);
        console.log(`💾 Storage Persisted: ${persisted ? 'YES' : 'NO'}`);
      }
    };
    
    checkPWA();
    checkPersistence();
    
    // Subscribe to offline state changes
    const unsubscribeOffline = offlineState.subscribe(async (isOffline) => {
      setIsOnline(!isOffline);
      
      if (isOffline) {
        // Going offline - clear React Query cache to force queryFn to fetch from IndexedDB
        console.log('📴 Going OFFLINE - clearing cache to use IndexedDB');
        queryClient.removeQueries();
      } else {
        // Going online - FIRST sync offline changes, THEN refresh from server
        console.log('🌐 Going ONLINE - syncing offline changes first...');
        
        // 1. FIRST: Sync all pending offline changes to server
        const pendingCount = await syncManager.getPendingCount();
        if (pendingCount > 0) {
          console.log(`📤 Syncing ${pendingCount} pending changes...`);
          await syncManager.sync();
          console.log('✅ Sync completed');
        }
        
        // 2. THEN: Clean up temp IDs from previous offline sessions
        const { offlineStorage } = await import('@/lib/offlineStorage');
        const cleanup = await offlineStorage.cleanupTempIds();
        
        // 3. FINALLY: Invalidate queries to fetch fresh data from server (including newly synced items)
        console.log('🔄 Refreshing data from server...');
        await queryClient.invalidateQueries();
        
        // If cleanup removed temp IDs, invalidate again
        if (cleanup.needsRefresh) {
          console.log('🔄 Temp IDs removed - invalidating again');
          await queryClient.invalidateQueries();
        }
        
        console.log('✅ Online transition complete');
      }
    });

    const unsubscribe = syncManager.onStatusChange((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });

    // Register error callback for sync failures
    syncManager.onSyncError((title, description) => {
      toast({
        variant: 'destructive',
        title,
        description,
      });
    });

    // Initial pending count
    syncManager.getPendingCount().then(setPendingCount);

    return () => {
      unsubscribeOffline();
      unsubscribe();
    };
  }, [toast]);

  const handleSync = () => {
    syncManager.sync();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* PWA/Storage Status - only show if NOT persistent or NOT PWA on iOS */}
        {(isPWA || !isPersisted) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={isPersisted ? "outline" : "destructive"} 
                className="gap-1.5"
              >
                {isPWA ? '📱' : '🌐'} {isPersisted ? '✓' : '⚠️'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                {isPWA ? '📱 Running as PWA' : '🌐 Running in browser'}<br/>
                {isPersisted ? '✅ Storage is persistent' : '⚠️ Storage NOT persistent - data may be cleared!'}
                {!isPersisted && !isPWA && <><br/>💡 Add to Home Screen for persistent storage</>}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

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
