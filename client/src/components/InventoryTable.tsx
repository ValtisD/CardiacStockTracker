import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Search, Package, AlertTriangle, ArrowUpDown, Plus, Minus, Eye, Trash2, ArrowLeftRight, MoreVertical, Barcode, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import type { Inventory, Product, UserProductSettings } from "@shared/schema";

type InventoryWithProduct = Inventory & { product: Product };

interface InventoryTableProps {
  location: 'home' | 'car';
}

export default function InventoryTable({ location }: InventoryTableProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferItem, setTransferItem] = useState<InventoryWithProduct | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryWithProduct | null>(null);
  const [deleteQuantity, setDeleteQuantity] = useState<string>('');
  const { toast } = useToast();

  const { data: inventoryData, isLoading, error } = useQuery<InventoryWithProduct[]>({
    queryKey: [`/api/inventory?location=${location}`],
    refetchOnWindowFocus: true,
  });

  // Fetch low stock items to determine which products are low
  const { data: lowStockData } = useQuery<InventoryWithProduct[]>({
    queryKey: [`/api/inventory/low-stock?location=${location}`],
    refetchOnWindowFocus: true,
  });

  // Fetch user product settings to display minimum quantities
  const { data: userSettings } = useQuery<UserProductSettings[]>({
    queryKey: ['/api/user-product-settings'],
    refetchOnWindowFocus: true,
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
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      toast({
        title: t('inventory.transferSuccess'),
        description: t('inventory.transferSuccessDescription'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('inventory.transferFailed'),
        description: error.message || t('inventory.transferFailedDescription'),
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
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      toast({
        title: t('inventory.quantityUpdated'),
        description: t('inventory.quantityUpdatedDescription'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('inventory.updateFailed'),
        description: error.message || t('inventory.updateFailedDescription'),
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
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      toast({
        title: t('inventory.itemDeleted'),
        description: t('inventory.itemDeletedDescription'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('inventory.deleteFailed'),
        description: error.message || t('inventory.deleteFailedDescription'),
        variant: "destructive",
      });
    },
  });

  const transferItemMutation = useMutation({
    mutationFn: async ({ id, toLocation, quantity }: { 
      id: string; 
      toLocation: string;
      quantity?: number;
    }) => {
      return await apiRequest('POST', `/api/inventory/item/${id}/transfer`, { 
        toLocation,
        ...(quantity !== undefined && { quantity })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      setShowTransferDialog(false);
      setTransferItem(null);
      setTransferQuantity('');
      toast({
        title: t('inventory.itemTransferred'),
        description: t('inventory.itemTransferredDescription'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('inventory.transferFailed'),
        description: error.message || t('inventory.transferFailedDescription'),
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

  // Helper function to get minimum quantity from user settings
  const getMinQuantity = (productId: string): number => {
    const settings = userSettings?.find(s => s.productId === productId);
    if (!settings) return 0;
    // For car location, show minCarStock; for home location, show minTotalStock
    return location === 'car' ? settings.minCarStock : settings.minTotalStock;
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

  const handleQuantityChange = (item: InventoryWithProduct, direction: 'increase' | 'decrease') => {
    // Check if this is a serial-tracked item
    if (item.trackingMode === 'serial') {
      toast({
        title: t('inventory.cannotModifySerial'),
        description: t('inventory.cannotModifySerialDescription'),
        variant: "destructive",
      });
      return;
    }

    if (location === 'home') {
      const newQuantity = direction === 'increase' ? item.quantity + 1 : item.quantity - 1;
      
      if (newQuantity < 0) {
        toast({
          title: t('inventory.invalidQuantity'),
          description: t('inventory.invalidQuantityDescription'),
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
          title: t('inventory.insufficientStock'),
          description: t('inventory.insufficientStockDescription'),
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
    // For serial-tracked items (always qty 1), delete directly
    if (item.trackingMode === 'serial') {
      const itemDescription = item.serialNumber 
        ? `${item.product.name} (${t('inventory.serial')}: ${item.serialNumber})`
        : `${item.product.name}`;
      
      if (window.confirm(t('inventory.confirmDelete', { item: itemDescription, location }))) {
        deleteMutation.mutate({
          id: item.id,
        });
      }
      return;
    }

    // For lot-tracked or untracked items, show quantity dialog
    setDeleteItem(item);
    setDeleteQuantity(item.quantity.toString());
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteItem) return;

    const qtyToDelete = parseInt(deleteQuantity);
    
    if (isNaN(qtyToDelete) || qtyToDelete <= 0) {
      toast({
        title: t('inventory.invalidQuantity'),
        description: t('inventory.invalidQuantityDescription'),
        variant: "destructive",
      });
      return;
    }

    if (qtyToDelete > deleteItem.quantity) {
      toast({
        title: t('inventory.invalidQuantity'),
        description: t('inventory.invalidQuantityRange', { max: deleteItem.quantity }),
        variant: "destructive",
      });
      return;
    }

    // If deleting full quantity, delete the item
    if (qtyToDelete === deleteItem.quantity) {
      deleteMutation.mutate({ id: deleteItem.id });
      setShowDeleteDialog(false);
      setDeleteItem(null);
      setDeleteQuantity('');
    } else {
      // If deleting partial quantity, update the quantity
      const newQuantity = deleteItem.quantity - qtyToDelete;
      updateQuantityMutation.mutate(
        { id: deleteItem.id, quantity: newQuantity },
        {
          onSuccess: () => {
            setShowDeleteDialog(false);
            setDeleteItem(null);
            setDeleteQuantity('');
            toast({
              title: t('inventory.quantityReduced'),
              description: t('inventory.quantityReducedDescription', { 
                removed: qtyToDelete, 
                remaining: newQuantity 
              }),
            });
          }
        }
      );
    }
  };

  const handleTransfer = (item: InventoryWithProduct) => {
    const toLocation = location === 'home' ? 'car' : 'home';
    
    // For lot-tracked items with quantity > 1, show dialog to ask for quantity
    if (item.trackingMode === 'lot' && item.quantity > 1) {
      setTransferItem(item);
      setTransferQuantity(String(item.quantity));
      setShowTransferDialog(true);
    } else {
      // For serial-tracked items or lot items with quantity = 1, transfer directly
      const itemDescription = item.serialNumber 
        ? `${item.product.name} (${t('inventory.serial')}: ${item.serialNumber})`
        : item.lotNumber
        ? `${item.product.name} (${t('inventory.lot')}: ${item.lotNumber})`
        : `${item.product.name}`;
      
      if (window.confirm(t('inventory.confirmMove', { item: itemDescription, location: toLocation }))) {
        transferItemMutation.mutate({
          id: item.id,
          toLocation,
        });
      }
    }
  };

  const handleConfirmTransfer = () => {
    if (!transferItem) return;
    
    const quantity = parseInt(transferQuantity);
    if (isNaN(quantity) || quantity <= 0 || quantity > transferItem.quantity) {
      toast({
        title: t('inventory.invalidQuantity'),
        description: t('inventory.invalidQuantityRange', { max: transferItem.quantity }),
        variant: "destructive",
      });
      return;
    }

    const toLocation = location === 'home' ? 'car' : 'home';
    transferItemMutation.mutate({
      id: transferItem.id,
      toLocation,
      quantity,
    });
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
            <p>{t('inventory.loadError')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>
                {location === 'home' ? t('inventory.homeStock') : t('inventory.carStock')}
              </CardTitle>
              <Badge variant={lowStockItems.length > 0 ? 'destructive' : 'secondary'}>
                {filteredItems.length}
              </Badge>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              data-testid="button-add-to-stock"
            >
              <Plus className="h-4 w-4 mr-2" />
              {location === 'home' ? t('inventory.addToHome') : t('inventory.addToCar')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('inventory.searchProducts')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-inventory-search"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40" data-testid="select-sort-by">
                <SelectValue placeholder={t('inventory.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('inventory.sortByName')}</SelectItem>
                <SelectItem value="quantity">{t('inventory.sortByQuantity')}</SelectItem>
                <SelectItem value="expiration">{t('inventory.sortByExpiration')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">
                  {t('inventory.itemsRunningLow', { count: lowStockItems.length })}
                </span>
              </div>
            </div>
          )}

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-3" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : (
              filteredItems.map((item) => (
                <Card key={item.id} data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h3 className="font-semibold truncate">{item.product.name}</h3>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{item.product.name}</p>
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-sm text-muted-foreground">{item.product.modelNumber}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-menu-${item.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTransfer(item)}
                            disabled={transferItemMutation.isPending}
                            data-testid={`menu-transfer-${item.id}`}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-2" />
                            {t('inventory.moveTo', { location: location === 'home' ? t('inventory.car') : t('inventory.home') })}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            disabled={deleteMutation.isPending}
                            className="text-destructive"
                            data-testid={`menu-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('inventory.quantity')}:</span>
                        <div className="flex items-center gap-2">
                          <span className={isLowStock(item) ? 'text-destructive font-medium' : 'font-medium'}>
                            {item.quantity}
                          </span>
                          {isLowStock(item) && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('inventory.total')}: {productAggregates.get(item.productId)?.totalQty || item.quantity} | 
                        {t('inventory.min')}: {getMinQuantity(item.productId)}
                      </div>
                      
                      {item.expirationDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{t('inventory.expiration')}:</span>
                          <span className={isExpiringSoon(item.expirationDate) ? 'text-destructive text-xs' : 'text-xs'}>
                            {new Date(item.expirationDate).toLocaleDateString()}
                            {isExpiringSoon(item.expirationDate) && ` (${t('inventory.expiringSoon')})`}
                          </span>
                        </div>
                      )}
                      
                      {(item.serialNumber || item.lotNumber) && (
                        <div className="flex items-center gap-2 pt-1 border-t">
                          <Barcode className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {item.trackingMode === 'serial' && item.serialNumber && `${t('inventory.serialPrefix')}: ${item.serialNumber}`}
                            {item.trackingMode === 'lot' && item.lotNumber && `${t('inventory.lotPrefix')}: ${item.lotNumber}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.product')}</TableHead>
                  <TableHead className="text-center">{t('inventory.quantity')}</TableHead>
                  <TableHead>{t('inventory.expiration')}</TableHead>
                  <TableHead>{t('inventory.serialLot')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                    <TableCell className="max-w-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <div className="font-medium truncate">{item.product.name}</div>
                            <div className="text-sm text-muted-foreground">{item.product.modelNumber}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.product.name}</p>
                        </TooltipContent>
                      </Tooltip>
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
                        {t('inventory.total')}: {productAggregates.get(item.productId)?.totalQty || item.quantity} | 
                        {t('inventory.min')}: {getMinQuantity(item.productId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.expirationDate && (
                        <div className={isExpiringSoon(item.expirationDate) ? 'text-destructive' : ''}>
                          {new Date(item.expirationDate).toLocaleDateString()}
                          {isExpiringSoon(item.expirationDate) && (
                            <div className="text-xs">{t('inventory.expiringSoon')}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.trackingMode === 'serial' && item.serialNumber && (
                        <div>{t('inventory.serialPrefix')}: {item.serialNumber}</div>
                      )}
                      {item.trackingMode === 'lot' && item.lotNumber && (
                        <div>{t('inventory.lotPrefix')}: {item.lotNumber}</div>
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
                          onClick={() => handleTransfer(item)}
                          disabled={transferItemMutation.isPending}
                          data-testid={`button-transfer-${item.id}`}
                          title={t('inventory.moveTo', { location: location === 'home' ? t('inventory.car') : t('inventory.home') })}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${item.id}`}
                          title={t('inventory.deleteItem')}
                        >
                          <Trash2 className="h-4 w-4" />
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
              {t('inventory.noItemsFound')}
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

      {/* Transfer Quantity Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent data-testid="dialog-transfer-quantity">
          <DialogHeader>
            <DialogTitle>{t('inventory.transferItem')}</DialogTitle>
            <DialogDescription>
              {transferItem && (
                <>
                  {t('inventory.transferItemDescription', { 
                    product: transferItem.product.name, 
                    lot: transferItem.lotNumber,
                    location: location === 'home' ? t('inventory.car') : t('inventory.home')
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="transfer-quantity">
                {t('inventory.quantityAvailable', { available: transferItem?.quantity })}
              </Label>
              <Input
                id="transfer-quantity"
                type="number"
                min="1"
                max={transferItem?.quantity}
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                data-testid="input-transfer-quantity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferDialog(false);
                setTransferItem(null);
                setTransferQuantity('');
              }}
              data-testid="button-cancel-transfer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmTransfer}
              disabled={transferItemMutation.isPending}
              data-testid="button-confirm-transfer"
            >
              {transferItemMutation.isPending ? t('inventory.transferring') : t('inventory.transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Quantity Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-quantity">
          <DialogHeader>
            <DialogTitle>{t('inventory.deleteItem')}</DialogTitle>
            <DialogDescription>
              {deleteItem && (
                <>
                  {deleteItem.product.name}
                  {deleteItem.lotNumber && ` (${t('inventory.lot')}: ${deleteItem.lotNumber})`}
                  <br />
                  {t('inventory.deleteQuantityPrompt')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-quantity">
                {t('inventory.quantityToDelete', { available: deleteItem?.quantity })}
              </Label>
              <Input
                id="delete-quantity"
                type="number"
                min="1"
                max={deleteItem?.quantity}
                value={deleteQuantity}
                onChange={(e) => setDeleteQuantity(e.target.value)}
                data-testid="input-delete-quantity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteItem(null);
                setDeleteQuantity('');
              }}
              data-testid="button-cancel-delete"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending || updateQuantityMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {(deleteMutation.isPending || updateQuantityMutation.isPending) ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
