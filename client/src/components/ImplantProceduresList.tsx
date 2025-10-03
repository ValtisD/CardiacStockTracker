import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ImplantProcedure, Hospital } from "@shared/schema";
import { format } from "date-fns";
import ImplantProcedureDetailDialog from "@/components/ImplantProcedureDetailDialog";

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: Hospital;
}

export default function ImplantProceduresList() {
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  
  const { data: procedures, isLoading } = useQuery<ImplantProcedureWithHospital[]>({
    queryKey: ["/api/implant-procedures"],
  });

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
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Procedure Type</TableHead>
              <TableHead>Patient ID</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {procedures.map((procedure) => (
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
                <TableCell data-testid={`text-patient-${procedure.id}`}>
                  {procedure.patientId || <span className="text-muted-foreground">-</span>}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      
      <ImplantProcedureDetailDialog
        procedureId={selectedProcedureId}
        isOpen={!!selectedProcedureId}
        onClose={() => setSelectedProcedureId(null)}
      />
    </Card>
  );
}
