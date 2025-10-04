import { Home, Package, Car, Hospital, FileText, Settings, BarChart, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface AppSidebarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  lowStockAlerts?: { home: number; car: number };
  isAdmin?: boolean;
}

export default function AppSidebar({ 
  currentPath = '/', 
  onNavigate,
  lowStockAlerts = { home: 0, car: 0 },
  isAdmin = false
}: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { t } = useTranslation();

  const handleNavigation = (path: string) => {
    console.log('Navigating to:', path);
    onNavigate?.(path);
    
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const mainItems = [
    {
      title: t('sidebar.dashboard'),
      url: "/",
      icon: Home,
      active: currentPath === '/',
    },
    {
      title: t('sidebar.homeInventory'),
      url: "/inventory/home",
      icon: Package,
      active: currentPath === '/inventory/home',
      alert: lowStockAlerts.home > 0 ? lowStockAlerts.home : undefined,
    },
    {
      title: t('sidebar.carStock'),
      url: "/inventory/car",
      icon: Car,
      active: currentPath === '/inventory/car',
      alert: lowStockAlerts.car > 0 ? lowStockAlerts.car : undefined,
    },
    {
      title: t('sidebar.hospitals'),
      url: "/hospitals",
      icon: Hospital,
      active: currentPath === '/hospitals',
    },
    {
      title: t('sidebar.implantReports'),
      url: "/reports",
      icon: FileText,
      active: currentPath === '/reports',
    },
  ];

  const managementItems = [
    {
      title: t('sidebar.products'),
      url: "/products",
      icon: Package,
      active: currentPath === '/products',
    },
    {
      title: t('sidebar.analytics'),
      url: "/analytics",
      icon: BarChart,
      active: currentPath === '/analytics',
    },
    {
      title: t('sidebar.settings'),
      url: "/settings",
      icon: Settings,
      active: currentPath === '/settings',
    },
  ];

  // Add User Management for admins only
  const adminItems = isAdmin ? [
    {
      title: t('sidebar.userManagement'),
      url: "/users",
      icon: Users,
      active: currentPath === '/users',
    },
  ] : [];

  return (
    <Sidebar>
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>{t('sidebar.navigation')}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{t('sidebar.management')}</SidebarGroupLabel>
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

        {/* Admin Section */}
        {isAdmin && adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('sidebar.admin')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}