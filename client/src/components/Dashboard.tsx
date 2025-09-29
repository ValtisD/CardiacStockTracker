import { Package, Car, Hospital, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  homeStock: { total: number; lowStock: number };
  carStock: { total: number; lowStock: number };
  recentProcedures: number;
  expiringItems: number;
}

interface DashboardProps {
  stats?: DashboardStats;
}

// Todo: remove mock functionality
const mockStats: DashboardStats = {
  homeStock: { total: 156, lowStock: 8 },
  carStock: { total: 42, lowStock: 3 },
  recentProcedures: 12,
  expiringItems: 5
};

export default function Dashboard({ stats = mockStats }: DashboardProps) {
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
            <div className="text-2xl font-bold" data-testid="text-home-stock-total">
              {stats.homeStock.total}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats.homeStock.lowStock > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {stats.homeStock.lowStock} low stock
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
            <div className="text-2xl font-bold" data-testid="text-car-stock-total">
              {stats.carStock.total}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats.carStock.lowStock > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {stats.carStock.lowStock} low stock
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
            <div className="text-2xl font-bold" data-testid="text-recent-procedures">
              {stats.recentProcedures}
            </div>
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
            <div className="text-2xl font-bold" data-testid="text-expiring-items">
              {stats.expiringItems}
            </div>
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
      {(stats.homeStock.lowStock > 0 || stats.carStock.lowStock > 0) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.homeStock.lowStock > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Home inventory has {stats.homeStock.lowStock} items running low</span>
                  <Button size="sm" variant="destructive" data-testid="button-view-home-alerts">
                    View Items
                  </Button>
                </div>
              )}
              {stats.carStock.lowStock > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Car inventory needs restocking: {stats.carStock.lowStock} items</span>
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