import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, Calendar, Building2, Plus, Minus, Scan, AlertCircle, X, FileText } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Hospital, Product, Inventory, InsertProcedureMaterial } from "@shared/schema";
import { clientInsertHospitalSchema } from "@shared/schema";
import BarcodeScanner from "@/components/BarcodeScanner";
import { GS1Data } from "@/lib/gs1Parser";
import { formStateManager } from "@/lib/formStateManager";

const getImplantReportSchema = (t: any) => z.object({
  hospitalId: z.string().min(1, t('procedures.hospitalRequired')),
  implantDate: z.string().min(1, t('procedures.implantDateRequired')),
  procedureType: z.string().min(1, t('procedures.procedureTypeRequired')),
  deviceUsed: z.string().optional(),
  deviceSerialNumber: z.string().optional(),
  deviceLotNumber: z.string().optional(),
  deviceSource: z.enum(['car', 'external', 'hospital']).default('car'),
  notes: z.string().optional(),
});

type ImplantReportData = z.infer<ReturnType<typeof getImplantReportSchema>>;

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth0();
  
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanningItem, setScanningItem] = useState<{ type: 'materials' | 'leads' | 'others' | 'device', id: string } | null>(null);
  const [scannedDeviceId, setScannedDeviceId] = useState<string>('');
  const [isAddHospitalDialogOpen, setIsAddHospitalDialogOpen] = useState(false);
  const [isRestoredDraft, setIsRestoredDraft] = useState(false);
  const restorationAttempted = useRef(false);
  const restorationComplete = useRef(false);

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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/implant-procedures'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      
      // Clear saved draft after successful submission
      if (user?.sub) {
        await formStateManager.deleteDraft('implant-report');
        console.log('🗑️ Draft cleared after successful submission');
      }
      
      toast({
        title: t('common.success'),
        description: t('procedures.reportSavedSuccess'),
      });

      if (onSubmit) {
        onSubmit(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('procedures.reportSaveFailed'),
        variant: "destructive",
      });
    },
  });

  const createHospitalMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientInsertHospitalSchema>) => {
      const res = await apiRequest("POST", "/api/hospitals", data);
      return res.json();
    },
    onSuccess: (data: Hospital) => {
      // Optimistically add the new hospital to the query data
      queryClient.setQueryData<Hospital[]>(["/api/hospitals"], (old = []) => [...old, data]);
      
      toast({
        title: t('common.success'),
        description: t('procedures.hospitalAddedSuccess'),
      });
      setIsAddHospitalDialogOpen(false);
      
      // Set the newly created hospital as selected
      form.setValue('hospitalId', data.id);
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('procedures.hospitalAddFailed'),
        variant: "destructive",
      });
    },
  });

  const form = useForm<ImplantReportData>({
    resolver: zodResolver(getImplantReportSchema(t)),
    defaultValues: {
      hospitalId: "",
      implantDate: new Date().toISOString().split('T')[0],
      procedureType: "",
      deviceUsed: "",
      deviceSource: "car",
      notes: "",
    },
  });

  // Restore draft on component mount
  useEffect(() => {
    const restoreDraft = async () => {
      if (!user?.sub || restorationAttempted.current) return;
      
      const draft = await formStateManager.getDraft('implant-report');
      if (draft) {
        console.log('📄 Restoring form draft...', draft);
        
        // Restore form fields
        if (draft.formData.hospitalId) form.setValue('hospitalId', draft.formData.hospitalId);
        if (draft.formData.implantDate) form.setValue('implantDate', draft.formData.implantDate);
        if (draft.formData.procedureType) form.setValue('procedureType', draft.formData.procedureType);
        if (draft.formData.deviceUsed) form.setValue('deviceUsed', draft.formData.deviceUsed);
        if (draft.formData.deviceSource) form.setValue('deviceSource', draft.formData.deviceSource);
        if (draft.formData.deviceSerialNumber) form.setValue('deviceSerialNumber', draft.formData.deviceSerialNumber);
        if (draft.formData.deviceLotNumber) form.setValue('deviceLotNumber', draft.formData.deviceLotNumber);
        if (draft.formData.notes) form.setValue('notes', draft.formData.notes);
        
        // Restore materials
        if (draft.formData.materials && draft.formData.materials.length > 0) {
          setMaterials(draft.formData.materials);
        }
        if (draft.formData.leads && draft.formData.leads.length > 0) {
          setLeads(draft.formData.leads);
        }
        if (draft.formData.otherMaterials && draft.formData.otherMaterials.length > 0) {
          setOtherMaterials(draft.formData.otherMaterials);
        }
        
        setIsRestoredDraft(true);
      } else {
        // No draft found - mark restoration complete immediately
        restorationComplete.current = true;
        console.log('✅ No draft to restore, auto-save enabled');
      }
      
      restorationAttempted.current = true;
    };
    
    restoreDraft();
  }, [user, form]);

  // Mark restoration complete after materials have been set
  useEffect(() => {
    if (restorationAttempted.current && !restorationComplete.current) {
      restorationComplete.current = true;
      console.log('✅ Draft restoration complete, enabling auto-save');
    }
  }, [materials, leads, otherMaterials]);

  // Auto-save form data (form fields + materials state)
  useEffect(() => {
    if (!user?.sub) return;
    
    // Build draft data from current form values and state
    const saveDraft = () => {
      // Guard: only save after restoration is complete
      if (!restorationComplete.current) return;
      
      const formValues = form.getValues();
      const draftData = {
        hospitalId: formValues.hospitalId,
        implantDate: formValues.implantDate,
        procedureType: formValues.procedureType,
        deviceUsed: formValues.deviceUsed,
        deviceSource: formValues.deviceSource,
        deviceSerialNumber: formValues.deviceSerialNumber,
        deviceLotNumber: formValues.deviceLotNumber,
        notes: formValues.notes,
        materials,
        leads,
        otherMaterials,
      };
      
      // Auto-save with debouncing
      formStateManager.autoSave('implant-report', user.sub!, draftData, '/reports');
    };
    
    // Always subscribe to form field changes (but saveDraft guards against early saves)
    const subscription = form.watch(() => {
      saveDraft();
    });
    
    // Defer initial save to next tick to ensure materials state has been updated
    // This prevents race condition where restoration completes before materials are set
    const initialSaveTimer = setTimeout(() => {
      saveDraft();
    }, 0);
    
    // Cleanup subscription and timer
    return () => {
      subscription.unsubscribe();
      clearTimeout(initialSaveTimer);
      formStateManager.cancelAutoSave();
    };
  }, [
    materials, 
    leads, 
    otherMaterials, 
    user,
    form
  ]);

  // Handle cancel with draft cleanup
  const handleCancel = async () => {
    if (user?.sub) {
      await formStateManager.deleteDraft('implant-report');
      console.log('🗑️ Draft cleared on cancel');
    }
    if (onCancel) {
      onCancel();
    }
  };

  const deviceProducts = products; // All products can be used as devices

  // Helper function to get available quantity for a product in car stock
  // For lot-tracked items, this returns total quantity across all lots
  const getCarStockQuantity = (productId: string): number => {
    const inventoryItems = carInventory.filter(inv => inv.productId === productId);
    return inventoryItems.reduce((total, item) => total + item.quantity, 0);
  };
  
  // Helper function to check if specific lot/serial exists in car stock
  const getCarStockQuantityForLotSerial = (productId: string, serialNumber?: string, lotNumber?: string): number => {
    if (!productId) return 0;
    
    // For serial-tracked items: match both productId AND serialNumber
    if (serialNumber) {
      const inventoryItem = carInventory.find(
        inv => inv.productId === productId && inv.serialNumber === serialNumber
      );
      return inventoryItem?.quantity || 0;
    }
    
    // For lot-tracked items: match both productId AND lotNumber
    if (lotNumber) {
      const inventoryItems = carInventory.filter(
        inv => inv.productId === productId && inv.lotNumber === lotNumber
      );
      return inventoryItems.reduce((total, item) => total + item.quantity, 0);
    }
    
    // For non-tracked items: match productId only (sum all quantities)
    const inventoryItems = carInventory.filter(inv => inv.productId === productId);
    return inventoryItems.reduce((total, item) => total + item.quantity, 0);
  };

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
          title: t('procedures.stockError'),
          description: t('procedures.productNotFoundInCar', { product: material.materialName }),
          variant: "destructive",
        });
        return;
      }
      if (material.quantity && inventoryItem.quantity < material.quantity) {
        toast({
          title: t('procedures.insufficientStock'),
          description: t('procedures.notEnoughStock', { product: material.materialName, available: inventoryItem.quantity, required: material.quantity }),
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

  // Add new material item
  const addMaterialItem = (type: 'materials' | 'others') => {
    const setter = type === 'materials' ? setMaterials : setOtherMaterials;
    const currentItems = type === 'materials' ? materials : otherMaterials;
    
    const newId = `${Date.now()}`; // Use timestamp as unique ID
    setter(prev => [...prev, { 
      id: newId, 
      name: '', 
      quantity: 1, 
      source: 'car' 
    }]);
  };

  // Remove material item
  const removeMaterialItem = (type: 'materials' | 'others', id: string) => {
    const setter = type === 'materials' ? setMaterials : setOtherMaterials;
    
    setter(prev => prev.filter(item => item.id !== id));
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
        
        // Set device serial/lot number from GS1 data (clear the opposite field)
        if (gs1Data?.serialNumber) {
          form.setValue('deviceSerialNumber', gs1Data.serialNumber);
          form.setValue('deviceLotNumber', ''); // Clear lot when setting serial
        } else if (gs1Data?.lotNumber) {
          form.setValue('deviceLotNumber', gs1Data.lotNumber);
          form.setValue('deviceSerialNumber', ''); // Clear serial when setting lot
        } else {
          // No serial or lot in GS1 data - clear both
          form.setValue('deviceSerialNumber', '');
          form.setValue('deviceLotNumber', '');
        }
      } else {
        toast({
          title: t('procedures.productNotFound'),
          description: t('procedures.scannedProductNotInDb'),
          variant: "destructive",
        });
      }
    } else {
      // Handle materials/leads/others scanning
      if (productInfo) {
        // Check for duplicate serialized items if serial number is present
        if (gs1Data?.serialNumber && checkDuplicateSerial(gs1Data.serialNumber, type, id)) {
          toast({
            title: t('procedures.duplicateItem'),
            description: t('procedures.itemAlreadyAdded', { product: productInfo.name, serial: gs1Data.serialNumber }),
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
      } else {
        // Product not found - clear productId and set barcode as manual entry
        updateMaterialItem(type, id, 'productId', undefined);
        updateMaterialItem(type, id, 'name', barcode);
        updateMaterialItem(type, id, 'scanned', true);
      }
    }
    
    setScanningItem(null);
    setShowBarcodeScanner(false);
  };

  const getInventoryQuantity = (productId?: string, serialNumber?: string, lotNumber?: string): number => {
    if (!productId) return 0;
    
    // Use the lot/serial-aware function
    return getCarStockQuantityForLotSerial(productId, serialNumber, lotNumber);
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
    const canAddRemove = type === 'materials' || type === 'others'; // Only materials and miscellaneous can be dynamic

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              {icon}
              {title}
            </div>
            {canAddRemove && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addMaterialItem(type)}
                data-testid={`button-add-${type}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('procedures.addItem')}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => {
            const availableQty = getInventoryQuantity(item.productId, item.serialNumber, item.lotNumber);
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
                        <SelectValue placeholder={t('procedures.selectItem', { number: index + 1 })}>
                          {item.name || t('procedures.selectItem', { number: index + 1 })}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{t('procedures.enterManually')}</SelectItem>
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
                        placeholder={t('procedures.enterNameManually')}
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
                        <SelectItem value="car">{t('procedures.carStock')}</SelectItem>
                        <SelectItem value="external">{t('procedures.external')}</SelectItem>
                        <SelectItem value="hospital">{t('procedures.hospitalStock')}</SelectItem>
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
                    {canAddRemove && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMaterialItem(type, item.id)}
                        className="h-8 w-8"
                        data-testid={`button-remove-${type}-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                    {item.scanned && (
                      <Badge variant="secondary" className="text-xs">{t('procedures.scanned')}</Badge>
                    )}
                  </div>
                </div>
                {item.serialNumber && (
                  <div className="text-xs text-muted-foreground ml-1">
                    {t('procedures.serial')}: {item.serialNumber}
                  </div>
                )}
                {item.lotNumber && !item.serialNumber && (
                  <div className="text-xs text-muted-foreground ml-1">
                    {t('procedures.lot')}: {item.lotNumber}
                  </div>
                )}
                {item.source === 'car' && item.productId && (
                  <div className="flex items-center gap-2 text-xs ml-1">
                    {isLowStock ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <span className="text-destructive" data-testid={`text-stock-warning-${type}-${item.id}`}>
                          {t('procedures.insufficientStockAvailable', { qty: availableQty })}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground" data-testid={`text-stock-available-${type}-${item.id}`}>
                        {t('procedures.availableInCar', { qty: availableQty })}
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
            {t('procedures.implantProcedureReport')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {isRestoredDraft && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    {t('procedures.draftRestored', { defaultValue: 'Your unsaved work has been restored. You can continue where you left off.' })}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('procedures.hospitalFacility')}</FormLabel>
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-hospital" className="flex-1">
                              <SelectValue placeholder={t('procedures.selectHospital')} />
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
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setIsAddHospitalDialogOpen(true)}
                          data-testid="button-add-hospital-inline"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="implantDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('procedures.implantDate')}</FormLabel>
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
                      <FormLabel>{t('procedures.procedureType')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-procedure-type">
                            <SelectValue placeholder={t('procedures.selectProcedureType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pacemaker">{t('procedures.pacemakerImplant')}</SelectItem>
                          <SelectItem value="ICD">{t('procedures.icdImplant')}</SelectItem>
                          <SelectItem value="CRT">{t('procedures.crtImplant')}</SelectItem>
                          <SelectItem value="Replacement">{t('procedures.deviceReplacement')}</SelectItem>
                          <SelectItem value="Lead_Revision">{t('procedures.leadRevision')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel>{t('procedures.primaryDevice')}</FormLabel>
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-7">
                      <FormField
                        control={form.control}
                        name="deviceUsed"
                        render={({ field }) => (
                          <FormItem>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Auto-fetch and set serial/lot number from inventory
                                const { serialNumber, lotNumber } = getInventorySerialLot(value);
                                if (serialNumber) {
                                  form.setValue('deviceSerialNumber', serialNumber);
                                  form.setValue('deviceLotNumber', ''); // Clear lot if serial is present
                                } else if (lotNumber) {
                                  form.setValue('deviceSerialNumber', ''); // Clear serial if lot is present
                                  form.setValue('deviceLotNumber', lotNumber);
                                } else {
                                  // Clear both if neither is present
                                  form.setValue('deviceSerialNumber', '');
                                  form.setValue('deviceLotNumber', '');
                                }
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8" data-testid="select-device">
                                  <SelectValue placeholder={t('procedures.selectDevice')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {deviceProducts.map(device => {
                                  const carQty = getCarStockQuantity(device.id);
                                  return (
                                    <SelectItem key={device.id} value={device.id}>
                                      {device.name} ({device.modelNumber}) - {t('procedures.car')}: {carQty}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name="deviceSource"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8" data-testid="select-device-source">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="car">{t('procedures.carStock')}</SelectItem>
                                <SelectItem value="external">{t('procedures.external')}</SelectItem>
                                <SelectItem value="hospital">{t('procedures.hospitalStock')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scanBarcode('device', 'primary-device')}
                        data-testid="button-scan-device"
                        className="h-8 w-8"
                      >
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {form.watch('deviceSerialNumber') && (
                    <div className="text-xs text-muted-foreground ml-1">
                      {t('procedures.serial')}: {form.watch('deviceSerialNumber')}
                    </div>
                  )}
                  {form.watch('deviceLotNumber') && !form.watch('deviceSerialNumber') && (
                    <div className="text-xs text-muted-foreground ml-1">
                      {t('procedures.lot')}: {form.watch('deviceLotNumber')}
                    </div>
                  )}
                  {form.watch('deviceUsed') && form.watch('deviceSource') === 'car' && (
                    <div className="flex items-center gap-2 text-xs ml-1">
                      {(() => {
                        const deviceId = form.watch('deviceUsed') || '';
                        const deviceSerial = form.watch('deviceSerialNumber') || undefined;
                        const deviceLot = form.watch('deviceLotNumber') || undefined;
                        const carQty = getCarStockQuantityForLotSerial(deviceId, deviceSerial, deviceLot);
                        const hasNoStock = carQty === 0;
                        return hasNoStock ? (
                          <>
                            <AlertCircle className="h-3 w-3 text-destructive" />
                            <span className="text-destructive" data-testid="text-stock-warning-device">
                              {t('procedures.noStockInCar')}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground" data-testid="text-stock-available-device">
                            {t('procedures.availableInCar', { qty: carQty })}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <MaterialSection 
                  title={t('procedures.leadsElectrodes')} 
                  items={leads} 
                  type="leads"
                  icon={<Heart className="h-4 w-4" />}
                />
                
                <MaterialSection 
                  title={t('procedures.materials')} 
                  items={materials} 
                  type="materials"
                  icon={<Building2 className="h-4 w-4" />}
                />
                
                <MaterialSection 
                  title={t('procedures.otherItems')} 
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
                    <FormLabel>{t('procedures.procedureNotes')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('procedures.procedureNotesPlaceholder')}
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
                    onClick={handleCancel}
                    disabled={createProcedureMutation.isPending}
                    data-testid="button-cancel-report"
                  >
                    {t('common.cancel')}
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={createProcedureMutation.isPending}
                  data-testid="button-save-report"
                >
                  {createProcedureMutation.isPending ? t('common.saving') : t('procedures.saveImplantReport')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Barcode Scanner - Only render when open to reset state */}
      {showBarcodeScanner && (
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => {
            setShowBarcodeScanner(false);
            setScanningItem(null);
          }}
          onScanComplete={handleScanComplete}
          title={t('procedures.scanProductBarcode')}
        />
      )}

      <Dialog open={isAddHospitalDialogOpen} onOpenChange={setIsAddHospitalDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('procedures.addNewHospital')}</DialogTitle>
          </DialogHeader>
          <HospitalFormInline
            onSubmit={(data) => createHospitalMutation.mutate(data)}
            onCancel={() => setIsAddHospitalDialogOpen(false)}
            isSubmitting={createHospitalMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface HospitalFormInlineProps {
  onSubmit: (data: z.infer<typeof clientInsertHospitalSchema>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function HospitalFormInline({ onSubmit, onCancel, isSubmitting }: HospitalFormInlineProps) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof clientInsertHospitalSchema>>({
    resolver: zodResolver(clientInsertHospitalSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      zipCode: "",
      primaryPhysician: undefined,
      contactPhone: undefined,
      notes: undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('procedures.hospitalName')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('procedures.hospitalNamePlaceholder')}
                  {...field}
                  data-testid="input-inline-hospital-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('procedures.address')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('procedures.addressPlaceholder')}
                  {...field}
                  data-testid="input-inline-hospital-address"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('procedures.zipCode')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('procedures.zipCodePlaceholder')}
                    {...field}
                    data-testid="input-inline-hospital-zipcode"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('procedures.city')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('procedures.cityPlaceholder')}
                    {...field}
                    data-testid="input-inline-hospital-city"
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
            name="primaryPhysician"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('procedures.primaryPhysicianOptional')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('procedures.physicianPlaceholder')}
                    {...field}
                    value={field.value || ""}
                    data-testid="input-inline-hospital-physician"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('procedures.contactPhoneOptional')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('procedures.phonePlaceholder')}
                    {...field}
                    value={field.value || ""}
                    data-testid="input-inline-hospital-phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('procedures.notesOptional')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('procedures.hospitalNotesPlaceholder')}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-inline-hospital-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-cancel-inline-hospital"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-save-inline-hospital"
          >
            {isSubmitting ? t('common.saving') : t('procedures.addHospital')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
