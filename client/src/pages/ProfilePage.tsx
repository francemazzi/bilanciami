import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { updateProfile } from '@/api/auth';
import { User, Mail, Lock, Save, Eye, EyeOff } from 'lucide-react';

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Il nome è obbligatorio');
      return;
    }

    if (!email.trim()) {
      toast.error("L'email è obbligatoria");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await updateProfile({ name, email });
      setUser(response.user);
      toast.success('Profilo aggiornato con successo');
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore nell'aggiornamento";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Inserisci la password attuale');
      return;
    }

    if (!newPassword) {
      toast.error('Inserisci la nuova password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('La nuova password deve avere almeno 8 caratteri');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Le password non coincidono');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password cambiata con successo');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel cambio password';
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="container max-w-2xl py-4 md:py-8 px-4">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Profilo</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Gestisci le tue informazioni personali e la password.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5" />
              <CardTitle>Informazioni personali</CardTitle>
            </div>
            <CardDescription>
              Modifica il tuo nome e la tua email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button type="submit" disabled={isSavingProfile}>
                <Save className="h-4 w-4 mr-2" />
                {isSavingProfile ? 'Salvataggio...' : 'Salva modifiche'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5" />
              <CardTitle>Cambia password</CardTitle>
            </div>
            <CardDescription>
              Aggiorna la tua password per mantenere il tuo account sicuro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                  Password attuale
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  Nuova password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 8 caratteri"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Conferma nuova password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button type="submit" disabled={isSavingPassword}>
                <Lock className="h-4 w-4 mr-2" />
                {isSavingPassword ? 'Cambio in corso...' : 'Cambia password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Informazioni account</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>ID: {user?.id}</li>
              <li>Registrato il: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : '-'}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
