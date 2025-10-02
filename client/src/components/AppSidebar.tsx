import { Home, Package, Car, Hospital, FileText, Settings, BarChart } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  lowStockAlerts?: { home: number; car: number };
}

export default function AppSidebar({ 
  currentPath = '/', 
  onNavigate,
  lowStockAlerts = { home: 0, car: 0 }
}: AppSidebarProps) {
  const handleNavigation = (path: string) => {
    console.log('Navigating to:', path);
    onNavigate?.(path);
  };

  const mainItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
      active: currentPath === '/',
    },
    {
      title: "Home Inventory",
      url: "/inventory/home",
      icon: Package,
      active: currentPath === '/inventory/home',
      alert: lowStockAlerts.home > 0 ? lowStockAlerts.home : undefined,
    },
    {
      title: "Car Stock",
      url: "/inventory/car",
      icon: Car,
      active: currentPath === '/inventory/car',
      alert: lowStockAlerts.car > 0 ? lowStockAlerts.car : undefined,
    },
    {
      title: "Hospitals",
      url: "/hospitals",
      icon: Hospital,
      active: currentPath === '/hospitals',
    },
    {
      title: "Implant Reports",
      url: "/reports",
      icon: FileText,
      active: currentPath === '/reports',
    },
  ];

  const managementItems = [
    {
      title: "Products",
      url: "/products",
      icon: Package,
      active: currentPath === '/products',
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: BarChart,
      active: currentPath === '/analytics',
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      active: currentPath === '/settings',
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    data-active={item.active}
                    data-testid={`nav-${item.url.replace('/', '-')}`}
                  >
                    <a 
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(item.url);
                      }}
                      className="flex items-center justify-between w-full"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                      {item.alert && (
                        <Badge variant="destructive" className="text-xs">
                          {item.alert}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    data-active={item.active}
                    data-testid={`nav-${item.url.replace('/', '-')}`}
                  >
                    <a 
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(item.url);
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}