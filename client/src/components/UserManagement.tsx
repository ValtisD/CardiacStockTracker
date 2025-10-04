import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Shield } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserStats {
  userId: string;
  email: string;
  isAdmin: boolean;
  isPrimeAdmin: boolean;
  inventoryCount: number;
  recentProcedureCount: number;
}

export default function UserManagement() {
  const { toast } = useToast();
  
  const { data: users, isLoading } = useQuery<UserStats[]>({
    queryKey: ["/api/users"],
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, email, isAdmin }: { userId: string; email: string; isAdmin: boolean }) => {
      const response = await fetch(`/api/users/${userId}/toggle-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, isAdmin }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to toggle admin status");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "Admin status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
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

  const handleToggleAdmin = (user: UserStats) => {
    if (user.isPrimeAdmin) {
      toast({
        title: "Cannot modify",
        description: "Prime admin status cannot be changed",
        variant: "destructive",
      });
      return;
    }
    
    toggleAdminMutation.mutate({
      userId: user.userId,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  };

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
                <TableHead>Email</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="text-right">Inventory Items</TableHead>
                <TableHead className="text-right">Recent Procedures (90d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                return (
                  <TableRow 
                    key={user.userId}
                    data-testid={`row-user-${user.userId}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-email-${user.userId}`}>
                      <div className="flex items-center gap-2">
                        {user.email}
                        {user.isPrimeAdmin && (
                          <Badge variant="default" className="text-xs" data-testid={`badge-prime-admin-${user.userId}`}>
                            <Shield className="h-3 w-3 mr-1" />
                            Prime Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-admin-toggle-${user.userId}`}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isAdmin}
                          onCheckedChange={() => handleToggleAdmin(user)}
                          disabled={user.isPrimeAdmin || toggleAdminMutation.isPending}
                          data-testid={`switch-admin-${user.userId}`}
                        />
                        {user.isAdmin && !user.isPrimeAdmin && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-admin-${user.userId}`}>
                            Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-inventory-${user.userId}`}>
                      {user.inventoryCount}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-procedures-${user.userId}`}>
                      {user.recentProcedureCount}
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
