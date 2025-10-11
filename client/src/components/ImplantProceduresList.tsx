import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Pencil, Trash2, Search, MoreVertical, Calendar, Building2 } from "lucide-react";
import { useTranslation } from 'react-i18next';
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  deviceProduct?: Product | null;
}

export default function ImplantProceduresList() {
  const { t } = useTranslation();
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [editProcedureId, setEditProcedureId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  const { data: rawProcedures, isLoading: proceduresLoading } = useQuery<ImplantProcedure[]>({
    queryKey: ["/api/implant-procedures"],
  });

  const { data: hospitals, isLoading: hospitalsLoading } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  // Join procedures with hospitals (for offline compatibility)
  const procedures = useMemo(() => {
    if (!rawProcedures) return [];
    
    return rawProcedures.map(procedure => {
      // If hospital is already populated (online), use it
      if ((procedure as any).hospital) {
        return procedure as ImplantProcedureWithHospital;
      }
      
      // Otherwise, join manually (offline) - work even if hospitals aren't cached
      const hospital = hospitals?.find(h => h.id === procedure.hospitalId);
      return {
        ...procedure,
        hospital: hospital || { 
          id: procedure.hospitalId, 
          name: t('procedures.unknownHospital', 'Unknown Hospital'),
          address: '',
          city: '',
          zipCode: '',
          primaryPhysician: null,
          contactPhone: null,
          notes: null,
          createdAt: null,
        } as Hospital,
      } as ImplantProcedureWithHospital;
    });
  }, [rawProcedures, hospitals, t]);

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
        title: t('common.success'),
        description: t('procedures.deleteSuccess'),
      });
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('procedures.deleteFailed'),
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

  // Only show loading if procedures aren't loaded yet (allow hospitals to load separately)
  if (proceduresLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t('procedures.loadingProcedures')}</p>
      </div>
    );
  }

  if (!procedures || procedures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>{t('procedures.noProceduresFound')}</p>
        <p className="text-sm mt-2">{t('procedures.clickNewReportHint')}</p>
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
              placeholder={t('procedures.searchPlaceholder')}
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
              <p>{t('procedures.noMatchingProcedures')}</p>
              <p className="text-sm mt-2">{t('procedures.tryDifferentSearch')}</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden p-3 space-y-3">
                {filteredProcedures.map((procedure) => (
                  <Card 
                    key={procedure.id} 
                    className="hover-elevate cursor-pointer" 
                    onClick={() => setSelectedProcedureId(procedure.id)}
                    data-testid={`card-procedure-${procedure.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium">{format(new Date(procedure.implantDate), "MMM dd, yyyy")}</span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="font-semibold truncate">{procedure.deviceProduct?.name || t('procedures.externalDevice')}</p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{procedure.deviceProduct?.name || t('procedures.externalDevice')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {procedure.procedureType}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-menu-${procedure.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(procedure.id, e); }} data-testid={`menu-edit-${procedure.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(procedure.id, e); }} className="text-destructive" data-testid={`menu-delete-${procedure.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate">{procedure.hospital.name}</span>
                        </div>
                        {procedure.deviceProduct?.modelNumber && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{t('procedures.model')}:</span> {procedure.deviceProduct.modelNumber}
                          </div>
                        )}
                        {procedure.deviceSerialNumber && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{t('procedures.serial')}:</span> {procedure.deviceSerialNumber}
                          </div>
                        )}
                        {procedure.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{procedure.notes}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('procedures.date')}</TableHead>
                      <TableHead>{t('procedures.hospital')}</TableHead>
                      <TableHead>{t('procedures.procedureType')}</TableHead>
                      <TableHead>{t('procedures.deviceName')}</TableHead>
                      <TableHead>{t('procedures.modelNumber')}</TableHead>
                      <TableHead>{t('procedures.serialLotNumber')}</TableHead>
                      <TableHead>{t('procedures.notes')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                        <TableCell className="max-w-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block" data-testid={`text-hospital-${procedure.id}`}>
                                {procedure.hospital.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{procedure.hospital.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-type-${procedure.id}`}>
                            {procedure.procedureType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block" data-testid={`text-device-name-${procedure.id}`}>
                                {procedure.deviceProduct?.name || <span className="text-muted-foreground">-</span>}
                              </span>
                            </TooltipTrigger>
                            {procedure.deviceProduct?.name && (
                              <TooltipContent>
                                <p>{procedure.deviceProduct.name}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
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
                        <TableCell className="max-w-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate block" data-testid={`text-notes-${procedure.id}`}>
                                {procedure.notes || <span className="text-muted-foreground">-</span>}
                              </span>
                            </TooltipTrigger>
                            {procedure.notes && (
                              <TooltipContent className="max-w-sm">
                                <p>{procedure.notes}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
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
              </div>
            </>
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
            <AlertDialogTitle>{t('procedures.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('procedures.deleteDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover-elevate"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
