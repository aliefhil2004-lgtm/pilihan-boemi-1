import { useEffect, useState } from 'react';
import { User, Shield, Mail, Lock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { AseanCountry } from '../config/asean';
import { t, type Language } from '../i18n';

interface LoginScreenProps {
  onLogin: (role: 'civilian' | 'service', credentials: { email: string; password: string }) => void | Promise<void>;
  onGoToRegister: () => void;
  forcedRole?: 'civilian' | 'service';
  country?: AseanCountry;
  language: Language;
}

export function LoginScreen({ onLogin, onGoToRegister, forcedRole, country, language }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<'civilian' | 'service' | null>(forcedRole ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);

  useEffect(() => {
    if (forcedRole) setSelectedRole(forcedRole);
  }, [forcedRole]);

  const handleLogin = async () => {
    if (!selectedRole) {
      toast.error(tr('auth.needRole'));
      return;
    }
    if (!email || !password) {
      toast.error(tr('auth.needEmailPassword'));
      return;
    }

    // Simple validation - in real app, this would call an API
    if (email && password.length >= 6) {
      await onLogin(selectedRole, { email, password });
    } else {
      toast.error(tr('auth.invalidCredentials'));
    }
  };

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-950 to-gray-950 text-white">
      {/* Header */}
      <div className="px-6 pb-4 pt-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-red-400/30 bg-red-600 shadow-lg shadow-red-950/50">
          <MapPin className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold mb-2">EmergencyConnect</h1>
        <p className="text-gray-400">
          {forcedRole === 'service'
            ? tr('auth.serviceSubtitle')
            : tr('auth.appSubtitle')}
        </p>
      </div>

      {/* Role Selection */}
      {!selectedRole && !forcedRole ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
          <h2 className="text-xl font-bold mb-6 text-center">{tr('auth.selectRole')}</h2>

          <div className="space-y-4">
            {/* Civilian Option */}
            <button
              onClick={() => setSelectedRole('civilian')}
              className="group w-full rounded-lg border border-blue-500/40 bg-blue-500/10 p-5 transition-all hover:border-blue-400 hover:bg-blue-500/20"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/30 p-4 rounded-xl group-hover:bg-blue-500/50 transition">
                  <User className="w-8 h-8 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-bold text-blue-300">{tr('auth.civilian')}</h3>
                  <p className="text-sm text-gray-400">{tr('auth.civilianDetail')}</p>
                </div>
              </div>
            </button>

            {/* Emergency Service Option */}
            <button
              onClick={() => setSelectedRole('service')}
              className="group w-full rounded-lg border border-orange-500/40 bg-orange-500/10 p-5 transition-all hover:border-orange-400 hover:bg-orange-500/20"
            >
              <div className="flex items-center gap-4">
                <div className="bg-orange-500/30 p-4 rounded-xl group-hover:bg-orange-500/50 transition">
                  <Shield className="w-8 h-8 text-orange-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-bold text-orange-300">{tr('auth.service')}</h3>
                  <p className="text-sm text-gray-400">{tr('auth.serviceDetail')}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* Login Form */
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
          {!forcedRole && (
            <button
              onClick={() => {
                setSelectedRole(null);
                setEmail('');
                setPassword('');
              }}
              className="text-sm text-gray-400 hover:text-white mb-6 text-left"
            >
              ← {tr('common.changeRole')}
            </button>
          )}

          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">{tr('common.email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-12 pr-4 py-3 text-white placeholder-gray-500 transition focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">{tr('common.password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-12 pr-4 py-3 text-white placeholder-gray-500 transition focus:border-blue-500"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              className={`w-full rounded-lg py-3.5 font-bold transition-all shadow-lg ${
                selectedRole === 'civilian'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-blue-500/50'
                  : 'bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 shadow-orange-500/50'
              }`}
            >
              {tr('common.login')}
            </button>

            {/* Demo Credentials */}
            <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">{tr('auth.demoCredentials')}</p>
              <div className="text-xs text-gray-500 space-y-1">
                {selectedRole === 'civilian' ? (
                  <>
                    <p>Email: civilian@demo.com</p>
                    <p>Password: demo123</p>
                  </>
                ) : (
                  <>
                    <p>Email: service@demo.com</p>
                    <p>Password: demo123</p>
                  </>
                )}
              </div>
            </div>

            {/* Register Link */}
            <button
              onClick={onGoToRegister}
              className="w-full text-sm text-gray-400 hover:text-white transition mt-4"
            >
              {tr('auth.noAccount')} <span className="text-blue-400">{tr('common.register')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-xs text-gray-500">
          {tr('common.emergencyHotline')}: <span className="text-red-400 font-bold">{country?.emergency.ambulance ?? tr('common.localEmergencyNumber')}</span>
        </p>
      </div>
    </div>
  );
}
