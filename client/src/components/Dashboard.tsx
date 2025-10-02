import { Package, Car, Hospital, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Inventory, ImplantProcedure, Product } from "@shared/schema";

interface InventoryWithProduct extends Inventory {
  product?: Product;
}

export default function Dashboard() {
  const { data: homeInventory, isLoading: homeLoading, error: homeError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory", "home"],
    queryFn: async () => {
      const response = await fetch('/api/inventory?location=home');
      if (!response.ok) throw new Error('Failed to fetch home inventory');
      return response.json();
    },
  });

  const { data: carInventory, isLoading: carLoading, error: carError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory", "car"],
    queryFn: async () => {
      const response = await fetch('/api/inventory?location=car');
      if (!response.ok) throw new Error('Failed to fetch car inventory');
      return response.json();
    },
  });

  const { data: homeLowStock, isLoading: homeLowStockLoading, error: homeLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock", "home"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=home');
      if (!response.ok) throw new Error('Failed to fetch home low stock');
      return response.json();
    },
  });

  const { data: carLowStock, isLoading: carLowStockLoading, error: carLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock", "car"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=car');
      if (!response.ok) throw new Error('Failed to fetch car low stock');
      return response.json();
    },
  });

  const { data: procedures, isLoading: proceduresLoading, error: proceduresError } = useQuery<ImplantProcedure[]>({
    queryKey: ["/api/implant-procedures"],
  });

  const isLoading = homeLoading || carLoading || homeLowStockLoading || carLowStockLoading || proceduresLoading;
  const hasError = homeError || carError || homeLowStockError || carLowStockError || proceduresError;

  const homeStockTotal = homeInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const carStockTotal = carInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const homeLowStockCount = homeLowStock?.length || 0;
  const carLowStockCount = carLowStock?.length || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentProceduresCount = procedures?.filter(proc => {
    const procDate = new Date(proc.implantDate);
    return procDate >= thirtyDaysAgo;
  }).length || 0;

  const expiringItemsCount = 0;

  if (hasError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unable to load dashboard data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <Badge variant="secondary" data-testid="text-last-updated">
          Last updated: {new Date().toLocaleDateString()}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Home Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-home-stock-total">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-home-stock-total">
                {homeStockTotal}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isLoading ? (
                <span>Loading...</span>
              ) : homeLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {homeLowStockCount} low stock
                </Badge>
              ) : (
                <span className="text-green-600">All items in stock</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Car Stock</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-car-stock-total">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-car-stock-total">
                {carStockTotal}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isLoading ? (
                <span>Loading...</span>
              ) : carLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {carLowStockCount} low stock
                </Badge>
              ) : (
                <span className="text-green-600">All items ready</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Procedures</CardTitle>
            <Hospital className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-recent-procedures">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-recent-procedures">
                {recentProceduresCount}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-expiring-items">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-expiring-items">
                {expiringItemsCount}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Next 90 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="justify-start gap-2" data-testid="button-new-procedure">
            <Calendar className="h-4 w-4" />
            New Implant Report
          </Button>
          <Button variant="secondary" className="justify-start gap-2" data-testid="button-stock-transfer">
            <Package className="h-4 w-4" />
            Transfer Stock
          </Button>
          <Button variant="outline" className="justify-start gap-2" data-testid="button-scan-barcode">
            <Package className="h-4 w-4" />
            Scan Barcode
          </Button>
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {!isLoading && (homeLowStockCount > 0 || carLowStockCount > 0) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {homeLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Home inventory has {homeLowStockCount} items running low</span>
                  <Button size="sm" variant="destructive" data-testid="button-view-home-alerts">
                    View Items
                  </Button>
                </div>
              )}
              {carLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Car inventory needs restocking: {carLowStockCount} items</span>
                  <Button size="sm" variant="destructive" data-testid="button-view-car-alerts">
                    Restock Now
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
