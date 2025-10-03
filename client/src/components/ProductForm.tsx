import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Package, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProductSchema, type Product, type InsertProduct } from "@shared/schema";
import BarcodeScanner from "@/components/BarcodeScanner";
import { GS1Data } from "@/lib/gs1Parser";

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      modelNumber: product?.modelNumber || "",
      name: product?.name || "",
      category: product?.category || "",
      manufacturer: product?.manufacturer || "",
      description: product?.description ?? undefined,
      gtin: product?.gtin ?? undefined,
      expirationDate: product?.expirationDate || undefined,
      serialNumber: product?.serialNumber ?? undefined,
      lotNumber: product?.lotNumber ?? undefined,
      barcode: product?.barcode ?? undefined,
      minStockLevel: product?.minStockLevel ?? 1,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      if (!product?.id) throw new Error("Product ID is required for updates");
      const res = await apiRequest("PATCH", `/api/products/${product.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertProduct) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleScanComplete = (barcode: string, productInfo?: Product, gs1Data?: GS1Data) => {
    // Set the barcode from scanning
    form.setValue("barcode", barcode);
    
    // If we found product info, auto-populate fields
    if (productInfo) {
      form.setValue("modelNumber", productInfo.modelNumber);
      form.setValue("name", productInfo.name);
      form.setValue("category", productInfo.category);
      form.setValue("manufacturer", productInfo.manufacturer);
      if (productInfo.description) form.setValue("description", productInfo.description);
      if (productInfo.gtin) form.setValue("gtin", productInfo.gtin);
      if (productInfo.serialNumber) form.setValue("serialNumber", productInfo.serialNumber);
      if (productInfo.lotNumber) form.setValue("lotNumber", productInfo.lotNumber);
      if (productInfo.expirationDate) form.setValue("expirationDate", productInfo.expirationDate);
      
      toast({
        title: "Product Found",
        description: "Barcode scanned and product information loaded",
      });
    } else {
      toast({
        title: "Barcode Scanned",
        description: "Barcode added to form. Product not found in database - please fill in details manually.",
      });
    }
    
    // Override with GS1 data if available (more specific to this exact item)
    if (gs1Data) {
      if (gs1Data.gtin) {
        form.setValue("gtin", gs1Data.gtin);
      }
      if (gs1Data.expirationDate) {
        form.setValue("expirationDate", gs1Data.expirationDate);
        toast({
          title: "GS1 Data Extracted",
          description: `GTIN: ${gs1Data.gtin || 'N/A'}, Expiration: ${gs1Data.expirationDate}${gs1Data.serialNumber ? `, Serial: ${gs1Data.serialNumber}` : ''}`,
        });
      }
      if (gs1Data.serialNumber) {
        form.setValue("serialNumber", gs1Data.serialNumber);
      }
      if (gs1Data.lotNumber) {
        form.setValue("lotNumber", gs1Data.lotNumber);
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {product ? 'Edit Product' : 'Add New Product'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="modelNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., XT1234" 
                        {...field} 
                        data-testid="input-model-number"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gtin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GTIN (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 05414734218320" 
                        {...field} 
                        data-testid="input-gtin"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Device">Device</SelectItem>
                        <SelectItem value="Lead/Electrode">Lead/Electrode</SelectItem>
                        <SelectItem value="Material">Material</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Medtronic, Boston Scientific, Abbott" 
                        {...field} 
                        data-testid="input-manufacturer"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Medtronic Azure Pacemaker" 
                      {...field} 
                      data-testid="input-product-name"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional product details..."
                      {...field} 
                      data-testid="input-description"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., MD001234" 
                        {...field} 
                        data-testid="input-serial-number"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lotNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot Number (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., LOT123" 
                        {...field} 
                        data-testid="input-lot-number"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-expiration-date"
                            disabled={isSubmitting}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode (Optional)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Scan or enter manually" 
                          {...field} 
                          data-testid="input-barcode"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowBarcodeScanner(true)}
                        disabled={isSubmitting}
                        data-testid="button-scan-barcode"
                      >
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="minStockLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Stock Level</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="0"
                      placeholder="e.g., 5" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-min-stock-level"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  data-testid="button-cancel"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                data-testid="button-save-product"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : (product ? 'Update Product' : 'Add Product')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScanComplete={handleScanComplete}
        title="Scan Product Barcode"
      />
    </Card>
  );
}
