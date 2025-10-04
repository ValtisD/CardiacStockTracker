import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface UserStats {
  userId: string;
  inventoryCount: number;
  hospitalCount: number;
  procedureCount: number;
}

export default function UserManagement() {
  const { data: users, isLoading } = useQuery<UserStats[]>({
    queryKey: ["/api/users"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>No users found in the system.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <Badge variant="outline" data-testid="badge-user-count">
          {users.length} {users.length === 1 ? 'User' : 'Users'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead className="text-right">Inventory Items</TableHead>
                <TableHead className="text-right">Hospitals</TableHead>
                <TableHead className="text-right">Procedures</TableHead>
                <TableHead className="text-right">Total Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const totalActivity = user.inventoryCount + user.hospitalCount + user.procedureCount;
                return (
                  <TableRow 
                    key={user.userId}
                    data-testid={`row-user-${user.userId}`}
                  >
                    <TableCell className="font-medium font-mono text-sm" data-testid={`text-userid-${user.userId}`}>
                      {user.userId}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-inventory-${user.userId}`}>
                      {user.inventoryCount}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-hospitals-${user.userId}`}>
                      {user.hospitalCount}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-procedures-${user.userId}`}>
                      {user.procedureCount}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-total-${user.userId}`}>
                      <Badge variant={totalActivity > 0 ? "default" : "outline"}>
                        {totalActivity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
