import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product, UserProductSettings } from "@shared/schema";

interface InventorySummary {
  product: Product;
  totalQuantity: number;
  location?: string;
}

interface InventorySummaryProps {
  location: 'home' | 'car';
}

export default function InventorySummary({ location }: InventorySummaryProps) {
  const { data: summaryData, isLoading } = useQuery<InventorySummary[]>({
    queryKey: [`/api/inventory/summary?location=${location}`],
    refetchOnWindowFocus: true,
  });

  // Fetch low stock data to mark items
  const { data: lowStockData } = useQuery<{ product: Product }[]>({
    queryKey: [`/api/inventory/low-stock?location=${location}`],
    refetchOnWindowFocus: true,
  });

  // Fetch user product settings to display minimum quantities
  const { data: userSettings } = useQuery<UserProductSettings[]>({
    queryKey: ['/api/user-product-settings'],
    refetchOnWindowFocus: true,
  });

  const isLowStock = (productId: string): boolean => {
    return lowStockData?.some(item => item.product.id === productId) || false;
  };

  const getMinQuantity = (productId: string): number => {
    const settings = userSettings?.find(s => s.productId === productId);
    if (!settings) return 0;
    // For car location, show minCarStock; for home location, show minTotalStock
    return location === 'car' ? settings.minCarStock : settings.minTotalStock;
  };

  // Filter: only show products with settings where minTotalStock > 0
  // Products without settings are hidden (new users don't see unconfigured products)
  const filteredSummaryData = summaryData?.filter(item => {
    const settings = userSettings?.find(s => s.productId === item.product.id);
    if (!settings) return false; // Hide products without settings
    return settings.minTotalStock > 0; // Only show products with minTotalStock > 0
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Stock by Model Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!filteredSummaryData || filteredSummaryData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Stock by Model Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No items in stock
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Stock by Model Number
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model Number</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Minimum</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSummaryData.map((item) => (
              <TableRow key={item.product.id} data-testid={`row-summary-${item.product.id}`}>
                <TableCell className="font-medium" data-testid={`text-model-${item.product.id}`}>
                  {item.product.modelNumber}
                </TableCell>
                <TableCell data-testid={`text-name-${item.product.id}`}>
                  {item.product.name}
                </TableCell>
                <TableCell className="text-right" data-testid={`text-quantity-${item.product.id}`}>
                  {item.totalQuantity}
                </TableCell>
                <TableCell className="text-right text-muted-foreground" data-testid={`text-min-quantity-${item.product.id}`}>
                  {getMinQuantity(item.product.id)}
                </TableCell>
                <TableCell className="text-right">
                  {isLowStock(item.product.id) ? (
                    <Badge variant="destructive" className="gap-1" data-testid={`badge-low-stock-${item.product.id}`}>
                      <AlertTriangle className="h-3 w-3" />
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge variant="secondary" data-testid={`badge-in-stock-${item.product.id}`}>
                      In Stock
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
