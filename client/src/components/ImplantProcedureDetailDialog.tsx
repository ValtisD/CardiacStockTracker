import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, Building2, User, Package, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImplantProcedure, Hospital, ProcedureMaterial, Product } from "@shared/schema";
import { format } from "date-fns";

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: Hospital;
}

interface ProcedureMaterialWithProduct extends ProcedureMaterial {
  product: Product;
}

interface ImplantProcedureDetailDialogProps {
  procedureId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImplantProcedureDetailDialog({
  procedureId,
  isOpen,
  onClose,
}: ImplantProcedureDetailDialogProps) {
  const { data: procedure, isLoading: isProcedureLoading } = useQuery<ImplantProcedureWithHospital>({
    queryKey: ["/api/implant-procedures", procedureId],
    queryFn: async () => {
      const res = await fetch(`/api/implant-procedures/${procedureId}`);
      if (!res.ok) throw new Error("Failed to fetch procedure");
      return res.json();
    },
    enabled: !!procedureId && isOpen,
  });

  const { data: materials, isLoading: isMaterialsLoading } = useQuery<ProcedureMaterialWithProduct[]>({
    queryKey: ["/api/implant-procedures", procedureId, "materials"],
    queryFn: async () => {
      const res = await fetch(`/api/implant-procedures/${procedureId}/materials`);
      if (!res.ok) throw new Error("Failed to fetch materials");
      return res.json();
    },
    enabled: !!procedureId && isOpen,
  });

  const isLoading = isProcedureLoading || isMaterialsLoading;

  if (!isOpen || !procedureId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-procedure-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Implant Procedure Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading procedure details...</p>
          </div>
        ) : !procedure ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Procedure not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Procedure Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Date</p>
                      <p className="text-base" data-testid="text-procedure-date">
                        {format(new Date(procedure.implantDate), "MMMM dd, yyyy")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Hospital</p>
                      <p className="text-base" data-testid="text-procedure-hospital">
                        {procedure.hospital.name}
                      </p>
                      {procedure.hospital.address && (
                        <p className="text-sm text-muted-foreground">{procedure.hospital.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Procedure Type</p>
                      <Badge variant="outline" data-testid="badge-procedure-type">
                        {procedure.procedureType}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Patient ID</p>
                      <p className="text-base" data-testid="text-procedure-patient">
                        {procedure.patientId || <span className="text-muted-foreground">Not specified</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {procedure.deviceUsed && (
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Device Used</p>
                      <p className="text-base" data-testid="text-procedure-device">
                        {procedure.deviceUsed}
                      </p>
                    </div>
                  </div>
                )}


                {procedure.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm" data-testid="text-procedure-notes">
                      {procedure.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Materials Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!materials || materials.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">
                    No materials recorded for this procedure.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Model Number</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material, index) => (
                        <TableRow key={material.id} data-testid={`row-material-${index}`}>
                          <TableCell className="font-medium" data-testid={`text-material-name-${index}`}>
                            {material.product?.name || material.materialName || "External Material"}
                          </TableCell>
                          <TableCell data-testid={`text-material-model-${index}`}>
                            {material.product?.modelNumber || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {material.product?.category ? (
                              <Badge variant="outline" data-testid={`badge-material-category-${index}`}>
                                {material.product.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground" data-testid={`badge-material-category-${index}`}>-</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-material-quantity-${index}`}>
                            {material.quantity}
                          </TableCell>
                          <TableCell data-testid={`text-material-source-${index}`}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="capitalize">{material.source}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
