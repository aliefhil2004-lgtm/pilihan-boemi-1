import { useState } from 'react';
import { Mail, Lock, ShieldPlus, IdCard } from 'lucide-react';
import { toast } from 'sonner';
import type { AseanCountry } from '../config/asean';
import { t, type Language } from '../i18n';

interface RegisterScreenProps {
  onRegister: (role: 'civilian' | 'service', data: RegisterData) => void | Promise<void>;
  onBackToLogin: () => void;
  forcedRole?: 'civilian' | 'service';
  country?: AseanCountry;
  language: Language;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  identityType: 'national-id' | 'passport' | 'drivers-license';
  identityNumber: string;
  serviceType?: 'ambulance' | 'fire' | 'police';
  credentialPhoto?: string;
}

export function RegisterScreen({ onRegister, onBackToLogin, forcedRole, country, language }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [identityType, setIdentityType] = useState<'national-id' | 'passport' | 'drivers-license'>('national-id');
  const [identityNumber, setIdentityNumber] = useState('');
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);

  const handleRegister = async () => {
    if (!email || !password || !name || !phone || !identityNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const registerData: RegisterData = {
      email,
      password,
      name,
      phone,
      identityType,
      identityNumber
    };

    await onRegister('civilian', registerData);
  };

  if (forcedRole === 'service') {
    return (
      <div className="flex h-full flex-col bg-white px-[30px] pb-8 pt-[92px] text-[#0b3850]">
        <div className="auth-enter">
          <div className="mb-10 flex justify-end">
            <div className="auth-float flex h-16 w-16 items-center justify-center rounded-lg">
              <ShieldPlus className="h-12 w-12 text-[#0b3850]" />
            </div>
          </div>
          <h1 className="text-[30px] font-extrabold leading-tight">Service account</h1>
          <p className="mt-3 text-[16px] leading-7 text-[#9aa3b1]">
            Emergency service accounts are created by admin. Use one of the demo responder accounts on the login screen.
          </p>
          <div className="mt-8 rounded-2xl bg-[#f4f8fb] p-5 text-[13px] leading-5 text-[#6f8494]">
            Medic, Fire Fighter, and Police access are assigned separately so each dashboard only shows reports for its own role.
          </div>
        </div>
        <button
          onClick={onBackToLogin}
          className="mt-auto h-[59px] w-full rounded-xl bg-[#0b3850] text-[16px] font-bold text-white transition hover:bg-[#123f59]"
        >
          Back to service login
        </button>
      </div>
    );
  }

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-white text-[#0b3850]">
      <div className="auth-enter flex items-start justify-between px-[30px] pb-5 pt-[92px]">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight">Create account</h1>
          <p className="mt-2 text-[15px] leading-6 text-[#9aa3b1]">Citizen access for emergency reporting.</p>
        </div>
        <div className="auth-float flex h-16 w-16 items-center justify-center rounded-lg">
          <ShieldPlus className="h-12 w-12 text-[#0b3850]" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm flex-1 px-[30px] pb-8 pt-2">
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="mb-2 block text-[14px] font-medium">{tr('register.fullName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white px-5 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-[14px] font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b1]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white py-3 pl-11 pr-4 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-2 block text-[14px] font-medium">{tr('register.phone')}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={country?.phonePlaceholder ?? '+Country code phone number'}
                className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white px-5 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-medium">ID Number</label>
              <div className="grid grid-cols-[0.9fr_1.4fr] gap-2">
                <select
                  value={identityType}
                  onChange={(e) => setIdentityType(e.target.value as typeof identityType)}
                  className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white px-3 text-[14px] text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                >
                  <option value="national-id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="drivers-license">Driver's License</option>
                </select>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b1]" />
                  <input
                    value={identityNumber}
                    onChange={(e) => setIdentityNumber(e.target.value)}
                    placeholder="Document number"
                    className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white py-3 pl-10 pr-3 text-[14px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                  />
                </div>
              </div>
              <p className="hidden mt-1 text-xs text-gray-500">{tr('register.identityNote')}</p>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-[14px] font-medium">{tr('common.password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b1]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white py-3 pl-11 pr-4 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-2 block text-[14px] font-medium">{tr('register.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b1]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-[58px] w-full rounded-xl border border-[#d7dbe0] bg-white py-3 pl-11 pr-4 text-[16px] text-[#0b3850] placeholder:text-[#8a8a8a] focus:border-[#6da5c4] focus:outline-none"
                />
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              className="mt-8 h-[59px] w-full rounded-xl bg-[#6da5c4] text-[16px] font-bold text-white transition-all hover:bg-[#5d99b8]"
            >
              {tr('register.createAccount')}
            </button>

            <button
              onClick={onBackToLogin}
              className="mt-5 w-full text-[14px] text-[#6f8494] transition hover:text-[#0b3850]"
            >
              Already have an account? <span className="font-bold text-[#0b3850]">{tr('common.login')}</span>
            </button>
          </div>
        </div>
    </div>
  );
}
