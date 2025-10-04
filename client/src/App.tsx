import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
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
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

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
      <span className="text-sm text-muted-foreground" data-testid="text-user-email">
        {user?.email}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {t('common.logout')}
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
        <Button
          onClick={() => loginWithRedirect()}
          size="lg"
          data-testid="button-login"
        >
          {t('app.loginButton')}
        </Button>
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      <ImplantReportForm 
        onSubmit={handleSubmitSuccess}
        onCancel={() => setShowNewReport(false)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">{t('procedures.title')}</h2>
        <Button onClick={() => setShowNewReport(true)} data-testid="button-new-report">
          {t('procedures.addProcedure')}
        </Button>
      </div>
      <ImplantProceduresList />
    </div>
  );
}

function ProductsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { user } = useAuth0();
  const { t } = useTranslation();
  
  const adminEmail = import.meta.env.VITE_AUTH0_ADMIN_EMAIL || import.meta.env.AUTH0_ADMIN_EMAIL;
  const isAdmin = user?.email === adminEmail;

  const handleSubmitSuccess = () => {
    setShowAddForm(false);
  };

  if (showAddForm) {
    return (
      <div className="p-6">
        <ProductForm 
          onSuccess={handleSubmitSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">{t('products.title')}</h2>
        {isAdmin && (
          <Button onClick={() => setShowAddForm(true)} data-testid="button-add-product">
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
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">{t('analytics.title')}</h2>
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
  const { isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [tokenReady, setTokenReady] = useState(false);

  // Set up token provider for API requests and verify it works
  useEffect(() => {
    if (isAuthenticated) {
      const setupToken = async () => {
        try {
          // First, get the token to ensure Auth0 is ready
          await getAccessTokenSilently();
          
          // Then set up the token provider
          setTokenProvider(async () => {
            try {
              return await getAccessTokenSilently();
            } catch (error) {
              console.error("Failed to get access token:", error);
              throw error;
            }
          });
          
          setTokenReady(true);
        } catch (error) {
          console.error("Failed to initialize token:", error);
        }
      };
      
      setupToken();
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
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
  
  // Sync user's language preference from backend
  useLanguageSync();

  // Check if user is admin via API
  const { data: currentUser } = useQuery<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean }>({
    queryKey: ["/api/user/me"],
  });

  const isAdmin = currentUser?.isAdmin || false;

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
            <header className="flex items-center justify-between p-4 border-b border-card-border bg-card">
              <div className="flex items-center gap-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">CRM Inventory</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
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
