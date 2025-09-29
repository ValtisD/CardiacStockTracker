import AppSidebar from '../AppSidebar';
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppSidebarExample() {
  const handleNavigate = (path: string) => {
    console.log('Navigating to:', path);
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-64 w-full border rounded-md">
        <AppSidebar 
          currentPath="/"
          onNavigate={handleNavigate}
          lowStockAlerts={{ home: 3, car: 2 }}
        />
      </div>
    </SidebarProvider>
  );
}