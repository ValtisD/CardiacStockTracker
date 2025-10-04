import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Pencil, Trash2, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ImplantProcedure, Hospital, Product } from "@shared/schema";
import { format } from "date-fns";
import ImplantProcedureDetailDialog from "@/components/ImplantProcedureDetailDialog";
import ImplantProcedureEditDialog from "@/components/ImplantProcedureEditDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: Hospital;
  deviceProduct?: Product;
}

export default function ImplantProceduresList() {
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [editProcedureId, setEditProcedureId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  const { data: procedures, isLoading } = useQuery<ImplantProcedureWithHospital[]>({
    queryKey: ["/api/implant-procedures"],
  });

  // Filter procedures based on search query
  const filteredProcedures = procedures?.filter((procedure) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Search in device serial number
    if (procedure.deviceSerialNumber?.toLowerCase().includes(query)) {
      return true;
    }
    
    // Search in device model number
    if (procedure.deviceProduct?.modelNumber?.toLowerCase().includes(query)) {
      return true;
    }
    
    // Search in device name
    if (procedure.deviceProduct?.name?.toLowerCase().includes(query)) {
      return true;
    }
    
    return false;
  }) || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/implant-procedures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/implant-procedures"] });
      toast({
        title: "Success",
        description: "Implant procedure deleted successfully",
      });
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete procedure",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setProcedureToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditProcedureId(id);
  };

  const confirmDelete = () => {
    if (procedureToDelete) {
      deleteMutation.mutate(procedureToDelete);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading procedures...</p>
      </div>
    );
  }

  if (!procedures || procedures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>No implant procedures found.</p>
        <p className="text-sm mt-2">Click "New Report" to record your first implant procedure.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by serial number, lot number, device name, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-procedures"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProcedures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p>No procedures match your search.</p>
              <p className="text-sm mt-2">Try a different search term.</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Procedure Type</TableHead>
                <TableHead>Device Name</TableHead>
                <TableHead>Model Number</TableHead>
                <TableHead>Serial/Lot Number</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcedures.map((procedure) => (
                <TableRow 
                  key={procedure.id} 
                  data-testid={`row-procedure-${procedure.id}`}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedProcedureId(procedure.id)}
                >
                  <TableCell className="font-medium" data-testid={`text-date-${procedure.id}`}>
                    {format(new Date(procedure.implantDate), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell data-testid={`text-hospital-${procedure.id}`}>
                    {procedure.hospital.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-type-${procedure.id}`}>
                      {procedure.procedureType}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-device-name-${procedure.id}`}>
                    {procedure.deviceProduct?.name || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-model-number-${procedure.id}`}>
                    {procedure.deviceProduct?.modelNumber || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-serial-lot-${procedure.id}`}>
                    {procedure.deviceSerialNumber || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-notes-${procedure.id}`}>
                    {procedure.notes ? (
                      <span className="text-sm truncate max-w-xs block">
                        {procedure.notes}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleEditClick(procedure.id, e)}
                        data-testid={`button-edit-${procedure.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDeleteClick(procedure.id, e)}
                        data-testid={`button-delete-${procedure.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      
      <ImplantProcedureDetailDialog
        procedureId={selectedProcedureId}
        isOpen={!!selectedProcedureId}
        onClose={() => setSelectedProcedureId(null)}
      />

      <ImplantProcedureEditDialog
        procedureId={editProcedureId}
        isOpen={!!editProcedureId}
        onClose={() => setEditProcedureId(null)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Implant Procedure</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this implant procedure? This action cannot be undone and will also delete all associated materials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover-elevate"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
