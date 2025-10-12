import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bug, X, Trash2, RefreshCw, Copy, WifiOff, Wifi } from 'lucide-react';
import { debugLogger, type LogEntry } from '@/lib/debugLogger';
import { offlineStorage } from '@/lib/offlineStorage';
import { queryClient } from '@/lib/queryClient';
import { offlineState } from '@/lib/offlineState';
import { useAuth0 } from '@auth0/auth0-react';

export function DebugPanel() {
  const { user, isAuthenticated } = useAuth0();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOffline, setIsOffline] = useState(offlineState.isOffline());
  const [stats, setStats] = useState({
    products: 0,
    inventory: 0,
    hospitals: 0,
    procedures: 0,
    syncQueue: 0
  });
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  useEffect(() => {
    // Load existing logs immediately
    setLogs(debugLogger.getLogs());
    
    // Subscribe to new logs
    const unsubscribe = debugLogger.subscribe((newLogs) => {
      console.log('🐛 Debug panel received new logs:', newLogs.length);
      setLogs(newLogs);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Subscribe to offline state changes
    const unsubscribe = offlineState.subscribe((offline) => {
      setIsOffline(offline);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      
      // Auto-refresh stats every 2 seconds when panel is open
      const interval = setInterval(loadStats, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  
  // Also refresh stats when logs change (in case caching happened)
  useEffect(() => {
    if (isOpen && logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog.message.includes('cached') || lastLog.message.includes('Loaded')) {
        loadStats();
      }
    }
  }, [logs, isOpen]);

  const loadStats = async () => {
    try {
      const [products, inventory, hospitals, procedures, syncQueue] = await Promise.all([
        offlineStorage.getProducts(),
        offlineStorage.getInventory(),
        offlineStorage.getHospitals(),
        offlineStorage.getProcedures(),
        offlineStorage.getSyncQueue() // Get ALL queue items regardless of userId
      ]);

      setStats({
        products: products?.length || 0,
        inventory: inventory?.length || 0,
        hospitals: hospitals?.length || 0,
        procedures: procedures?.length || 0,
        syncQueue: syncQueue?.length || 0
      });
      
      // Store queue items for display
      setQueueItems(syncQueue || []);
    } catch (e) {
      console.error('Failed to load debug stats:', e);
    }
  };

  const copyLogsToClipboard = async () => {
    try {
      const logsText = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelIcon = getLevelIcon(log.level);
        const dataStr = log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '';
        return `${timestamp} ${levelIcon} ${log.message}${dataStr}`;
      }).join('\n\n');

      await navigator.clipboard.writeText(logsText);
      debugLogger.success('📋 Logs copied to clipboard!');
    } catch (error) {
      debugLogger.error('Failed to copy logs', { error: String(error) });
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'error': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'warn': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      default: return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warn': return '⚠️';
      default: return '📝';
    }
  };

  if (!isOpen) {
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setIsOpen(true)}
        data-testid="button-debug-panel"
      >
        <Bug className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-4 z-50 flex items-end justify-end pointer-events-none">
      <div className="bg-background border rounded-lg shadow-2xl w-full max-w-2xl h-[600px] flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            <h3 className="font-semibold">Debug Logs</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isOffline ? "destructive" : "default"}
              onClick={() => {
                const newOfflineState = !isOffline;
                offlineState.setOffline(newOfflineState);
                debugLogger.info(newOfflineState ? '📴 FORCED OFFLINE MODE' : '🌐 FORCED ONLINE MODE');
              }}
              data-testid="button-toggle-offline"
            >
              {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={async () => {
                debugLogger.info('🔄 Clearing React Query cache and forcing refetch...');
                // Clear ALL cache first
                queryClient.clear();
                debugLogger.info('✅ Cache cleared, now refetching...');
                // Then refetch everything
                await queryClient.refetchQueries({ type: 'active' });
                debugLogger.success('✅ All queries refetched!');
              }}
              data-testid="button-reload-cache"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={copyLogsToClipboard}
              data-testid="button-copy-logs"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                debugLogger.clear();
                loadStats();
              }}
              data-testid="button-clear-logs"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-debug"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 border-b bg-muted/30">
          <div className="text-sm font-medium mb-2">IndexedDB Cache Status:</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="no-default-hover-elevate">
              Products: {stats.products}
            </Badge>
            <Badge variant="outline" className="no-default-hover-elevate">
              Inventory: {stats.inventory}
            </Badge>
            <Badge variant="outline" className="no-default-hover-elevate">
              Hospitals: {stats.hospitals}
            </Badge>
            <Badge variant="outline" className="no-default-hover-elevate">
              Procedures: {stats.procedures}
            </Badge>
            {stats.syncQueue > 0 && (
              <Badge variant="destructive" className="no-default-hover-elevate">
                Pending Sync: {stats.syncQueue}
              </Badge>
            )}
          </div>
          
          {/* Current User Info */}
          {isAuthenticated && user?.sub && (
            <div className="mt-3 p-2 bg-primary/10 rounded border border-primary/20">
              <div className="text-xs font-medium">🔐 Current Auth0 User:</div>
              <div className="text-xs font-mono mt-1">
                {user.sub}
              </div>
            </div>
          )}
          
          {/* Queue Items Details */}
          {queueItems.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-medium">🔄 Sync Queue Items:</div>
              {queueItems.map((item, idx) => {
                const isUserMatch = isAuthenticated && user?.sub === item.userId;
                return (
                  <div key={item.id} className={`text-xs p-2 rounded border ${
                    isUserMatch 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="font-mono">
                      <span className="text-muted-foreground">#{idx + 1}</span> {item.method} {item.endpoint}
                    </div>
                    <div className="text-muted-foreground mt-1">
                      userId: <span className="font-semibold">{item.userId?.substring(0, 30)}</span>
                      {isUserMatch ? ' ✅' : ' ❌ MISMATCH'}
                    </div>
                    <div className="text-muted-foreground">
                      retries: {item.retryCount} | {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No logs yet. Start using the app!
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md text-sm ${getLevelColor(log.level)}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base">{getLevelIcon(log.level)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">{log.message}</span>
                          <span className="text-xs opacity-60 whitespace-nowrap">
                            {formatTime(log.timestamp)}
                          </span>
                        </div>
                        {log.data !== undefined && (
                          <pre className="text-xs opacity-80 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
