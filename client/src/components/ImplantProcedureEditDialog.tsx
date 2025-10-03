import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Hospital, ImplantProcedure } from "@shared/schema";

const editProcedureSchema = z.object({
  hospitalId: z.string().min(1, "Hospital is required"),
  implantDate: z.string().min(1, "Implant date is required"),
  procedureType: z.string().min(1, "Procedure type is required"),
  patientId: z.string().optional(),
  deviceUsed: z.string().optional(),
  notes: z.string().optional(),
});

type EditProcedureData = z.infer<typeof editProcedureSchema>;

interface ImplantProcedureEditDialogProps {
  procedureId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: Hospital;
}

export default function ImplantProcedureEditDialog({
  procedureId,
  isOpen,
  onClose,
}: ImplantProcedureEditDialogProps) {
  const { toast } = useToast();

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: procedure } = useQuery<ImplantProcedureWithHospital>({
    queryKey: ["/api/implant-procedures", procedureId],
    queryFn: async () => {
      const res = await fetch(`/api/implant-procedures/${procedureId}`);
      if (!res.ok) throw new Error("Failed to fetch procedure");
      return res.json();
    },
    enabled: !!procedureId && isOpen,
  });

  const form = useForm<EditProcedureData>({
    resolver: zodResolver(editProcedureSchema),
    defaultValues: {
      hospitalId: "",
      implantDate: "",
      procedureType: "",
      patientId: "",
      deviceUsed: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (procedure) {
      form.reset({
        hospitalId: procedure.hospitalId,
        implantDate: procedure.implantDate,
        procedureType: procedure.procedureType,
        patientId: procedure.patientId || "",
        deviceUsed: procedure.deviceUsed || "",
        notes: procedure.notes || "",
      });
    }
  }, [procedure, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditProcedureData) => {
      return await apiRequest("PATCH", `/api/implant-procedures/${procedureId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/implant-procedures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/implant-procedures", procedureId] });
      toast({
        title: "Success",
        description: "Implant procedure updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update procedure",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditProcedureData) => {
    updateMutation.mutate(data);
  };

  if (!isOpen || !procedureId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-procedure">
        <DialogHeader>
          <DialogTitle>Edit Implant Procedure</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="hospitalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-hospital">
                        <SelectValue placeholder="Select hospital" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitals?.map((hospital) => (
                        <SelectItem
                          key={hospital.id}
                          value={hospital.id}
                          data-testid={`option-hospital-${hospital.id}`}
                        >
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
                    <Input type="date" {...field} data-testid="input-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="procedureType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Procedure Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-procedure-type">
                        <SelectValue placeholder="Select procedure type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pacemaker Implant">Pacemaker Implant</SelectItem>
                      <SelectItem value="ICD Implant">ICD Implant</SelectItem>
                      <SelectItem value="CRT-P Implant">CRT-P Implant</SelectItem>
                      <SelectItem value="CRT-D Implant">CRT-D Implant</SelectItem>
                      <SelectItem value="Device Replacement">Device Replacement</SelectItem>
                      <SelectItem value="Lead Replacement">Lead Replacement</SelectItem>
                      <SelectItem value="System Upgrade">System Upgrade</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient ID (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter patient ID" data-testid="input-patient-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceUsed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Used (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Medtronic Advisa DR" data-testid="input-device" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes about the procedure"
                      className="resize-none"
                      rows={4}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
