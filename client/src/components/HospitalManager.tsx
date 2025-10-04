import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Phone, MapPin, Plus, Edit, Search, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Hospital, ImplantProcedure } from "@shared/schema";
import { clientInsertHospitalSchema } from "@shared/schema";
import { z } from "zod";

type HospitalFormData = z.infer<typeof clientInsertHospitalSchema>;

interface HospitalWithProcedures extends Hospital {
  recentProcedures: number;
}

export default function HospitalManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [deletingHospitalId, setDeletingHospitalId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch hospitals
  const { data: hospitals, isLoading: hospitalsLoading } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  // Fetch procedures to calculate recent procedures count
  const { data: procedures } = useQuery<ImplantProcedure[]>({
    queryKey: ["/api/implant-procedures"],
  });

  // Calculate recent procedures for each hospital
  const hospitalsWithProcedures: HospitalWithProcedures[] = useMemo(() => {
    if (!hospitals) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return hospitals.map(hospital => {
      const recentProcedures = procedures?.filter(proc => {
        const procDate = new Date(proc.implantDate);
        return proc.hospitalId === hospital.id && procDate >= thirtyDaysAgo;
      }).length || 0;
      
      return {
        ...hospital,
        recentProcedures,
      };
    });
  }, [hospitals, procedures]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: HospitalFormData) => {
      const res = await apiRequest("POST", "/api/hospitals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      toast({
        title: "Success",
        description: "Hospital added successfully",
      });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add hospital",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HospitalFormData> }) => {
      const res = await apiRequest("PATCH", `/api/hospitals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      toast({
        title: "Success",
        description: "Hospital updated successfully",
      });
      setEditingHospital(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update hospital",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hospitals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      toast({
        title: "Success",
        description: "Hospital deleted successfully",
      });
      setDeletingHospitalId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete hospital",
        variant: "destructive",
      });
      setDeletingHospitalId(null);
    },
  });

  const filteredHospitals = hospitalsWithProcedures.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.primaryPhysician?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (hospitalsLoading) {
    return <HospitalManagerSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Hospital & Customer Management
              <Badge variant="secondary">{filteredHospitals.length} facilities</Badge>
            </CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-hospital">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Hospital
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Hospital</DialogTitle>
                </DialogHeader>
                <HospitalForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  onCancel={() => setIsAddDialogOpen(false)}
                  isSubmitting={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hospitals, cities, or physicians..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-hospital-search"
              />
            </div>
          </div>

          {/* Hospital Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Primary Physician</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Recent Procedures</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHospitals.map((hospital) => (
                  <TableRow key={hospital.id} data-testid={`row-hospital-${hospital.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{hospital.name}</div>
                        {hospital.notes && (
                          <div className="text-sm text-muted-foreground">{hospital.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-1 text-muted-foreground" />
                        <div className="text-sm">
                          <div>{hospital.address}</div>
                          <div>{hospital.zipCode} {hospital.city}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hospital.primaryPhysician && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{hospital.primaryPhysician}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {hospital.contactPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{hospital.contactPhone}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={hospital.recentProcedures > 5 ? 'default' : 'secondary'}>
                        {hospital.recentProcedures}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingHospital(hospital)}
                          data-testid={`button-edit-hospital-${hospital.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeletingHospitalId(hospital.id)}
                          data-testid={`button-delete-hospital-${hospital.id}`}
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

          {filteredHospitals.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No hospitals found matching your search criteria.
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{hospitalsWithProcedures.length}</div>
                <p className="text-xs text-muted-foreground">Total Hospitals</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {hospitalsWithProcedures.reduce((sum, h) => sum + h.recentProcedures, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total Procedures (30 days)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {hospitalsWithProcedures.filter(h => h.recentProcedures > 0).length}
                </div>
                <p className="text-xs text-muted-foreground">Active Facilities</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingHospital && (
        <Dialog open={!!editingHospital} onOpenChange={() => setEditingHospital(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Hospital</DialogTitle>
            </DialogHeader>
            <HospitalForm
              initialData={editingHospital}
              onSubmit={(data) => updateMutation.mutate({ id: editingHospital.id, data })}
              onCancel={() => setEditingHospital(null)}
              isSubmitting={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingHospitalId} onOpenChange={() => setDeletingHospitalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this hospital. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingHospitalId && handleDelete(deletingHospitalId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface HospitalFormProps {
  initialData?: Hospital;
  onSubmit: (data: HospitalFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function HospitalForm({ initialData, onSubmit, onCancel, isSubmitting }: HospitalFormProps) {
  const form = useForm<HospitalFormData>({
    resolver: zodResolver(clientInsertHospitalSchema),
    defaultValues: {
      name: initialData?.name || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      zipCode: initialData?.zipCode || "",
      primaryPhysician: initialData?.primaryPhysician || undefined,
      contactPhone: initialData?.contactPhone || undefined,
      notes: initialData?.notes || undefined,
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
              <FormLabel>Hospital Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., St. Mary's Medical Center"
                  {...field}
                  data-testid="input-hospital-name"
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
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 123 Healthcare Blvd"
                  {...field}
                  data-testid="input-hospital-address"
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
                <FormLabel>Zip Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 10115"
                    {...field}
                    data-testid="input-hospital-zipcode"
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
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Berlin"
                    {...field}
                    data-testid="input-hospital-city"
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
                <FormLabel>Primary Physician (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Dr. Sarah Johnson"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-hospital-physician"
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
                <FormLabel>Contact Phone (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., (555) 123-4567"
                    {...field}
                    value={field.value || ""}
                    data-testid="input-hospital-phone"
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
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this facility..."
                  {...field}
                  value={field.value || ""}
                  data-testid="input-hospital-notes"
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
            data-testid="button-cancel-form"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-save-hospital"
          >
            {isSubmitting ? "Saving..." : initialData ? "Update Hospital" : "Add Hospital"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function HospitalManagerSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <div className="border rounded-md p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
