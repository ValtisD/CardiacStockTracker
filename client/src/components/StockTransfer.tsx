import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRightLeft, Package, Home, Car, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const transferSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  fromLocation: z.string().min(1, "From location is required"),
  toLocation: z.string().min(1, "To location is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  homeQuantity: number;
  carQuantity: number;
  category: string;
}

interface StockTransferProps {
  products?: Product[];
  onTransfer: (transfer: TransferFormData) => void;
  onCancel?: () => void;
}

// Todo: remove mock functionality
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Medtronic Azure Pacemaker',
    modelNumber: 'XT1234',
    homeQuantity: 5,
    carQuantity: 2,
    category: 'Device'
  },
  {
    id: '2',
    name: 'Boston Scientific ICD Lead',
    modelNumber: 'BS5678',
    homeQuantity: 8,
    carQuantity: 1,
    category: 'Lead/Electrode'
  },
  {
    id: '3',
    name: 'Surgical Gloves (Size M)',
    modelNumber: 'SG001',
    homeQuantity: 25,
    carQuantity: 10,
    category: 'Material'
  },
  {
    id: '4',
    name: 'Abbott CRT Device',
    modelNumber: 'AB9012',
    homeQuantity: 3,
    carQuantity: 1,
    category: 'Device'
  }
];

export default function StockTransfer({ products = mockProducts, onTransfer, onCancel }: StockTransferProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferQuantity, setTransferQuantity] = useState(1);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      productId: "",
      fromLocation: "",
      toLocation: "",
      quantity: 1,
      notes: "",
    },
  });

  const watchedValues = form.watch();

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
    setTransferQuantity(1);
    
    if (product) {
      // Smart location suggestions based on quantities
      if (product.homeQuantity > product.carQuantity) {
        form.setValue('fromLocation', 'home');
        form.setValue('toLocation', 'car');
      } else if (product.carQuantity > product.homeQuantity) {
        form.setValue('fromLocation', 'car');
        form.setValue('toLocation', 'home');
      }
    }
  };

  const handleSubmit = (data: TransferFormData) => {
    console.log('Stock transfer:', data);
    onTransfer(data);
  };

  const getAvailableQuantity = (location: 'home' | 'car') => {
    if (!selectedProduct) return 0;
    return location === 'home' ? selectedProduct.homeQuantity : selectedProduct.carQuantity;
  };

  const getMaxTransferQuantity = () => {
    if (!selectedProduct || !watchedValues.fromLocation) return 1;
    return getAvailableQuantity(watchedValues.fromLocation as 'home' | 'car');
  };

  const adjustQuantity = (delta: number) => {
    const newQuantity = Math.max(1, Math.min(getMaxTransferQuantity(), transferQuantity + delta));
    setTransferQuantity(newQuantity);
    form.setValue('quantity', newQuantity);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Stock Transfer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Product Selection */}
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Product</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleProductChange(value);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-product">
                        <SelectValue placeholder="Choose product to transfer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{product.name} ({product.modelNumber})</span>
                            <div className="flex gap-2 ml-4">
                              <Badge variant="outline" className="text-xs">
                                <Home className="h-3 w-3 mr-1" />
                                {product.homeQuantity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Car className="h-3 w-3 mr-1" />
                                {product.carQuantity}
                              </Badge>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Current Stock Display */}
            {selectedProduct && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{selectedProduct.name}</h4>
                      <p className="text-sm text-muted-foreground">{selectedProduct.modelNumber}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{selectedProduct.homeQuantity}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Home</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{selectedProduct.carQuantity}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Car</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transfer Direction */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-from-location">
                          <SelectValue placeholder="From location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="home">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Home Inventory
                            {selectedProduct && (
                              <Badge variant="outline" className="ml-2">
                                {selectedProduct.homeQuantity}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                        <SelectItem value="car">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            Car Stock
                            {selectedProduct && (
                              <Badge variant="outline" className="ml-2">
                                {selectedProduct.carQuantity}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-to-location">
                          <SelectValue placeholder="To location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem 
                          value="home" 
                          disabled={watchedValues.fromLocation === 'home'}
                        >
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Home Inventory
                          </div>
                        </SelectItem>
                        <SelectItem 
                          value="car"
                          disabled={watchedValues.fromLocation === 'car'}
                        >
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            Car Stock
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quantity Selection */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => adjustQuantity(-1)}
                      disabled={transferQuantity <= 1}
                      data-testid="button-decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max={getMaxTransferQuantity()}
                        value={transferQuantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setTransferQuantity(value);
                          field.onChange(value);
                        }}
                        className="text-center w-20"
                        data-testid="input-transfer-quantity"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => adjustQuantity(1)}
                      disabled={transferQuantity >= getMaxTransferQuantity()}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <div className="text-sm text-muted-foreground ml-2">
                      Max: {getMaxTransferQuantity()}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes about this transfer..."
                      {...field} 
                      data-testid="input-transfer-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  data-testid="button-cancel-transfer"
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={!selectedProduct || !watchedValues.fromLocation || !watchedValues.toLocation}
                data-testid="button-confirm-transfer"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer Stock
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}