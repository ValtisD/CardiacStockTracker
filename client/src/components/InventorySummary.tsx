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
import type { Product } from "@shared/schema";

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
    queryKey: ["/api/inventory/summary", location],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/summary?location=${location}`);
      if (!response.ok) {
        throw new Error('Failed to fetch inventory summary');
      }
      return response.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Fetch low stock data to mark items
  const { data: lowStockData } = useQuery<{ product: Product }[]>({
    queryKey: ["/api/inventory/low-stock", location],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/low-stock?location=${location}`);
      if (!response.ok) {
        throw new Error('Failed to fetch low stock items');
      }
      return response.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const isLowStock = (productId: string): boolean => {
    return lowStockData?.some(item => item.product.id === productId) || false;
  };

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

  if (!summaryData || summaryData.length === 0) {
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
              <TableHead className="text-right">Total Quantity</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryData.map((item) => (
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
