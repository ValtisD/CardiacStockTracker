import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Package, AlertTriangle, ArrowUpDown, Plus, Minus, Eye, Trash2 } from "lucide-react";
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
import type { Inventory, Product } from "@shared/schema";

type InventoryWithProduct = Inventory & { product: Product };

interface InventoryTableProps {
  location: 'home' | 'car';
}

export default function InventoryTable({ location }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
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
    mutationFn: async ({ productId, location, quantity }: { 
      productId: string; 
      location: string; 
      quantity: number;
    }) => {
      return await apiRequest('PATCH', `/api/inventory/${productId}/${location}`, { quantity });
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
    mutationFn: async ({ productId, location }: { 
      productId: string; 
      location: string; 
    }) => {
      return await apiRequest('DELETE', `/api/inventory/${productId}/${location}`);
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

  const items = inventoryData || [];

  const filteredItems = items
    .filter(item => 
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.modelNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(item => categoryFilter === 'all' || item.product.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'quantity') return a.quantity - b.quantity;
      if (sortBy === 'expiration') {
        const dateA = a.product.expirationDate || '9999';
        const dateB = b.product.expirationDate || '9999';
        return dateA < dateB ? -1 : 1;
      }
      return a.product.name.localeCompare(b.product.name);
    });

  const lowStockItems = filteredItems.filter(item => item.quantity <= item.minStockLevel);
  const stockLevel = filteredItems.length > 0 ? (filteredItems.reduce((sum, item) => sum + item.quantity, 0) / filteredItems.length) * 10 : 0;

  const handleQuantityChange = (item: InventoryWithProduct, direction: 'increase' | 'decrease') => {
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
        productId: item.productId,
        location: item.location,
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
    if (window.confirm(`Are you sure you want to delete ${item.product.name} from ${location} inventory?`)) {
      deleteMutation.mutate({
        productId: item.productId,
        location: item.location,
      });
    }
  };

  const isExpiringSoon = (date?: string | null) => {
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
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {location === 'home' ? 'Home' : 'Car'} Inventory
            <Badge variant={lowStockItems.length > 0 ? 'destructive' : 'secondary'}>
              {filteredItems.length} items
            </Badge>
          </CardTitle>
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
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Device">Devices</SelectItem>
                <SelectItem value="Lead/Electrode">Leads/Electrodes</SelectItem>
                <SelectItem value="Material">Materials</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

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
                  <TableHead>Category</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">{item.product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={item.quantity <= item.minStockLevel ? 'text-destructive font-medium' : ''}>
                          {item.quantity}
                        </span>
                        {item.quantity <= item.minStockLevel && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Min: {item.minStockLevel}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.product.expirationDate && (
                        <div className={isExpiringSoon(item.product.expirationDate) ? 'text-destructive' : ''}>
                          {new Date(item.product.expirationDate).toLocaleDateString()}
                          {isExpiringSoon(item.product.expirationDate) && (
                            <div className="text-xs">Expiring Soon!</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.product.serialNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleQuantityChange(item, 'decrease')}
                          disabled={transferMutation.isPending || updateQuantityMutation.isPending || item.quantity < 1}
                          data-testid={`button-decrease-${item.id}`}
                          title={location === 'home' ? 'Decrease quantity' : 'Transfer to home'}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleQuantityChange(item, 'increase')}
                          disabled={transferMutation.isPending || updateQuantityMutation.isPending}
                          data-testid={`button-increase-${item.id}`}
                          title={location === 'home' ? 'Increase quantity' : 'Transfer from home'}
                        >
                          <Plus className="h-3 w-3" />
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
    </div>
  );
}
