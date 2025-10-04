import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, Building2, User, Package, MapPin, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: Hospital;
  deviceProduct?: Product | null;
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
    enabled: !!procedureId && isOpen,
  });

  const { data: materials, isLoading: isMaterialsLoading } = useQuery<ProcedureMaterialWithProduct[]>({
    queryKey: ["/api/implant-procedures", procedureId, "materials"],
    enabled: !!procedureId && isOpen,
  });

  const isLoading = isProcedureLoading || isMaterialsLoading;

  const handleExportPDF = () => {
    if (!procedure) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Implant Procedure Report", 14, 20);
    
    // Procedure Information
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Procedure Information", 14, 35);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    let yPos = 45;
    doc.text(`Date: ${format(new Date(procedure.implantDate), "MMMM dd, yyyy")}`, 14, yPos);
    yPos += 7;
    doc.text(`Hospital: ${procedure.hospital.name}`, 14, yPos);
    yPos += 7;
    if (procedure.hospital.address) {
      doc.text(`Address: ${procedure.hospital.address}, ${procedure.hospital.zipCode} ${procedure.hospital.city}`, 14, yPos);
      yPos += 7;
    }
    doc.text(`Procedure Type: ${procedure.procedureType}`, 14, yPos);
    yPos += 7;
    if (procedure.patientId) {
      doc.text(`Patient ID: ${procedure.patientId}`, 14, yPos);
      yPos += 7;
    }
    
    // Device Information
    if (procedure.deviceUsed) {
      yPos += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Device Information", 14, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      
      if (procedure.deviceProduct?.name) {
        doc.text(`Device: ${procedure.deviceProduct.name}`, 14, yPos);
        yPos += 7;
      }
      if (procedure.deviceProduct?.modelNumber) {
        doc.text(`Model Number: ${procedure.deviceProduct.modelNumber}`, 14, yPos);
        yPos += 7;
      }
      if (procedure.deviceSerialNumber) {
        doc.text(`Serial Number: ${procedure.deviceSerialNumber}`, 14, yPos);
        yPos += 7;
      }
    }
    
    // Notes
    if (procedure.notes) {
      yPos += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Notes", 14, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      
      const splitNotes = doc.splitTextToSize(procedure.notes, 180);
      doc.text(splitNotes, 14, yPos);
      yPos += (splitNotes.length * 7);
    }
    
    // Materials Table
    if (materials && materials.length > 0) {
      yPos += 10;
      
      const tableData = materials.map(material => [
        material.product?.name || material.materialName || "External Material",
        material.product?.modelNumber || "-",
        material.serialNumber || "-",
        material.lotNumber || "-",
        material.quantity.toString(),
        material.source,
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Product", "Model Number", "Serial Number", "Lot Number", "Qty", "Source"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [66, 66, 66] },
      });
    }
    
    // Save the PDF
    const filename = `Implant_Report_${format(new Date(procedure.implantDate), "yyyy-MM-dd")}_${procedure.hospital.name.replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
  };

  if (!isOpen || !procedureId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-procedure-detail">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Implant Procedure Details
            </DialogTitle>
            {procedure && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="gap-2"
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>
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
                        {procedure.deviceProduct?.name || procedure.deviceUsed}
                      </p>
                      {procedure.deviceProduct?.modelNumber && (
                        <p className="text-sm text-muted-foreground">
                          Model: {procedure.deviceProduct.modelNumber}
                        </p>
                      )}
                      {procedure.deviceSerialNumber && (
                        <p className="text-sm text-muted-foreground">
                          Serial: {procedure.deviceSerialNumber}
                        </p>
                      )}
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
                        <TableHead>Serial / Lot</TableHead>
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
                          <TableCell data-testid={`text-material-serial-${index}`}>
                            {material.serialNumber ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">Serial:</span>
                                <span className="font-mono text-sm">{material.serialNumber}</span>
                              </div>
                            ) : material.lotNumber ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">Lot:</span>
                                <span className="font-mono text-sm">{material.lotNumber}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
