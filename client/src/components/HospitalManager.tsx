import { useState } from "react";
import { Building2, Phone, MapPin, Plus, Edit, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  primaryPhysician?: string;
  contactPhone?: string;
  notes?: string;
  recentProcedures: number;
}

interface HospitalManagerProps {
  hospitals?: Hospital[];
  onAddHospital?: (hospital: Omit<Hospital, 'id' | 'recentProcedures'>) => void;
  onEditHospital?: (id: string, hospital: Partial<Hospital>) => void;
}

// Todo: remove mock functionality
const mockHospitals: Hospital[] = [
  {
    id: '1',
    name: 'St. Mary\'s Medical Center',
    address: '123 Healthcare Blvd',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    primaryPhysician: 'Dr. Sarah Johnson',
    contactPhone: '(555) 123-4567',
    notes: 'Large cardiac unit, frequent implant procedures',
    recentProcedures: 8
  },
  {
    id: '2',
    name: 'Regional Heart Institute',
    address: '456 Cardiac Way',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    primaryPhysician: 'Dr. Michael Chen',
    contactPhone: '(555) 987-6543',
    notes: 'Specialized cardiac facility',
    recentProcedures: 12
  },
  {
    id: '3',
    name: 'Community General Hospital',
    address: '789 Main Street',
    city: 'Peoria',
    state: 'IL',
    zipCode: '61602',
    primaryPhysician: 'Dr. Emily Davis',
    contactPhone: '(555) 456-7890',
    notes: 'Small but active cardiac program',
    recentProcedures: 3
  }
];

export default function HospitalManager({ hospitals = mockHospitals, onAddHospital, onEditHospital }: HospitalManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredHospitals = hospitals.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.primaryPhysician?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddHospital = () => {
    // Todo: remove mock functionality
    const newHospital = {
      name: 'New Hospital',
      address: '123 New Street',
      city: 'New City',
      state: 'IL',
      zipCode: '12345',
      primaryPhysician: 'Dr. New Doctor',
      contactPhone: '(555) 000-0000',
      notes: 'Newly added hospital'
    };
    console.log('Adding new hospital:', newHospital);
    onAddHospital?.(newHospital);
    setIsAddDialogOpen(false);
  };

  const handleEditHospital = (hospital: Hospital) => {
    console.log('Editing hospital:', hospital);
    setSelectedHospital(hospital);
    onEditHospital?.(hospital.id, hospital);
  };

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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Hospital</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Hospital form would be here with all fields for adding a new facility.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddHospital} data-testid="button-save-hospital">
                      Add Hospital
                    </Button>
                  </div>
                </div>
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
                          <div>{hospital.city}, {hospital.state} {hospital.zipCode}</div>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditHospital(hospital)}
                        data-testid={`button-edit-hospital-${hospital.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
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
                <div className="text-2xl font-bold">{hospitals.length}</div>
                <p className="text-xs text-muted-foreground">Total Hospitals</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {hospitals.reduce((sum, h) => sum + h.recentProcedures, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total Procedures (30 days)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {hospitals.filter(h => h.recentProcedures > 0).length}
                </div>
                <p className="text-xs text-muted-foreground">Active Facilities</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}