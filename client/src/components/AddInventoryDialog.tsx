import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus, Scan, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import BarcodeScanner from "@/components/BarcodeScanner";
import { parseGS1Barcode, type GS1Data } from "@/lib/gs1Parser";
import type { Product } from "@shared/schema";
import { z } from "zod";

const addInventorySchema = z.object({
  productId: z.string().min(1, "Product is required"),
  location: z.string().min(1, "Location is required"),
  trackingMode: z.enum(["serial", "lot"]).nullable(),
  serialNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  quantity: z.coerce.number().min(1).default(1),
  expirationDate: z.string().optional(),
});

type AddInventoryFormData = z.infer<typeof addInventorySchema>;

interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: 'home' | 'car';
}

export default function AddInventoryDialog({ open, onOpenChange, location }: AddInventoryDialogProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [manualGtin, setManualGtin] = useState("");
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const { toast } = useToast();

  // No manual scroll lock manipulation - Dialog components handle this automatically

  const form = useForm<AddInventoryFormData>({
    resolver: zodResolver(addInventorySchema),
    defaultValues: {
      productId: "",
      location,
      trackingMode: null,
      serialNumber: "",
      lotNumber: "",
      quantity: 1,
      expirationDate: undefined,
    },
  });

  const trackingMode = form.watch("trackingMode");

  const addInventoryMutation = useMutation({
    mutationFn: async (data: AddInventoryFormData) => {
      return await apiRequest('POST', '/api/inventory', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Item added",
        description: "Inventory item has been added successfully.",
      });
      handleClose();
    },
    onError: (error: Error) => {
      // Parse error message to check for duplicate serial number
      const errorMessage = error.message || "";
      
      // Check if it's a 409 conflict (duplicate serial number)
      if (errorMessage.startsWith("409:")) {
        try {
          const errorBody = JSON.parse(errorMessage.substring(4).trim());
          if (errorBody.field === "serialNumber") {
            toast({
              title: "Duplicate Serial Number",
              description: "This serial number already exists in your inventory. Each serial number must be unique.",
              variant: "destructive",
            });
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
      }
      
      toast({
        title: "Failed to add item",
        description: error.message || "An error occurred while adding the item.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setSelectedProduct(null);
    setGs1Data(null);
    setManualGtin("");
    setShowBarcodeScanner(false);
    onOpenChange(false);
  };

  const handleManualGtinLookup = async () => {
    if (!manualGtin.trim()) {
      toast({
        title: "Search required",
        description: "Please enter a GTIN, model number, or serial number to search.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingProduct(true);
    try {
      const response = await apiRequest('GET', `/api/products/multi-search/${encodeURIComponent(manualGtin.trim())}`);
      const products: Product[] = await response.json();
      
      if (products.length === 0) {
        toast({
          title: "Product not found",
          description: `No product found matching: ${manualGtin}`,
          variant: "destructive",
        });
        setIsLoadingProduct(false);
        return;
      }

      const product = products[0];
      setSelectedProduct(product);
      form.setValue("productId", product.id);
      
      toast({
        title: "Product found",
        description: `${product.name} (${product.modelNumber})`,
      });
    } catch (error) {
      toast({
        title: "Lookup failed",
        description: error instanceof Error ? error.message : "Failed to search for product",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleScanComplete = async (barcode: string, productInfo?: Product, parsedGs1Data?: GS1Data) => {
    // Reset form fields to prevent stale data from previous scans or manual edits
    form.setValue("trackingMode", null);
    form.setValue("serialNumber", "");
    form.setValue("lotNumber", "");
    form.setValue("quantity", 1);
    form.setValue("expirationDate", undefined);
    
    // If GS1 data was parsed, store it for later use
    if (parsedGs1Data) {
      setGs1Data(parsedGs1Data);
    }

    let foundProduct: Product | null = null;

    // If product was found by barcode, use it
    if (productInfo) {
      foundProduct = productInfo;
      setSelectedProduct(productInfo);
      form.setValue("productId", productInfo.id);
      
      toast({
        title: "Product Found",
        description: `${productInfo.name} - ${productInfo.modelNumber}`,
      });
    } else {
      // Product not found - try to find by GTIN from GS1 data
      if (parsedGs1Data?.gtin) {
        try {
          const response = await apiRequest('GET', `/api/products/multi-search/${encodeURIComponent(parsedGs1Data.gtin)}`);
          const products: Product[] = await response.json();
          
          if (products.length > 0) {
            const product = products[0];
            foundProduct = product;
            setSelectedProduct(product);
            form.setValue("productId", product.id);
            
            toast({
              title: "Product Found by GTIN",
              description: `${product.name} - ${product.modelNumber}`,
            });
          } else {
            toast({
              title: "Product Not Found",
              description: "No product found with this GTIN. Please add the product first.",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to lookup product by GTIN.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Product Not Found",
          description: "Product not found in database. Please add the product first.",
          variant: "destructive",
        });
      }
    }

    // Auto-populate fields from GS1 data if available
    if (parsedGs1Data) {
      if (parsedGs1Data.expirationDate) {
        form.setValue("expirationDate", parsedGs1Data.expirationDate);
      }
      if (parsedGs1Data.serialNumber) {
        form.setValue("trackingMode", "serial");
        form.setValue("serialNumber", parsedGs1Data.serialNumber);
        form.setValue("quantity", 1);
      } else if (parsedGs1Data.lotNumber) {
        form.setValue("trackingMode", "lot");
        form.setValue("lotNumber", parsedGs1Data.lotNumber);
        form.setValue("quantity", 1);
      }
    }
  };

  const handleSubmit = (data: AddInventoryFormData) => {
    // Validation
    if (!data.trackingMode) {
      toast({
        title: "Tracking mode required",
        description: "Please select whether this item is tracked by serial number or lot number.",
        variant: "destructive",
      });
      return;
    }

    if (data.trackingMode === "serial" && !data.serialNumber) {
      toast({
        title: "Serial number required",
        description: "Please enter a serial number for this item.",
        variant: "destructive",
      });
      return;
    }

    if (data.trackingMode === "lot" && !data.lotNumber) {
      toast({
        title: "Lot number required",
        description: "Please enter a lot number for this item.",
        variant: "destructive",
      });
      return;
    }

    // Serial-tracked items must have quantity = 1
    if (data.trackingMode === "serial") {
      data.quantity = 1;
    }

    addInventoryMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Inventory Item
            </DialogTitle>
            <DialogDescription>
              Scan a barcode or manually enter item details to add to {location} stock
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Barcode Scanner Button */}
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBarcodeScanner(true)}
                  data-testid="button-open-scanner"
                  className="w-full md:w-auto"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scan Barcode
                </Button>
              </div>

              {/* Manual Product Search */}
              <div className="flex gap-2">
                <Input
                  placeholder="Or search by GTIN, Model #, or Serial #..."
                  value={manualGtin}
                  onChange={(e) => setManualGtin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualGtinLookup();
                    }
                  }}
                  disabled={isLoadingProduct || addInventoryMutation.isPending}
                  data-testid="input-manual-search"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleManualGtinLookup}
                  disabled={!manualGtin.trim() || isLoadingProduct || addInventoryMutation.isPending}
                  data-testid="button-search-product"
                >
                  {isLoadingProduct ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Selected Product Display */}
              {selectedProduct && (
                <Card className="p-4 bg-muted">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{selectedProduct.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Model: {selectedProduct.modelNumber}
                        </div>
                        {selectedProduct.gtin && (
                          <div className="text-xs text-muted-foreground">GTIN: {selectedProduct.gtin}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedProduct(null);
                        form.setValue("productId", "");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )}

              {/* GS1 Data Display */}
              {gs1Data && (gs1Data.serialNumber || gs1Data.lotNumber || gs1Data.expirationDate) && (
                <Card className="p-3 bg-primary/5 border-primary/20">
                  <div className="text-sm">
                    <div className="font-medium text-primary mb-1">GS1 Data Extracted:</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {gs1Data.gtin && <div>GTIN (01): {gs1Data.gtin}</div>}
                      {gs1Data.expirationDate && <div>Expiration (17): {gs1Data.expirationDate}</div>}
                      {gs1Data.serialNumber && <div>Serial (21): {gs1Data.serialNumber}</div>}
                      {gs1Data.lotNumber && <div>Lot (10): {gs1Data.lotNumber}</div>}
                    </div>
                  </div>
                </Card>
              )}

              {/* Tracking Mode Selection */}
              <FormField
                control={form.control}
                name="trackingMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking Mode *</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      disabled={addInventoryMutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-tracking-mode">
                          <SelectValue placeholder="Select tracking mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="serial">Serial Number (Unique Item)</SelectItem>
                        <SelectItem value="lot">Lot Number (Batch)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Serial Number Field */}
                {trackingMode === "serial" && (
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., SN123456"
                            {...field}
                            data-testid="input-serial-number"
                            disabled={addInventoryMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Lot Number Field */}
                {trackingMode === "lot" && (
                  <FormField
                    control={form.control}
                    name="lotNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot Number *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., LOT123"
                            {...field}
                            data-testid="input-lot-number"
                            disabled={addInventoryMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Quantity Field (only for lot-tracked items) */}
                {trackingMode === "lot" && (
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            data-testid="input-quantity"
                            disabled={addInventoryMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Expiration Date Field */}
                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => {
                    // Parse YYYY-MM-DD string to Date object safely (timezone-agnostic)
                    const parseDateString = (dateStr: string | undefined) => {
                      if (!dateStr) return undefined;
                      const [year, month, day] = dateStr.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    };

                    const selectedDate = parseDateString(field.value);

                    return (
                      <FormItem className={trackingMode === "serial" ? "md:col-span-2" : ""}>
                        <FormLabel>Expiration Date (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                                data-testid="button-expiration-date"
                                disabled={addInventoryMutation.isPending}
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                // Convert Date to YYYY-MM-DD string format for Zod validation
                                if (date) {
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  field.onChange(`${year}-${month}-${day}`);
                                } else {
                                  field.onChange(undefined);
                                }
                              }}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Note about serial vs lot */}
              {trackingMode === "serial" && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Note: Serial-tracked items have a fixed quantity of 1
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={addInventoryMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addInventoryMutation.isPending || !selectedProduct}
                  data-testid="button-submit"
                >
                  {addInventoryMutation.isPending ? "Adding..." : "Add to Stock"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog - Only render when open */}
      {showBarcodeScanner && (
        <BarcodeScanner 
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScanComplete={handleScanComplete}
          title="Scan Product Barcode"
        />
      )}
    </>
  );
}
