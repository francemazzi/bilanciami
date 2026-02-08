import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  getAdminUsers,
  updateUserLicense,
  getLicenseTiers,
  type AdminUser,
  type LicenseTierInfo,
} from '@/api/admin';
import type { LicenseTier } from '@/api/settings';
import { Users, Shield, Crown, Loader2 } from 'lucide-react';

const TIER_COLORS: Record<LicenseTier, string> = {
  free: 'bg-gray-100 text-gray-800',
  starter: 'bg-blue-100 text-blue-800',
  professional: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-amber-100 text-amber-800',
};

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tiers, setTiers] = useState<LicenseTierInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, tiersData] = await Promise.all([
        getAdminUsers(),
        getLicenseTiers(),
      ]);
      setUsers(usersData.users);
      setTiers(tiersData.tiers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel caricamento';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTierChange = async (userId: string, newTier: LicenseTier) => {
    setUpdatingUserId(userId);
    try {
      await updateUserLicense(userId, newTier);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                licenseTier: newTier,
                pdfLimit: tiers.find((t) => t.id === newTier)?.limit ?? 20,
              }
            : user
        )
      );
      toast.success('Licenza aggiornata con successo');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nell\'aggiornamento';
      toast.error(message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Illimitato' : limit.toString();
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-4 md:py-8 px-4">
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Admin Console</h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Gestisci utenti e licenze della piattaforma.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utenti Totali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
          </CardContent>
        </Card>

        {tiers.map((tier) => (
          <Card key={tier.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tier.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">
                  {users.filter((u) => u.licenseTier === tier.id).length}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gestione Utenti</CardTitle>
          <CardDescription>
            Visualizza e modifica le licenze degli utenti registrati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Licenza</TableHead>
                  <TableHead className="text-center">PDF Usati</TableHead>
                  <TableHead>Registrato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={TIER_COLORS[user.licenseTier]}
                      >
                        {user.licenseTier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono">
                        {user.pdfCount} / {formatLimit(user.pdfLimit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="relative inline-flex items-center">
                        {updatingUserId === user.id && (
                          <Loader2 className="h-4 w-4 animate-spin absolute left-2" />
                        )}
                        <select
                          value={user.licenseTier}
                          onChange={(e) =>
                            handleTierChange(user.id, e.target.value as LicenseTier)
                          }
                          disabled={updatingUserId === user.id}
                          className="w-[140px] h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {tiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.name} ({formatLimit(tier.limit)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nessun utente registrato.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Livelli di Licenza</CardTitle>
          <CardDescription>
            Limiti PDF per ogni livello di licenza.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="p-4 rounded-lg border bg-muted/50"
              >
                <Badge
                  variant="secondary"
                  className={TIER_COLORS[tier.id as LicenseTier]}
                >
                  {tier.name}
                </Badge>
                <p className="mt-2 text-2xl font-bold">
                  {formatLimit(tier.limit)}
                </p>
                <p className="text-sm text-muted-foreground">PDF</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
