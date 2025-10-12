import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bug, X, Trash2 } from 'lucide-react';
import { debugLogger, type LogEntry } from '@/lib/debugLogger';
import { offlineStorage } from '@/lib/offlineStorage';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    products: 0,
    inventory: 0,
    hospitals: 0,
    procedures: 0,
    syncQueue: 0
  });

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(setLogs);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      const [products, inventory, hospitals, procedures, syncQueue] = await Promise.all([
        offlineStorage.getProducts(),
        offlineStorage.getInventory(),
        offlineStorage.getHospitals(),
        offlineStorage.getProcedures(),
        offlineStorage.getSyncQueue()
      ]);

      setStats({
        products: products?.length || 0,
        inventory: inventory?.length || 0,
        hospitals: hospitals?.length || 0,
        procedures: procedures?.length || 0,
        syncQueue: syncQueue?.length || 0
      });
    } catch (e) {
      console.error('Failed to load debug stats:', e);
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
        </div>

        {/* Logs */}
        <ScrollArea className="flex-1">
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
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
