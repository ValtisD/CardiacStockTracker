import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, Calendar, Building2, Plus, Minus, Scan, AlertCircle, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Hospital, Product, Inventory, InsertProcedureMaterial } from "@shared/schema";
import BarcodeScanner from "@/components/BarcodeScanner";
import { GS1Data } from "@/lib/gs1Parser";

const implantReportSchema = z.object({
  hospitalId: z.string().min(1, "Hospital is required"),
  implantDate: z.string().min(1, "Implant date is required"),
  procedureType: z.string().min(1, "Procedure type is required"),
  deviceUsed: z.string().optional(),
  deviceSerialNumber: z.string().optional(),
  notes: z.string().optional(),
});

type ImplantReportData = z.infer<typeof implantReportSchema>;

interface MaterialItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  source: 'car' | 'external' | 'hospital';
  scanned?: boolean;
  serialNumber?: string;  // Store GS1 serial number for duplicate detection
  lotNumber?: string;     // Store GS1 lot number
}

interface ImplantReportFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
}

interface InventoryWithProduct extends Inventory {
  product: Product;
}

export default function ImplantReportForm({ onSubmit, onCancel }: ImplantReportFormProps) {
  const { toast } = useToast();
  
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanningItem, setScanningItem] = useState<{ type: 'materials' | 'leads' | 'others' | 'device', id: string } | null>(null);
  const [scannedDeviceId, setScannedDeviceId] = useState<string>('');

  const [materials, setMaterials] = useState<MaterialItem[]>([
    { id: '1', name: '', quantity: 1, source: 'car' },
    { id: '2', name: '', quantity: 1, source: 'car' },
    { id: '3', name: '', quantity: 1, source: 'car' }
  ]);

  const [leads, setLeads] = useState<MaterialItem[]>([
    { id: '1', name: '', quantity: 1, source: 'car' },
    { id: '2', name: '', quantity: 1, source: 'car' },
    { id: '3', name: '', quantity: 1, source: 'car' }
  ]);

  const [otherMaterials, setOtherMaterials] = useState<MaterialItem[]>([
    { id: '1', name: '', quantity: 1, source: 'car' },
    { id: '2', name: '', quantity: 1, source: 'car' }
  ]);

  const { data: hospitals = [], isLoading: hospitalsLoading } = useQuery<Hospital[]>({
    queryKey: ['/api/hospitals'],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: carInventory = [], isLoading: inventoryLoading } = useQuery<InventoryWithProduct[]>({
    queryKey: ['/api/inventory?location=car'],
  });

  const createProcedureMutation = useMutation({
    mutationFn: async (data: ImplantReportData & { materials: InsertProcedureMaterial[] }) => {
      const res = await apiRequest('POST', '/api/implant-procedures', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/implant-procedures'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      
      toast({
        title: "Success",
        description: "Implant procedure report saved successfully",
      });

      if (onSubmit) {
        onSubmit(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save implant procedure report",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ImplantReportData>({
    resolver: zodResolver(implantReportSchema),
    defaultValues: {
      hospitalId: "",
      implantDate: new Date().toISOString().split('T')[0],
      procedureType: "",
      deviceUsed: "",
      notes: "",
    },
  });

  const deviceProducts = products; // All products can be used as devices

  const handleSubmit = (data: ImplantReportData) => {
    const allMaterials = [...materials, ...leads, ...otherMaterials].filter(m => m.name.trim() !== '');
    
    const procedureMaterials: InsertProcedureMaterial[] = allMaterials.map(m => ({
      productId: m.productId || null,
      materialName: m.name,
      quantity: m.quantity,
      source: m.source,
      serialNumber: m.serialNumber || null,
      lotNumber: m.lotNumber || null,
    }));

    const carStockMaterials = procedureMaterials.filter(m => m.source === 'car' && m.productId);
    for (const material of carStockMaterials) {
      const inventoryItem = carInventory.find(inv => inv.productId === material.productId);
      if (!inventoryItem) {
        toast({
          title: "Stock Error",
          description: `Product ${material.materialName} not found in car inventory`,
          variant: "destructive",
        });
        return;
      }
      if (material.quantity && inventoryItem.quantity < material.quantity) {
        toast({
          title: "Insufficient Stock",
          description: `Not enough stock for ${material.materialName}. Available: ${inventoryItem.quantity}, Required: ${material.quantity}`,
          variant: "destructive",
        });
        return;
      }
    }

    createProcedureMutation.mutate({
      ...data,
      materials: procedureMaterials,
    });
  };

  const updateMaterialItem = (
    type: 'materials' | 'leads' | 'others', 
    id: string, 
    field: keyof MaterialItem, 
    value: any
  ) => {
    const setter = type === 'materials' ? setMaterials : 
                  type === 'leads' ? setLeads : setOtherMaterials;
    
    setter(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const selectProduct = (type: 'materials' | 'leads' | 'others', id: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const setter = type === 'materials' ? setMaterials : 
                    type === 'leads' ? setLeads : setOtherMaterials;
      
      // Auto-fetch serial/lot numbers from car inventory
      const { serialNumber, lotNumber } = getInventorySerialLot(productId);
      
      setter(prev => prev.map(item => 
        item.id === id ? { 
          ...item, 
          productId, 
          name: product.name,
          serialNumber,
          lotNumber
        } : item
      ));
    }
  };

  const clearItem = (type: 'materials' | 'leads' | 'others', id: string) => {
    const setter = type === 'materials' ? setMaterials : 
                  type === 'leads' ? setLeads : setOtherMaterials;
    
    setter(prev => prev.map(item => 
      item.id === id ? { 
        id: item.id, 
        name: '', 
        quantity: 1, 
        source: 'car' as const,
        scanned: false,
        productId: undefined,
        serialNumber: undefined,
        lotNumber: undefined
      } : item
    ));
  };

  const scanBarcode = async (type: 'materials' | 'leads' | 'others' | 'device', id: string) => {
    setScanningItem({ type, id });
    setShowBarcodeScanner(true);
  };
  
  const checkDuplicateSerial = (serialNumber: string, excludeType?: 'materials' | 'leads' | 'others', excludeId?: string): boolean => {
    const allItems = [
      ...materials.map(m => ({ ...m, itemType: 'materials' as const })),
      ...leads.map(l => ({ ...l, itemType: 'leads' as const })),
      ...otherMaterials.map(o => ({ ...o, itemType: 'others' as const }))
    ];
    
    // Check if this exact serial number has already been added
    return allItems.some(item => 
      item.serialNumber === serialNumber && 
      item.serialNumber !== undefined &&
      !(excludeType && item.itemType === excludeType && item.id === excludeId)
    );
  };

  const handleScanComplete = (barcode: string, productInfo?: Product, gs1Data?: GS1Data) => {
    if (!scanningItem) return;
    
    const { type, id } = scanningItem;
    
    if (type === 'device') {
      // Handle primary device scanning
      if (productInfo) {
        form.setValue('deviceUsed', productInfo.id);
        setScannedDeviceId(productInfo.id);
        
        // Set device serial number if present in GS1 data
        if (gs1Data?.serialNumber) {
          form.setValue('deviceSerialNumber', gs1Data.serialNumber);
        }
        
        const toastDescription = gs1Data?.serialNumber 
          ? `${productInfo.name} set as primary device (Serial: ${gs1Data.serialNumber})`
          : `${productInfo.name} set as primary device`;
        
        toast({
          title: "Device Scanned",
          description: toastDescription,
        });
      } else {
        toast({
          title: "Product Not Found",
          description: "Scanned product not found in database.",
          variant: "destructive",
        });
      }
    } else {
      // Handle materials/leads/others scanning
      if (productInfo) {
        // Check for duplicate serialized items if serial number is present
        if (gs1Data?.serialNumber && checkDuplicateSerial(gs1Data.serialNumber, type, id)) {
          toast({
            title: "Duplicate Item",
            description: `${productInfo.name} (Serial: ${gs1Data.serialNumber}) has already been added to this report.`,
            variant: "destructive",
          });
          setScanningItem(null);
          setShowBarcodeScanner(false);
          return;
        }
        
        // Found product in database - set it
        selectProduct(type, id, productInfo.id);
        updateMaterialItem(type, id, 'scanned', true);
        
        // Store GS1 data for duplicate checking and display
        if (gs1Data?.serialNumber) {
          updateMaterialItem(type, id, 'serialNumber', gs1Data.serialNumber);
        }
        if (gs1Data?.lotNumber) {
          updateMaterialItem(type, id, 'lotNumber', gs1Data.lotNumber);
        }
        
        const toastDescription = gs1Data?.serialNumber 
          ? `${productInfo.name} added (Serial: ${gs1Data.serialNumber})`
          : `${productInfo.name} added successfully`;
        
        toast({
          title: "Product Scanned",
          description: toastDescription,
        });
      } else {
        // Product not found - clear productId and set barcode as manual entry
        updateMaterialItem(type, id, 'productId', undefined);
        updateMaterialItem(type, id, 'name', barcode);
        updateMaterialItem(type, id, 'scanned', true);
        
        toast({
          title: "Barcode Scanned",
          description: "Product not found in database. Barcode added as product name.",
          variant: "default",
        });
      }
    }
    
    setScanningItem(null);
    setShowBarcodeScanner(false);
  };

  const getInventoryQuantity = (productId?: string): number => {
    if (!productId) return 0;
    const inventoryItem = carInventory.find(inv => inv.productId === productId);
    return inventoryItem?.quantity || 0;
  };

  const getInventorySerialLot = (productId?: string): { serialNumber?: string; lotNumber?: string } => {
    if (!productId) return {};
    const inventoryItem = carInventory.find(inv => inv.productId === productId);
    if (!inventoryItem) return {};
    
    return {
      serialNumber: inventoryItem.serialNumber || undefined,
      lotNumber: inventoryItem.lotNumber || undefined,
    };
  };

  const MaterialSection = ({ 
    title, 
    items, 
    type, 
    icon
  }: { 
    title: string; 
    items: MaterialItem[]; 
    type: 'materials' | 'leads' | 'others';
    icon: React.ReactNode;
  }) => {
    const filteredProducts = products;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => {
            const availableQty = getInventoryQuantity(item.productId);
            const isLowStock = item.source === 'car' && item.productId && availableQty < item.quantity;

            return (
              <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select
                      value={item.productId || ''}
                      onValueChange={(value) => {
                        if (value === 'manual') {
                          updateMaterialItem(type, item.id, 'productId', undefined);
                          updateMaterialItem(type, item.id, 'name', '');
                        } else {
                          selectProduct(type, item.id, value);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8" data-testid={`select-${type}-${item.id}-product`}>
                        <SelectValue placeholder={`Select ${title.slice(0, -1).toLowerCase()} ${index + 1}`}>
                          {item.name || `Select ${title.slice(0, -1).toLowerCase()} ${index + 1}`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Enter manually...</SelectItem>
                        {filteredProducts.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.modelNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!item.productId && (
                      <Input
                        className="mt-1 h-8"
                        placeholder="Enter name manually"
                        value={item.name}
                        onChange={(e) => updateMaterialItem(type, item.id, 'name', e.target.value)}
                        data-testid={`input-${type}-${item.id}-name`}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => updateMaterialItem(type, item.id, 'quantity', Math.max(1, item.quantity - 1))}
                        className="h-8 w-8"
                        data-testid={`button-decrease-${type}-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="mx-2 w-8 text-center" data-testid={`text-quantity-${type}-${item.id}`}>{item.quantity}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => updateMaterialItem(type, item.id, 'quantity', item.quantity + 1)}
                        className="h-8 w-8"
                        data-testid={`button-increase-${type}-${item.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Select 
                      value={item.source} 
                      onValueChange={(value) => updateMaterialItem(type, item.id, 'source', value as any)}
                    >
                      <SelectTrigger className="h-8" data-testid={`select-${type}-${item.id}-source`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car Stock</SelectItem>
                        <SelectItem value="external">External</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => scanBarcode(type, item.id)}
                      className="h-8 w-8"
                      data-testid={`button-scan-${type}-${item.id}`}
                    >
                      <Scan className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => clearItem(type, item.id)}
                      className="h-8 w-8"
                      data-testid={`button-clear-${type}-${item.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {item.scanned && (
                      <Badge variant="secondary" className="text-xs">Scanned</Badge>
                    )}
                  </div>
                </div>
                {item.serialNumber && (
                  <div className="text-xs text-muted-foreground ml-1">
                    Serial: {item.serialNumber}
                  </div>
                )}
                {item.lotNumber && !item.serialNumber && (
                  <div className="text-xs text-muted-foreground ml-1">
                    Lot: {item.lotNumber}
                  </div>
                )}
                {item.source === 'car' && item.productId && (
                  <div className="flex items-center gap-2 text-xs ml-1">
                    {isLowStock ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <span className="text-destructive" data-testid={`text-stock-warning-${type}-${item.id}`}>
                          Insufficient stock! Available: {availableQty}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground" data-testid={`text-stock-available-${type}-${item.id}`}>
                        Available in car: {availableQty}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const isLoading = hospitalsLoading || productsLoading || inventoryLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Implant Procedure Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Implant Procedure Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital/Facility</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-hospital">
                            <SelectValue placeholder="Select hospital" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hospitals.map(hospital => (
                            <SelectItem key={hospital.id} value={hospital.id}>
                              {hospital.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="implantDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Implant Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-implant-date"
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
                  name="procedureType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Procedure Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-procedure-type">
                            <SelectValue placeholder="Select procedure type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pacemaker">Pacemaker Implant</SelectItem>
                          <SelectItem value="ICD">ICD Implant</SelectItem>
                          <SelectItem value="CRT">CRT Implant</SelectItem>
                          <SelectItem value="Replacement">Device Replacement</SelectItem>
                          <SelectItem value="Lead_Revision">Lead Revision</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deviceUsed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Device</FormLabel>
                      <div className="flex gap-2">
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-fetch and set serial number from inventory
                            const { serialNumber, lotNumber } = getInventorySerialLot(value);
                            if (serialNumber) {
                              form.setValue('deviceSerialNumber', serialNumber);
                            } else if (lotNumber) {
                              form.setValue('deviceSerialNumber', `Lot: ${lotNumber}`);
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-device">
                              <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {deviceProducts.map(device => (
                              <SelectItem key={device.id} value={device.id}>
                                {device.name} ({device.modelNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => scanBarcode('device', 'primary-device')}
                          data-testid="button-scan-device"
                        >
                          <Scan className="h-4 w-4" />
                        </Button>
                      </div>
                      {form.watch('deviceSerialNumber') && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Serial: {form.watch('deviceSerialNumber')}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <MaterialSection 
                  title="Leads/Electrodes" 
                  items={leads} 
                  type="leads"
                  icon={<Heart className="h-4 w-4" />}
                />
                
                <MaterialSection 
                  title="Materials" 
                  items={materials} 
                  type="materials"
                  icon={<Building2 className="h-4 w-4" />}
                />
                
                <MaterialSection 
                  title="Other Items" 
                  items={otherMaterials} 
                  type="others"
                  icon={<Plus className="h-4 w-4" />}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Procedure Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about the procedure..."
                        rows={4}
                        {...field} 
                        data-testid="input-procedure-notes"
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
                    disabled={createProcedureMutation.isPending}
                    data-testid="button-cancel-report"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={createProcedureMutation.isPending}
                  data-testid="button-save-report"
                >
                  {createProcedureMutation.isPending ? "Saving..." : "Save Implant Report"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => {
          setShowBarcodeScanner(false);
          setScanningItem(null);
        }}
        onScanComplete={handleScanComplete}
        title="Scan Product Barcode"
      />
    </div>
  );
}
