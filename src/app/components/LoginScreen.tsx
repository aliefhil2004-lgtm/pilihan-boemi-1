import { useState } from 'react';
import { Check, EyeOff, ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Language } from '../i18n';

interface LoginScreenProps {
  onLogin: (role: 'civilian' | 'service', credentials: { email: string; password: string }) => void | Promise<void>;
  onGoToRegister: () => void;
  forcedRole?: 'civilian' | 'service';
  language: Language;
}

export function LoginScreen({ onLogin, onGoToRegister, forcedRole, language }: LoginScreenProps) {
  const loginRole = forcedRole ?? 'civilian';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const isServicePortal = loginRole === 'service';

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error(tr('auth.needEmailPassword'));
      return;
    }

    // Simple validation - in real app, this would call an API
    if (email && password.length >= 6) {
      await onLogin(loginRole, { email, password });
    } else {
      toast.error(tr('auth.invalidCredentials'));
    }
  };

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-white text-[#0b3850]">
      <div className="flex justify-end px-7 pt-[58px]">
        <div className="auth-float flex h-20 w-20 items-center justify-center rounded-2xl text-[#0b3850]">
          <ShieldPlus className="h-16 w-16 text-[#0b3850]" />
        </div>
      </div>

      <div className="auth-enter flex flex-1 flex-col px-[30px] pb-8 pt-12">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-normal">
          {isServicePortal ? 'Emergency Access' : 'Hi, Welcome!'}
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-[#9aa3b1]">
          {isServicePortal ? 'Demo responder accounts are managed by admin.' : 'Sign in to report and monitor emergencies.'}
        </p>

          <div className="mt-12 space-y-6">
            <div>
              <label className="mb-2 block text-[14px] font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white px-5 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-medium">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white px-5 pr-12 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                />
                <EyeOff className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#737373]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[14px]">
              <label className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b3850] text-white">
                  <Check className="h-5 w-5" />
                </span>
                Remember me
              </label>
              <button className="font-medium text-[#0b3850]">Forgot password?</button>
            </div>

            <button
              onClick={handleLogin}
              className="mt-12 h-[59px] w-full rounded-xl bg-[#6da5c4] text-[16px] font-bold text-white transition hover:bg-[#5d99b8]"
            >
              Log in
            </button>
            {isServicePortal && (
              <div className="rounded-2xl bg-[#f4f8fb] p-4 text-[13px] leading-5 text-[#6f8494]">
                Service role is assigned by admin in Firebase. This account will automatically open the Medic, Fire, or Police dashboard.
              </div>
            )}
          </div>
          {!isServicePortal && (
            <button
              onClick={onGoToRegister}
              className="mt-auto w-full pb-6 text-[14px] text-[#6f8494]"
            >
              Don’t have an account? <span className="font-bold text-[#0b3850]">Sign up</span>
            </button>
          )}
      </div>
    </div>
  );
}
