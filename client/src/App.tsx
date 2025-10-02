import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import type { Inventory } from "@shared/schema";

// Components
import AppHeader from "@/components/AppHeader";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "@/components/Dashboard";
import InventoryTable from "@/components/InventoryTable";
import ProductForm from "@/components/ProductForm";
import HospitalManager from "@/components/HospitalManager";
import ImplantReportForm from "@/components/ImplantReportForm";
import BarcodeScanner from "@/components/BarcodeScanner";
import StockTransfer from "@/components/StockTransfer";
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

// Main pages
function HomePage() {
  return <Dashboard />;
}

function HomeInventoryPage() {
  return <InventoryTable location="home" />;
}

function CarInventoryPage() {
  return <InventoryTable location="car" />;
}

function HospitalsPage() {
  return <HospitalManager />;
}

function ImplantReportsPage() {
  const [showNewReport, setShowNewReport] = useState(false);

  const handleSubmitReport = (data: any) => {
    console.log('Implant report submitted:', data);
    setShowNewReport(false);
  };

  if (showNewReport) {
    return (
      <ImplantReportForm 
        onSubmit={handleSubmitReport}
        onCancel={() => setShowNewReport(false)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Implant Reports</h2>
        <Button onClick={() => setShowNewReport(true)} data-testid="button-new-report">
          New Report
        </Button>
      </div>
      <div className="text-center py-12 text-muted-foreground">
        <p>Implant reports will be displayed here.</p>
        <p className="text-sm mt-2">Click "New Report" to create your first implant procedure report.</p>
      </div>
    </div>
  );
}

function ProductsPage() {
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmitProduct = (data: any) => {
    console.log('Product submitted:', data);
    setShowAddForm(false);
  };

  if (showAddForm) {
    return (
      <div className="p-6">
        <ProductForm 
          onSubmit={handleSubmitProduct}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Product Management</h2>
        <Button onClick={() => setShowAddForm(true)} data-testid="button-add-product">
          Add Product
        </Button>
      </div>
      <div className="text-center py-12 text-muted-foreground">
        <p>Product catalog will be displayed here.</p>
        <p className="text-sm mt-2">Click "Add Product" to add medical devices to your inventory.</p>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Analytics & Reports</h2>
      <div className="text-center py-12 text-muted-foreground">
        <p>Analytics dashboard will be displayed here.</p>
        <p className="text-sm mt-2">View usage patterns, inventory trends, and procedure statistics.</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <div className="text-center py-12 text-muted-foreground">
        <p>Application settings will be displayed here.</p>
        <p className="text-sm mt-2">Configure preferences, notifications, and system settings.</p>
      </div>
    </div>
  );
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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [currentPath, setCurrentPath] = useState('/');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showStockTransfer, setShowStockTransfer] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Fetch real low stock data from backend
  const { data: homeLowStock } = useQuery<Inventory[]>({
    queryKey: ["/api/inventory/low-stock", "home"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=home');
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: carLowStock } = useQuery<Inventory[]>({
    queryKey: ["/api/inventory/low-stock", "car"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=car');
      if (!response.ok) return [];
      return response.json();
    },
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

  const handleStockTransfer = (transfer: any) => {
    console.log('Stock transfer completed:', transfer);
    setShowStockTransfer(false);
  };

  const handleScanComplete = (barcode: string, productInfo?: any) => {
    console.log('Barcode scan completed:', barcode, productInfo);
    setShowBarcodeScanner(false);
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStockTransfer(true)}
                  data-testid="button-quick-transfer"
                >
                  Quick Transfer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBarcodeScanner(true)}
                  data-testid="button-quick-scan"
                >
                  Quick Scan
                </Button>
                <ThemeToggle />
              </div>
            </header>
            
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>

        {/* Global Modals */}
        <StockTransfer 
          onTransfer={handleStockTransfer}
          onCancel={() => setShowStockTransfer(false)}
        />
        
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScanComplete={handleScanComplete}
          title="Quick Barcode Scan"
        />
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}