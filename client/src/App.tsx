import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient, setTokenProvider } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut } from "lucide-react";
import type { Inventory } from "@shared/schema";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useTranslation } from "react-i18next";

// Components
import AppHeader from "@/components/AppHeader";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "@/components/Dashboard";
import InventoryTable from "@/components/InventoryTable";
import InventorySummary from "@/components/InventorySummary";
import ProductForm from "@/components/ProductForm";
import ProductsList from "@/components/ProductsList";
import HospitalManager from "@/components/HospitalManager";
import ImplantReportForm from "@/components/ImplantReportForm";
import ImplantProceduresList from "@/components/ImplantProceduresList";
import UserProductSettings from "@/components/UserProductSettings";
import UserManagement from "@/components/UserManagement";
import OfflineIndicator from "@/components/OfflineIndicator";
import { DebugPanel } from "@/components/DebugPanel";
import Settings from "@/pages/Settings";
import RegistrationGate from "@/pages/RegistrationGate";
import StockOverview from "@/pages/StockOverview";
import NotFound from "@/pages/not-found";
import { syncManager } from "@/lib/syncManager";
import { debugLogger } from "@/lib/debugLogger";
import { offlineStorage } from "@/lib/offlineStorage";

// Theme toggle component
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
    console.log('Theme toggled:', !isDark ? 'dark' : 'light');
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

// User menu component
function UserMenu() {
  const { user, logout } = useAuth0();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden md:block" data-testid="text-user-email">
        {user?.email}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">{t('common.logout')}</span>
      </Button>
    </div>
  );
}

// Login page
function LoginPage() {
  const { loginWithRedirect } = useAuth0();
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        <h1 className="text-4xl font-bold">{t('app.title')}</h1>
        <p className="text-muted-foreground">
          {t('app.description')}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => loginWithRedirect()}
            size="lg"
            data-testid="button-login"
          >
            {t('app.loginButton')}
          </Button>
          <Link href="/register">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              data-testid="button-signup"
            >
              {t('app.signupButton')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main pages
function HomePage() {
  return <Dashboard />;
}

function HomeInventoryPage() {
  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <InventoryTable location="home" />
        </div>
        <div>
          <InventorySummary location="home" />
        </div>
      </div>
    </div>
  );
}

function CarInventoryPage() {
  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <InventoryTable location="car" />
        </div>
        <div>
          <InventorySummary location="car" />
        </div>
      </div>
    </div>
  );
}

function HospitalsPage() {
  return <HospitalManager />;
}

function ImplantReportsPage() {
  const [showNewReport, setShowNewReport] = useState(false);
  const { t } = useTranslation();

  const handleSubmitSuccess = () => {
    setShowNewReport(false);
  };

  if (showNewReport) {
    return (
      <div className="p-3 md:p-6">
        <ImplantReportForm 
          onSubmit={handleSubmitSuccess}
          onCancel={() => setShowNewReport(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold">{t('procedures.title')}</h2>
        <Button onClick={() => setShowNewReport(true)} data-testid="button-new-report" className="w-full sm:w-auto">
          {t('procedures.addProcedure')}
        </Button>
      </div>
      <ImplantProceduresList />
    </div>
  );
}

function ProductsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { t } = useTranslation();

  const { data: currentUser } = useQuery<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean }>({
    queryKey: ["/api/user/me"],
  });

  const isAdmin = currentUser?.isAdmin || false;

  const handleSubmitSuccess = () => {
    setShowAddForm(false);
  };

  if (showAddForm) {
    return (
      <div className="p-3 md:p-6">
        <ProductForm 
          onSuccess={handleSubmitSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold">{t('products.title')}</h2>
        {isAdmin && (
          <Button onClick={() => setShowAddForm(true)} data-testid="button-add-product" className="w-full sm:w-auto">
            {t('products.addProduct')}
          </Button>
        )}
      </div>
      <ProductsList />
    </div>
  );
}

function AnalyticsPage() {
  const { t } = useTranslation();
  
  return (
    <div className="p-3 md:p-6">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">{t('analytics.title')}</h2>
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('analytics.comingSoon')}</p>
        <p className="text-sm mt-2">{t('analytics.description')}</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  return <Settings />;
}

function UserManagementPage() {
  return <UserManagement />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/inventory/home" component={HomeInventoryPage} />
      <Route path="/inventory/car" component={CarInventoryPage} />
      <Route path="/stock-overview" component={StockOverview} />
      <Route path="/hospitals" component={HospitalsPage} />
      <Route path="/reports" component={ImplantReportsPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/users" component={UserManagementPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated, getAccessTokenSilently, logout, user } = useAuth0();
  const [tokenReady, setTokenReady] = useState(false);
  const [location] = useLocation();
  const [validatingRegistration, setValidatingRegistration] = useState(false);

  // Verify registration token for new signups
  useEffect(() => {
    const verifyRegistration = async () => {
      // Check URL for registration completion
      const params = new URLSearchParams(window.location.search);
      const hasAuthCode = params.has('code');
      const validationToken = sessionStorage.getItem('registration_validation_token');
      
      // If we just came back from Auth0 with a code and have a validation token, verify it
      if (hasAuthCode && validationToken && isAuthenticated) {
        setValidatingRegistration(true);
        
        try {
          // Get Auth0 access token for authenticated request
          const accessToken = await getAccessTokenSilently();
          
          const response = await fetch('/api/auth/verify-registration-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`, // SECURITY: Authenticate request with JWT
            },
            body: JSON.stringify({ 
              token: validationToken,
              // SECURITY: userId now comes from JWT on server, not from client
            }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.valid) {
            console.error('Invalid registration - token verification failed:', data.error);
            // Clear session storage
            sessionStorage.clear();
            // Logout and redirect
            await logout({ 
              logoutParams: { 
                returnTo: `${window.location.origin}/?error=invalid_registration` 
              } 
            });
            return;
          }
          
          // Validation successful - clear the token
          sessionStorage.removeItem('registration_validation_token');
          console.log('Registration validated successfully');
          
          // Clear the code parameter from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Error verifying registration token:', error);
          sessionStorage.clear();
          await logout({ 
            logoutParams: { 
              returnTo: `${window.location.origin}/?error=registration_verification_failed` 
            } 
          });
          return;
        } finally {
          setValidatingRegistration(false);
        }
      }
    };
    
    if (isAuthenticated) {
      verifyRegistration();
    }
  }, [isAuthenticated, logout]);

  // Set up token provider for API requests and verify it works
  useEffect(() => {
    // CRITICAL: Wait for user?.sub to be available (Auth0 can set isAuthenticated before user is ready)
    if (isAuthenticated && !validatingRegistration && user?.sub) {
      const setupToken = async () => {
        // CRITICAL: Set userId FIRST (before any async operations that might fail)
        // This ensures offline queue works even if token fetch fails
        syncManager.setUserId(user.sub!);
        
        try {
          // Then try to get the token to ensure Auth0 is ready
          await getAccessTokenSilently();
          
          // Set up the token provider
          setTokenProvider(async () => {
            try {
              return await getAccessTokenSilently();
            } catch (error) {
              console.error("Failed to get access token:", error);
              throw error;
            }
          });
          
          // CRITICAL: Check for pending sync items AFTER token is set
          // This ensures sync has auth token to work with
          await syncManager.checkInitialSync();
        } catch (error) {
          console.error("Failed to initialize token:", error);
          // CRITICAL: Even if token fetch fails (offline), set tokenReady=true
          // so app remains usable in offline mode with userId already set
        } finally {
          // ALWAYS set tokenReady, even on error (enables offline mode)
          setTokenReady(true);
        }
      };
      
      setupToken();
    } else if (!isAuthenticated) {
      // CRITICAL: Clear userId on logout to prevent wrong user's data being synced
      syncManager.setUserId(null);
      setTokenReady(false);
    }
  }, [isAuthenticated, getAccessTokenSilently, validatingRegistration, user]);

  // iOS PWA Resume Handlers (pageshow/visibilitychange)
  // These catch iOS-specific events when app resumes from background or network changes
  useEffect(() => {
    const handlePageShow = async (event: PageTransitionEvent) => {
      // persisted=true means page was loaded from bfcache (back-forward cache)
      // This happens on iOS when resuming the PWA
      if (event.persisted) {
        try {
          debugLogger.info('📱 pageshow (bfcache) - iOS PWA resumed, checking sync state');
          const syncState = await offlineStorage.getSyncState();
          if (syncState?.needsSync && isAuthenticated && user?.sub) {
            debugLogger.info('🔄 Resume sync: Found pending sync state', { reason: syncState.reason });
            await syncManager.checkInitialSync();
          }
        } catch (error) {
          debugLogger.error('❌ pageshow handler error', error);
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          debugLogger.info('👁️ visibilitychange - App visible, checking sync state');
          const syncState = await offlineStorage.getSyncState();
          if (syncState?.needsSync && isAuthenticated && user?.sub) {
            debugLogger.info('🔄 Visibility sync: Found pending sync state', { reason: syncState.reason });
            await syncManager.checkInitialSync();
          }
        } catch (error) {
          debugLogger.error('❌ visibilitychange handler error', error);
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user]);

  if (isLoading || validatingRegistration) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {validatingRegistration ? 'Verifying registration...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Allow access to registration gate without authentication
    if (location === '/register') {
      return <RegistrationGate />;
    }
    return <LoginPage />;
  }

  if (!tokenReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Setting up authentication...</p>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [currentPath, setCurrentPath] = useState('/');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { getAccessTokenSilently } = useAuth0();
  
  // Sync user's language preference from backend
  useLanguageSync();

  // Check if user is admin via API
  const { data: currentUser } = useQuery<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean }>({
    queryKey: ["/api/user/me"],
  });

  const isAdmin = currentUser?.isAdmin || false;
  const isPrimeAdmin = currentUser?.isPrimeAdmin || false;

  // CRITICAL: Sync pending offline changes IMMEDIATELY on app start (before any queries run)
  // This runs ONCE when component mounts, BEFORE currentUser is even loaded
  useEffect(() => {
    const syncPendingChanges = async () => {
      // Detect if running as PWA
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone ||
                    document.referrer.includes('android-app://');
      
      // Only run if online
      if (!navigator.onLine && !isPWA) return;
      
      try {
        const { debugLogger } = await import('./lib/debugLogger');
        const { syncManager } = await import('./lib/syncManager');
        
        // CRITICAL: Check if there are pending offline changes from before app reload
        const pendingCount = await syncManager.getPendingCount();
        if (pendingCount > 0) {
          debugLogger.info(`🔄 APP START: Found ${pendingCount} pending changes - syncing NOW before loading data...`);
          await syncManager.sync();
          debugLogger.success(`✅ ${pendingCount} offline changes synced to server!`);
        } else {
          debugLogger.info('ℹ️ APP START: No pending changes to sync');
        }
      } catch (error) {
        console.error('Failed to sync pending changes on app start:', error);
      }
    };

    syncPendingChanges();
  }, []); // Empty deps - runs ONCE on mount

  // Preload offline data when authenticated and online
  useEffect(() => {
    const preloadData = async () => {
      if (!currentUser) return;
      
      // Detect if running as PWA
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone ||
                    document.referrer.includes('android-app://');
      
      if (isPWA) {
        console.log('📱 Running as PWA - caching fresh data...');
      }
      
      // Cache data if online (or in PWA mode where navigator.onLine might be unreliable)
      if (navigator.onLine || isPWA) {
        try {
          const { debugLogger } = await import('./lib/debugLogger');
          debugLogger.info('Auto-caching data for offline use...');
          
          const getAuthHeaders = async () => {
            const token = await getAccessTokenSilently();
            return {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            };
          };
          
          const { syncManager } = await import('./lib/syncManager');
          await syncManager.refreshData(getAuthHeaders);
          
          debugLogger.success('All data cached! You can now work offline.');
        } catch (error) {
          const { debugLogger } = await import('./lib/debugLogger');
          debugLogger.error('Failed to preload offline data', { error: error instanceof Error ? error.message : String(error) });
        }
      }
    };

    preloadData();
  }, [currentUser, getAccessTokenSilently]);

  // Fetch real low stock data from backend
  const { data: homeLowStock } = useQuery<Inventory[]>({
    queryKey: ["/api/inventory/low-stock?location=home"],
    refetchOnWindowFocus: true,
  });

  const { data: carLowStock } = useQuery<Inventory[]>({
    queryKey: ["/api/inventory/low-stock?location=car"],
    refetchOnWindowFocus: true,
  });

  const lowStockAlerts = {
    home: homeLowStock?.length || 0,
    car: carLowStock?.length || 0,
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    console.log('Navigated to:', path);
  };

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
    console.log('Sidebar toggled');
  };

  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <TooltipProvider>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar 
            currentPath={currentPath}
            onNavigate={handleNavigate}
            lowStockAlerts={lowStockAlerts}
            isAdmin={isAdmin}
          />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-2 md:p-4 border-b border-card-border bg-card">
              <div className="flex items-center gap-2 md:gap-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <h1 className="text-lg md:text-xl font-semibold">CRM Inventory</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-1 md:gap-2">
                <OfflineIndicator />
                <UserMenu />
                <ThemeToggle />
              </div>
            </header>
            
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
      {isPrimeAdmin && <DebugPanel />}
    </TooltipProvider>
  );
}

export default function App() {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId || !audience) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <h2 className="text-2xl font-semibold text-destructive">Configuration Error</h2>
          <p className="text-muted-foreground">
            Auth0 configuration is missing. Please set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </Auth0Provider>
  );
}
