import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
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
import type { Product, Inventory } from "@shared/schema";
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
  const { t } = useTranslation();
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [manualGtin, setManualGtin] = useState("");
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [quickAddQuantity, setQuickAddQuantity] = useState("1");
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
      // Smart Car Stock Addition: Check home stock first when adding to car
      if (data.location === 'car') {
        try {
          const response = await apiRequest('GET', '/api/inventory?location=home');
          const homeInventory: Inventory[] = await response.json();
          
          // Find matching item in home stock
          const matchingItem = homeInventory.find((item) => {
            const productMatch = item.productId === data.productId;
            const serialMatch = data.trackingMode === 'serial' && item.serialNumber === data.serialNumber;
            const lotMatch = data.trackingMode === 'lot' && item.lotNumber === data.lotNumber;
            return productMatch && (serialMatch || lotMatch);
          });
          
          if (matchingItem) {
            // Item exists in home - transfer it instead of adding new
            const transferPayload = {
              inventoryId: matchingItem.id,
              fromLocation: 'home',
              toLocation: 'car',
              quantity: data.quantity
            };
            return await apiRequest('POST', '/api/inventory/transfer', transferPayload);
          }
        } catch (error) {
          // If home stock check fails, proceed with normal add
          console.error('Failed to check home stock:', error);
        }
      }
      
      // Normal add flow (or if not found in home)
      const payload = {
        ...data,
        serialNumber: data.trackingMode === 'serial' ? data.serialNumber : null,
        lotNumber: data.trackingMode === 'lot' ? data.lotNumber : null,
      };
      return await apiRequest('POST', '/api/inventory', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      // Toast notification removed - user requested no pop-ups when adding multiple products
      handleClose();
    },
    onError: (error: Error, variables) => {
      // Parse error message to check for duplicate serial number
      const errorMessage = error.message || "";
      
      // Check if it's a 409 conflict (duplicate serial number)
      if (errorMessage.startsWith("409:")) {
        try {
          const errorBody = JSON.parse(errorMessage.substring(4).trim());
          if (errorBody.field === "serialNumber") {
            toast({
              title: t('inventory.duplicateSerialNumber'),
              description: t('inventory.duplicateSerialDescription'),
              variant: "destructive",
            });
            // For serial numbers, error is shown and dialog stays open for manual correction
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
      }
      
      // For lot number quick-add errors, reopen quantity dialog for easy retry
      if (variables.trackingMode === 'lot' && !showQuantityDialog) {
        setQuickAddQuantity(variables.quantity.toString());
        setShowQuantityDialog(true);
      }
      
      toast({
        title: t('inventory.addFailed'),
        description: error.message || t('inventory.addError'),
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setSelectedProduct(null);
    setSearchResults([]);
    setGs1Data(null);
    setManualGtin("");
    setShowBarcodeScanner(false);
    onOpenChange(false);
  };

  const handleManualGtinLookup = async () => {
    if (!manualGtin.trim()) {
      toast({
        title: t('inventory.searchRequired'),
        description: t('inventory.searchRequiredDescription'),
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
          title: t('inventory.productNotFound'),
          description: t('inventory.noProductMatching', { search: manualGtin }),
          variant: "destructive",
        });
        setSearchResults([]);
        setIsLoadingProduct(false);
        return;
      }

      // Store all search results
      setSearchResults(products);
      
      // If only one result, auto-select it
      if (products.length === 1) {
        const product = products[0];
        setSelectedProduct(product);
        form.setValue("productId", product.id);
      }
    } catch (error) {
      toast({
        title: t('inventory.lookupFailed'),
        description: error instanceof Error ? error.message : t('inventory.searchFailed'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleScanComplete = async (barcode: string, productInfo?: Product, parsedGs1Data?: GS1Data) => {
    // Store GS1 data for visibility and error recovery
    if (parsedGs1Data) {
      setGs1Data(parsedGs1Data);
    }

    let foundProduct: Product | null = null;

    // If product was found by barcode, use it
    if (productInfo) {
      foundProduct = productInfo;
    } else {
      // Product not found - try to find by GTIN from GS1 data
      if (parsedGs1Data?.gtin) {
        try {
          const response = await apiRequest('GET', `/api/products/multi-search/${encodeURIComponent(parsedGs1Data.gtin)}`);
          const products: Product[] = await response.json();
          
          if (products.length > 0) {
            foundProduct = products[0];
          } else {
            toast({
              title: t('inventory.productNotFound'),
              description: t('inventory.noProductGtin'),
              variant: "destructive",
            });
            setShowBarcodeScanner(false);
            return;
          }
        } catch (error) {
          toast({
            title: t('common.error'),
            description: t('inventory.gtinLookupFailed'),
            variant: "destructive",
          });
          setShowBarcodeScanner(false);
          return;
        }
      } else {
        toast({
          title: t('inventory.productNotFound'),
          description: t('inventory.productNotInDatabase'),
          variant: "destructive",
        });
        setShowBarcodeScanner(false);
        return;
      }
    }

    // Only proceed if we have valid tracking data
    if (!parsedGs1Data?.serialNumber && !parsedGs1Data?.lotNumber) {
      // No tracking data - fall back to manual entry with pre-filled product
      setSelectedProduct(foundProduct);
      form.setValue("productId", foundProduct.id);
      if (parsedGs1Data?.expirationDate) {
        form.setValue("expirationDate", parsedGs1Data.expirationDate);
      }
      setShowBarcodeScanner(false);
      return;
    }

    // STREAMLINED WORKFLOW: Auto-submit for serial, ask quantity for lot
    if (parsedGs1Data.serialNumber) {
      // Serial number detected → Add directly to stock
      setSelectedProduct(foundProduct);
      form.setValue("productId", foundProduct.id);
      form.setValue("trackingMode", "serial");
      form.setValue("serialNumber", parsedGs1Data.serialNumber);
      form.setValue("quantity", 1);
      if (parsedGs1Data.expirationDate) {
        form.setValue("expirationDate", parsedGs1Data.expirationDate);
      }
      
      // Close barcode scanner
      setShowBarcodeScanner(false);
      
      // Auto-submit immediately (errors will show toast and close dialog automatically)
      const formData: AddInventoryFormData = {
        productId: foundProduct.id,
        location,
        trackingMode: "serial",
        serialNumber: parsedGs1Data.serialNumber,
        lotNumber: undefined,
        quantity: 1,
        expirationDate: parsedGs1Data.expirationDate || undefined,
      };
      addInventoryMutation.mutate(formData);
    } else if (parsedGs1Data.lotNumber) {
      // Lot number detected → Ask for quantity only
      setSelectedProduct(foundProduct);
      form.setValue("productId", foundProduct.id);
      form.setValue("trackingMode", "lot");
      form.setValue("lotNumber", parsedGs1Data.lotNumber);
      form.setValue("quantity", 1);
      if (parsedGs1Data.expirationDate) {
        form.setValue("expirationDate", parsedGs1Data.expirationDate);
      }
      
      // Close barcode scanner and show quick quantity dialog
      setShowBarcodeScanner(false);
      setQuickAddQuantity("1");
      setShowQuantityDialog(true);
    }
  };

  const handleQuickAdd = () => {
    const quantity = parseInt(quickAddQuantity);
    if (isNaN(quantity) || quantity < 1) {
      toast({
        title: t('inventory.invalidQuantity'),
        description: t('inventory.quantityMustBePositive'),
        variant: "destructive",
      });
      return;
    }

    // IMPORTANT: Sync quantity to form state for error recovery
    // If mutation fails, user can retry from main dialog with correct quantity
    form.setValue("quantity", quantity);

    const formData: AddInventoryFormData = {
      productId: form.getValues("productId"),
      location,
      trackingMode: "lot",
      serialNumber: undefined,
      lotNumber: form.getValues("lotNumber"),
      quantity,
      expirationDate: form.getValues("expirationDate") || undefined,
    };

    setShowQuantityDialog(false);
    addInventoryMutation.mutate(formData);
  };

  const handleSubmit = (data: AddInventoryFormData) => {
    // Validation
    if (!data.trackingMode) {
      toast({
        title: t('inventory.trackingModeRequired'),
        description: t('inventory.trackingModeRequiredDescription'),
        variant: "destructive",
      });
      return;
    }

    if (data.trackingMode === "serial" && !data.serialNumber) {
      toast({
        title: t('inventory.serialNumberRequired'),
        description: t('inventory.serialNumberRequiredDescription'),
        variant: "destructive",
      });
      return;
    }

    if (data.trackingMode === "lot" && !data.lotNumber) {
      toast({
        title: t('inventory.lotNumberRequired'),
        description: t('inventory.lotNumberRequiredDescription'),
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
              {t('inventory.addInventoryItem')}
            </DialogTitle>
            <DialogDescription>
              {t('inventory.addInventoryDescription', { location: t(`inventory.${location}Location`) })}
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
                  {t('inventory.scanBarcode')}
                </Button>
              </div>

              {/* Manual Product Search */}
              <div className="flex gap-2">
                <Input
                  placeholder={t('inventory.searchPlaceholder')}
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
                  {isLoadingProduct ? t('inventory.searching') : t('common.search')}
                </Button>
              </div>

              {/* Multiple Search Results Dropdown */}
              {searchResults.length > 1 && !selectedProduct && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('inventory.selectProduct')}</label>
                  <Select
                    value=""
                    onValueChange={(productId) => {
                      const product = searchResults.find(p => p.id === productId);
                      if (product) {
                        setSelectedProduct(product);
                        form.setValue("productId", product.id);
                        setSearchResults([]);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-search-result">
                      <SelectValue placeholder={t('inventory.selectFromResults', { count: searchResults.length })} />
                    </SelectTrigger>
                    <SelectContent>
                      {searchResults.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.modelNumber} {product.gtin ? `(${product.gtin})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Selected Product Display */}
              {selectedProduct && (
                <Card className="p-4 bg-muted">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{selectedProduct.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {t('inventory.model')}: {selectedProduct.modelNumber}
                        </div>
                        {selectedProduct.gtin && (
                          <div className="text-xs text-muted-foreground">{t('inventory.gtin')}: {selectedProduct.gtin}</div>
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
                    <div className="font-medium text-primary mb-1">{t('inventory.gs1DataExtracted')}</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {gs1Data.gtin && <div>{t('inventory.gs1Gtin')}: {gs1Data.gtin}</div>}
                      {gs1Data.expirationDate && <div>{t('inventory.gs1Expiration')}: {gs1Data.expirationDate}</div>}
                      {gs1Data.serialNumber && <div>{t('inventory.gs1Serial')}: {gs1Data.serialNumber}</div>}
                      {gs1Data.lotNumber && <div>{t('inventory.gs1Lot')}: {gs1Data.lotNumber}</div>}
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
                    <FormLabel>{t('inventory.trackingMode')} *</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      disabled={addInventoryMutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-tracking-mode">
                          <SelectValue placeholder={t('inventory.selectTrackingMode')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="serial">{t('inventory.serialNumberUnique')}</SelectItem>
                        <SelectItem value="lot">{t('inventory.lotNumberBatch')}</SelectItem>
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
                        <FormLabel>{t('inventory.serial')} *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('inventory.serialPlaceholder')}
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
                        <FormLabel>{t('inventory.lot')} *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('inventory.lotPlaceholder')}
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
                        <FormLabel>{t('inventory.quantity')}</FormLabel>
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
                        <FormLabel>{t('inventory.expirationDateOptional')}</FormLabel>
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
                                {selectedDate ? format(selectedDate, "PPP") : t('inventory.pickDate')}
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
                  {t('inventory.serialQuantityNote')}
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
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={addInventoryMutation.isPending || !selectedProduct}
                  data-testid="button-submit"
                >
                  {addInventoryMutation.isPending ? t('inventory.adding') : t('inventory.addToStock')}
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
          title={t('inventory.scanProductBarcode')}
        />
      )}

      {/* Quick Quantity Dialog for Lot Number Scans */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('inventory.enterQuantity')}</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name && (
                <div className="mt-2 space-y-1">
                  <p className="font-medium text-foreground">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('inventory.lotNumber')}: {form.getValues("lotNumber")}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="quick-quantity" className="text-sm font-medium">
                {t('inventory.quantity')}
              </label>
              <Input
                id="quick-quantity"
                type="number"
                min="1"
                value={quickAddQuantity}
                onChange={(e) => setQuickAddQuantity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickAdd();
                  }
                }}
                autoFocus
                data-testid="input-quick-quantity"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowQuantityDialog(false)}
              disabled={addInventoryMutation.isPending}
              data-testid="button-quantity-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleQuickAdd}
              disabled={addInventoryMutation.isPending}
              data-testid="button-quantity-add"
            >
              {addInventoryMutation.isPending ? t('inventory.adding') : t('inventory.addToStock')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
