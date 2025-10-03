import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Package, AlertTriangle, ArrowUpDown, Plus, Minus, Eye, Trash2, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import type { Inventory, Product } from "@shared/schema";

type InventoryWithProduct = Inventory & { product: Product };

interface InventoryTableProps {
  location: 'home' | 'car';
}

export default function InventoryTable({ location }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const { data: inventoryData, isLoading, error } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory", location],
    queryFn: async () => {
      const response = await fetch(`/api/inventory?location=${location}`);
      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }
      return response.json();
    },
  });

  // Fetch low stock items to determine which products are low
  const { data: lowStockData } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock", location],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/low-stock?location=${location}`);
      if (!response.ok) {
        throw new Error('Failed to fetch low stock items');
      }
      return response.json();
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ productId, fromLocation, toLocation, quantity }: { 
      productId: string; 
      fromLocation: string; 
      toLocation: string; 
      quantity: number;
    }) => {
      return await apiRequest('POST', '/api/stock-transfers', {
        productId,
        fromLocation,
        toLocation,
        quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Transfer successful",
        description: "Stock has been transferred successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer failed",
        description: error.message || "Failed to transfer stock. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { 
      id: string; 
      quantity: number;
    }) => {
      return await apiRequest('PATCH', `/api/inventory/item/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Quantity updated",
        description: "Inventory quantity has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update quantity. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { 
      id: string; 
    }) => {
      return await apiRequest('DELETE', `/api/inventory/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Item deleted",
        description: "Inventory item has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const transferItemMutation = useMutation({
    mutationFn: async ({ id, toLocation }: { 
      id: string; 
      toLocation: string;
    }) => {
      return await apiRequest('POST', `/api/inventory/item/${id}/transfer`, { toLocation });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Item transferred",
        description: "Item has been transferred successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer failed",
        description: error.message || "Failed to transfer item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const items = inventoryData || [];

  // Create a set of low stock product IDs for quick lookup
  const lowStockProductIds = new Set(
    (lowStockData || []).map(item => item.productId)
  );

  // Calculate aggregated totals by product for display
  const productAggregates = new Map<string, { totalQty: number; items: InventoryWithProduct[] }>();
  items.forEach(item => {
    if (!productAggregates.has(item.productId)) {
      productAggregates.set(item.productId, { totalQty: 0, items: [] });
    }
    const agg = productAggregates.get(item.productId)!;
    agg.totalQty += item.quantity;
    agg.items.push(item);
  });

  // Helper function to check if item is low stock
  const isLowStock = (item: InventoryWithProduct) => {
    return lowStockProductIds.has(item.productId);
  };

  const filteredItems = items
    .filter(item => 
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.modelNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.gtin.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'quantity') return a.quantity - b.quantity;
      if (sortBy === 'expiration') {
        const dateA = a.expirationDate || '9999';
        const dateB = b.expirationDate || '9999';
        return dateA < dateB ? -1 : 1;
      }
      return a.product.name.localeCompare(b.product.name);
    });

  const lowStockItems = filteredItems.filter(item => isLowStock(item));
  const stockLevel = filteredItems.length > 0 ? (filteredItems.reduce((sum, item) => sum + item.quantity, 0) / filteredItems.length) * 10 : 0;

  const handleQuantityChange = (item: InventoryWithProduct, direction: 'increase' | 'decrease') => {
    // Check if this is a serial-tracked item
    if (item.trackingMode === 'serial') {
      toast({
        title: "Cannot modify serial-tracked items",
        description: "Serial-tracked items have a fixed quantity of 1. Please delete or add individual items instead.",
        variant: "destructive",
      });
      return;
    }

    if (location === 'home') {
      const newQuantity = direction === 'increase' ? item.quantity + 1 : item.quantity - 1;
      
      if (newQuantity < 0) {
        toast({
          title: "Invalid quantity",
          description: "Quantity cannot be negative.",
          variant: "destructive",
        });
        return;
      }

      updateQuantityMutation.mutate({
        id: item.id,
        quantity: newQuantity,
      });
    } else {
      const toLocation = direction === 'increase' ? 'car' : 'home';
      const fromLocation = direction === 'increase' ? 'home' : 'car';

      if (direction === 'decrease' && item.quantity < 1) {
        toast({
          title: "Insufficient stock",
          description: "Not enough stock to transfer.",
          variant: "destructive",
        });
        return;
      }

      transferMutation.mutate({
        productId: item.productId,
        fromLocation,
        toLocation,
        quantity: 1,
      });
    }
  };

  const handleDelete = (item: InventoryWithProduct) => {
    const itemDescription = item.serialNumber 
      ? `${item.product.name} (Serial: ${item.serialNumber})`
      : `${item.product.name}`;
    
    if (window.confirm(`Are you sure you want to delete ${itemDescription} from ${location} inventory?`)) {
      deleteMutation.mutate({
        id: item.id,
      });
    }
  };

  const handleTransfer = (item: InventoryWithProduct) => {
    const toLocation = location === 'home' ? 'car' : 'home';
    const itemDescription = item.serialNumber 
      ? `${item.product.name} (Serial: ${item.serialNumber})`
      : item.lotNumber
      ? `${item.product.name} (Lot: ${item.lotNumber})`
      : `${item.product.name}`;
    
    if (window.confirm(`Move ${itemDescription} to ${toLocation}?`)) {
      transferItemMutation.mutate({
        id: item.id,
        toLocation,
      });
    }
  };

  const isExpiringSoon = (date?: string | Date | null) => {
    if (!date) return false;
    const expDate = new Date(date);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return expDate < threeMonthsFromNow;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load inventory. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {location === 'home' ? 'Home' : 'Car'} Inventory
              <Badge variant={lowStockItems.length > 0 ? 'destructive' : 'secondary'}>
                {filteredItems.length} items
              </Badge>
            </CardTitle>
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              data-testid="button-add-to-stock"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Stock
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Stock Level:</span>
            <Progress value={stockLevel} className="flex-1 max-w-32" />
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-inventory-search"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40" data-testid="select-sort-by">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="expiration">Expiration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} running low
                </span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Serial/Lot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-sm text-muted-foreground">{item.product.modelNumber}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={isLowStock(item) ? 'text-destructive font-medium' : ''}>
                          {item.quantity}
                        </span>
                        {isLowStock(item) && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total: {productAggregates.get(item.productId)?.totalQty || item.quantity} | 
                        Min: {location === 'car' ? item.product.minCarStock : item.product.minTotalStock}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.expirationDate && (
                        <div className={isExpiringSoon(item.expirationDate) ? 'text-destructive' : ''}>
                          {new Date(item.expirationDate).toLocaleDateString()}
                          {isExpiringSoon(item.expirationDate) && (
                            <div className="text-xs">Expiring Soon!</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.trackingMode === 'serial' && item.serialNumber && (
                        <div>S/N: {item.serialNumber}</div>
                      )}
                      {item.trackingMode === 'lot' && item.lotNumber && (
                        <div>Lot: {item.lotNumber}</div>
                      )}
                      {!item.trackingMode && !item.serialNumber && !item.lotNumber && (
                        <div className="text-muted-foreground/50">-</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleQuantityChange(item, 'decrease')}
                          disabled={
                            transferMutation.isPending || 
                            updateQuantityMutation.isPending || 
                            item.quantity < 1 ||
                            item.trackingMode === 'serial'
                          }
                          data-testid={`button-decrease-${item.id}`}
                          title={
                            item.trackingMode === 'serial' 
                              ? 'Cannot modify serial-tracked items' 
                              : (location === 'home' ? 'Decrease quantity' : 'Transfer to home')
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleQuantityChange(item, 'increase')}
                          disabled={
                            transferMutation.isPending || 
                            updateQuantityMutation.isPending ||
                            item.trackingMode === 'serial'
                          }
                          data-testid={`button-increase-${item.id}`}
                          title={
                            item.trackingMode === 'serial'
                              ? 'Cannot modify serial-tracked items'
                              : (location === 'home' ? 'Increase quantity' : 'Transfer from home')
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleTransfer(item)}
                          disabled={transferItemMutation.isPending}
                          data-testid={`button-transfer-${item.id}`}
                          title={`Move to ${location === 'home' ? 'car' : 'home'}`}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${item.id}`}
                          title="Delete item"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Inventory Dialog */}
      <AddInventoryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        location={location}
      />
    </div>
  );
}
