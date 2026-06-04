import { useEffect, useState } from 'react';
import { User, Shield, Mail, Lock, MapPin, Upload, Camera, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterScreenProps {
  onRegister: (role: 'civilian' | 'service', data: RegisterData) => void;
  onBackToLogin: () => void;
  forcedRole?: 'civilian' | 'service';
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  serviceType?: 'ambulance' | 'fire' | 'police';
  credentialPhoto?: string;
}

export function RegisterScreen({ onRegister, onBackToLogin, forcedRole }: RegisterScreenProps) {
  const [selectedRole, setSelectedRole] = useState<'civilian' | 'service' | null>(forcedRole ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState<'ambulance' | 'fire' | 'police'>('ambulance');
  const [credentialPhoto, setCredentialPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (forcedRole) setSelectedRole(forcedRole);
  }, [forcedRole]);

  const handleCredentialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCredentialPhoto(reader.result as string);
        toast.success('Credential photo uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = () => {
    if (!selectedRole) {
      toast.error('Please select your role');
      return;
    }

    if (!email || !password || !name || !phone) {
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

    if (selectedRole === 'service' && !credentialPhoto) {
      toast.error('Please upload your credential photo for verification');
      return;
    }

    const registerData: RegisterData = {
      email,
      password,
      name,
      phone,
      ...(selectedRole === 'service' && {
        serviceType,
        credentialPhoto: credentialPhoto || undefined
      })
    };

    onRegister(selectedRole, registerData);
    toast.success('Registration submitted for verification');
  };

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-950 to-gray-950 text-white">
      {/* Header */}
      <div className="p-6 text-center pt-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/50">
          <MapPin className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Create Account</h1>
        <p className="text-gray-400 text-sm">
          {forcedRole === 'service'
            ? 'Emergency service account verification'
            : 'Join EmergencyConnect Indonesia'}
        </p>
      </div>

      {/* Role Selection */}
      {!selectedRole && !forcedRole ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
          <h2 className="text-lg font-bold mb-4 text-center">Select Your Role</h2>

          <div className="space-y-3 mb-6">
            {/* Civilian Option */}
            <button
              onClick={() => setSelectedRole('civilian')}
              className="w-full bg-gradient-to-br from-blue-500/20 to-blue-700/20 border-2 border-blue-500/50 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/30 p-3 rounded-lg group-hover:bg-blue-500/50 transition">
                  <User className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-blue-300">Civilian Account</h3>
                  <p className="text-xs text-gray-400">Request emergency assistance</p>
                </div>
              </div>
            </button>

            {/* Emergency Service Option */}
            <button
              onClick={() => setSelectedRole('service')}
              className="w-full bg-gradient-to-br from-orange-500/20 to-orange-700/20 border-2 border-orange-500/50 rounded-xl p-5 hover:border-orange-400 hover:bg-orange-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/30 p-3 rounded-lg group-hover:bg-orange-500/50 transition">
                  <Shield className="w-6 h-6 text-orange-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-orange-300">Emergency Service</h3>
                  <p className="text-xs text-gray-400">Respond to emergencies (requires verification)</p>
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={onBackToLogin}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Already have an account? <span className="text-blue-400">Login</span>
          </button>
        </div>
      ) : (
        /* Registration Form */
        <div className="mx-auto w-full max-w-md flex-1 p-6 pb-8">
          {!forcedRole && (
            <button
              onClick={() => {
                setSelectedRole(null);
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setName('');
                setPhone('');
                setCredentialPhoto(null);
              }}
              className="text-sm text-gray-400 hover:text-white mb-4"
            >
              ← Change role
            </button>
          )}

          <div className={`p-4 rounded-xl border-2 mb-4 ${
            selectedRole === 'civilian'
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {selectedRole === 'civilian' ? (
                <User className="w-5 h-5 text-blue-400" />
              ) : (
                <Shield className="w-5 h-5 text-orange-400" />
              )}
              <p className="font-bold text-sm">
                {selectedRole === 'civilian' ? 'Civilian Registration' : 'Emergency Service Registration'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-300">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-300">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-300">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812-3456-7890"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Service Type (Emergency Service Only) */}
            {selectedRole === 'service' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Service Type *</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as 'ambulance' | 'fire' | 'police')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="ambulance">Medical / Ambulance</option>
                  <option value="fire">Fire Department</option>
                  <option value="police">Police</option>
                </select>
              </div>
            )}

            {/* Credential Photo (Emergency Service Only) */}
            {selectedRole === 'service' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Credential Verification *</label>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300">
                      Upload a clear photo of your official ID badge, certification, or credentials.
                      This will be verified by our team.
                    </p>
                  </div>
                </div>

                {credentialPhoto ? (
                  <div className="relative group">
                    <img
                      src={credentialPhoto}
                      alt="Credential"
                      className="w-full h-40 object-cover rounded-lg border border-gray-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                      <button
                        onClick={() => setCredentialPhoto(null)}
                        className="w-full bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition"
                      >
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-orange-500/50 hover:bg-gray-800/30 transition group">
                    <div className="bg-orange-500/10 p-3 rounded-full mb-2 group-hover:bg-orange-500/20 transition">
                      <Camera className="w-6 h-6 text-orange-400" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Upload Credential Photo</span>
                    <span className="text-xs text-gray-500 mt-1">Badge, ID, or Certificate</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCredentialUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-300">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-300">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              className={`w-full py-3 rounded-lg font-bold transition-all shadow-lg mt-4 ${
                selectedRole === 'civilian'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-blue-500/50'
                  : 'bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 shadow-orange-500/50'
              }`}
            >
              {selectedRole === 'service' ? 'Submit for Verification' : 'Create Account'}
            </button>

            <button
              onClick={onBackToLogin}
              className="w-full text-sm text-gray-400 hover:text-white transition mt-3"
            >
              Already have an account? <span className="text-blue-400">Login</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
