import { useState } from "react";
import { Search, Package, AlertTriangle, ArrowUpDown, Plus, Minus, Eye } from "lucide-react";
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

interface InventoryItem {
  id: string;
  name: string;
  modelNumber: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  expirationDate?: string;
  serialNumber?: string;
  location: 'home' | 'car';
}

interface InventoryTableProps {
  location: 'home' | 'car';
  items?: InventoryItem[];
  onTransfer?: (itemId: string, quantity: number, direction: 'in' | 'out') => void;
}

// Todo: remove mock functionality
const mockItems: InventoryItem[] = [
  {
    id: '1',
    name: 'Medtronic Azure Pacemaker',
    modelNumber: 'XT1234',
    category: 'Device',
    quantity: 5,
    minStockLevel: 2,
    expirationDate: '2025-12-31',
    serialNumber: 'MD001234',
    location: 'home'
  },
  {
    id: '2',
    name: 'Boston Scientific ICD Lead',
    modelNumber: 'BS5678',
    category: 'Lead/Electrode',
    quantity: 1,
    minStockLevel: 3,
    expirationDate: '2024-06-15',
    serialNumber: 'BS005678',
    location: 'home'
  },
  {
    id: '3',
    name: 'Surgical Gloves (Size M)',
    modelNumber: 'SG001',
    category: 'Material',
    quantity: 25,
    minStockLevel: 10,
    location: 'home'
  },
  {
    id: '4',
    name: 'Abbott CRT Device',
    modelNumber: 'AB9012',
    category: 'Device',
    quantity: 2,
    minStockLevel: 1,
    expirationDate: '2026-03-20',
    serialNumber: 'AB009012',
    location: 'car'
  }
];

export default function InventoryTable({ location, items = mockItems, onTransfer }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  const filteredItems = items
    .filter(item => item.location === location)
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.modelNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(item => categoryFilter === 'all' || item.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'quantity') return a.quantity - b.quantity;
      if (sortBy === 'expiration') return (a.expirationDate || '9999') < (b.expirationDate || '9999') ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lowStockItems = filteredItems.filter(item => item.quantity <= item.minStockLevel);
  const stockLevel = filteredItems.length > 0 ? (filteredItems.reduce((sum, item) => sum + item.quantity, 0) / filteredItems.length) * 10 : 0;

  const handleTransfer = (itemId: string, direction: 'in' | 'out') => {
    console.log(`Transfer ${direction} for item ${itemId}`);
    onTransfer?.(itemId, 1, direction);
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const expDate = new Date(date);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return expDate < threeMonthsFromNow;
  };

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
                {filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.modelNumber}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
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
                      {item.serialNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleTransfer(item.id, 'out')}
                          data-testid={`button-transfer-out-${item.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleTransfer(item.id, 'in')}
                          data-testid={`button-transfer-in-${item.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-view-details-${item.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}