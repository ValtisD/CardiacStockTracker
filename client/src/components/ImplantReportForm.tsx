import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, Calendar, Building2, Plus, Minus, Scan } from "lucide-react";
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

const implantReportSchema = z.object({
  hospitalId: z.string().min(1, "Hospital is required"),
  patientId: z.string().optional(),
  implantDate: z.string().min(1, "Implant date is required"),
  procedureType: z.string().min(1, "Procedure type is required"),
  deviceUsed: z.string().optional(),
  notes: z.string().optional(),
});

type ImplantReportData = z.infer<typeof implantReportSchema>;

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  source: 'car' | 'external' | 'hospital';
  scanned?: boolean;
}

interface ImplantReportFormProps {
  onSubmit: (data: ImplantReportData & { materials: MaterialItem[] }) => void;
  onCancel?: () => void;
}

// Todo: remove mock functionality
const mockHospitals = [
  { id: '1', name: "St. Mary's Medical Center" },
  { id: '2', name: "Regional Heart Institute" },
  { id: '3', name: "Community General Hospital" }
];

const mockDevices = [
  { id: '1', name: 'Medtronic Azure Pacemaker (XT1234)' },
  { id: '2', name: 'Boston Scientific ICD (BS5678)' },
  { id: '3', name: 'Abbott CRT Device (AB9012)' }
];

export default function ImplantReportForm({ onSubmit, onCancel }: ImplantReportFormProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([
    // Pre-populated with typical procedure materials
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

  const form = useForm<ImplantReportData>({
    resolver: zodResolver(implantReportSchema),
    defaultValues: {
      hospitalId: "",
      patientId: "",
      implantDate: new Date().toISOString().split('T')[0],
      procedureType: "",
      deviceUsed: "",
      notes: "",
    },
  });

  const handleSubmit = (data: ImplantReportData) => {
    const allMaterials = [...materials, ...leads, ...otherMaterials].filter(m => m.name.trim() !== '');
    console.log('Implant report submitted:', { ...data, materials: allMaterials });
    onSubmit({ ...data, materials: allMaterials });
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

  const scanBarcode = (type: 'materials' | 'leads' | 'others', id: string) => {
    // Todo: remove mock functionality
    const mockBarcode = "123456789012";
    const mockProductName = "Scanned Medical Device";
    updateMaterialItem(type, id, 'name', mockProductName);
    updateMaterialItem(type, id, 'scanned', true);
    console.log(`Barcode scanned for ${type}:`, mockBarcode);
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
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6">
              <Input
                placeholder={`${title.slice(0, -1)} ${index + 1}`}
                value={item.name}
                onChange={(e) => updateMaterialItem(type, item.id, 'name', e.target.value)}
                data-testid={`input-${type}-${item.id}-name`}
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => updateMaterialItem(type, item.id, 'quantity', Math.max(0, item.quantity - 1))}
                  className="h-8 w-8"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="mx-2 w-8 text-center">{item.quantity}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => updateMaterialItem(type, item.id, 'quantity', item.quantity + 1)}
                  className="h-8 w-8"
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
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car Stock</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-1">
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
              {item.scanned && (
                <Badge variant="secondary" className="text-xs">Scanned</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

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
              {/* Basic Information */}
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
                          {mockHospitals.map(hospital => (
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-device">
                            <SelectValue placeholder="Select device" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockDevices.map(device => (
                            <SelectItem key={device.id} value={device.id}>
                              {device.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient ID (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Patient identifier (if applicable)" 
                        {...field} 
                        data-testid="input-patient-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Materials Sections */}
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
                    data-testid="button-cancel-report"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  data-testid="button-save-report"
                >
                  Save Implant Report
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}