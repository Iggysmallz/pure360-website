
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  GoogleGenAI, 
  Type, 
  Modality, 
  LiveServerMessage,
  GenerateContentResponse 
} from "@google/genai";

// --- Types ---
type AppMode = 'home' | 'services' | 'booking' | 'concierge' | 'quote' | 'wiki' | 'map' | 'junk';
type AuthMethod = 'choice' | 'email' | 'phone' | 'otp';

interface User {
  id: string;
  name: string;
  method: string;
}

interface Service {
  id: string;
  name: string;
  desc: string;
  active: boolean;
  icon: string;
}

interface SubService {
  id: string;
  name: string;
}

// --- Constants & Assets ---
const BRAND_BLUE = '#29a8c2';
const SLOGAN = "Providing trusted and affordable cleaning services tailored to your needs.";

const SERVICES: Service[] = [
  { id: 'cleaning', name: 'Cleaning Services', desc: 'Professional interior care: Home, Office, Airbnb, and Move-in/out services.', active: true, icon: '✨' },
  { id: 'garden', name: 'Gardening', desc: 'Lawn mowing, pruning, and professional outdoor maintenance.', active: true, icon: '🌳' },
  { id: 'junk', name: 'Junk Removal', desc: 'Clear your space the Pure360 way. Responsible disposal of furniture and waste.', active: true, icon: '🚛' },
  { id: 'deep', name: 'Deep Cleaning', desc: 'Intensive top-to-bottom scrub for every corner.', active: false, icon: '🧼' },
  { id: 'pool', name: 'Pool Cleaning', desc: 'Crystal clear water maintenance and chemical balancing.', active: false, icon: '🏊' },
  { id: 'bin', name: 'Bin Cleaning', desc: 'Odour-free and hygienic waste bin sanitation.', active: false, icon: '🗑️' },
  { id: 'car', name: 'Car Wash', desc: 'Professional valet service right in your driveway.', active: false, icon: '🚗' },
];

const SUB_CLEANING_SERVICES: SubService[] = [
  { id: 'home', name: 'Home cleaning services' },
  { id: 'moving', name: 'Pre/Post moving cleaning services' },
  { id: 'office', name: 'Office cleaning services' },
  { id: 'airbnb', name: 'Airbnb/Short term guest rental' },
];

const RECURRENCE_OPTIONS = [
  { id: 'once', label: 'Once-off' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
];

// --- Utils ---
const encode = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

// --- Components ---

const AuthGate = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [method, setMethod] = useState<AuthMethod>('choice');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSocialLogin = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      onLogin({ id: 'social-123', name: `${provider} User`, method: provider });
      setLoading(false);
    }, 1200);
  };

  const handleEmailNext = () => {
    if (!email.includes('@')) {
      alert("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      onLogin({ id: 'email-123', name: email.split('@')[0], method: 'Email' });
      setLoading(false);
    }, 1000);
  };

  const handlePhoneNext = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      alert("Please enter a valid South African phone number (10 digits).");
      return;
    }
    setMethod('otp');
  };

  const handleOtpVerify = () => {
    if (otp.length !== 6) {
      alert("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      onLogin({ id: 'phone-123', name: phone, method: 'Phone' });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f172a] flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#29a8c2] opacity-10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#29a8c2] opacity-5 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md glass p-10 rounded-[2.5rem] border-slate-800 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-slate-900 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-slate-800 shadow-inner">
             <img src="logo.png" className="w-12 h-12 object-contain" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-3xl">✨</span>';
             }} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">Pure360 <span className="text-[#29a8c2]">ID</span></h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">Identity Verification</p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#29a8c2] border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-slate-400 font-bold animate-pulse">Verifying human status...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {method === 'choice' && (
              <>
                <button onClick={() => setMethod('phone')} className="w-full py-4 rounded-2xl bg-white text-slate-900 font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-95">
                  <span className="text-xl">🇿🇦</span>
                  Continue with SA Phone
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleSocialLogin('Google')} className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 border border-slate-700">
                    <span className="text-lg">G</span> Google
                  </button>
                  <button onClick={() => handleSocialLogin('Facebook')} className="py-3 rounded-2xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                    <span className="text-lg">f</span> Facebook
                  </button>
                </div>
                <div className="relative py-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                  <span className="relative bg-[#0f172a] px-4 text-[10px] font-black uppercase text-slate-600 tracking-widest">or</span>
                </div>
                <button onClick={() => setMethod('email')} className="w-full py-4 rounded-2xl glass text-white font-bold hover:bg-slate-800 transition-all active:scale-95 border-slate-700">
                  Use Email Address
                </button>
              </>
            )}

            {method === 'email' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 mb-1 block">Email Address</label>
                <input 
                  type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-[#29a8c2] transition-all mb-4"
                />
                <button onClick={handleEmailNext} className="w-full py-4 rounded-2xl bg-[#29a8c2] text-white font-bold hover:brightness-110 transition-all shadow-lg shadow-[#29a8c233]">
                  Continue
                </button>
                <button onClick={() => setMethod('choice')} className="w-full mt-4 text-slate-500 text-xs font-bold hover:text-slate-300">Back to Options</button>
              </div>
            )}

            {method === 'phone' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 mb-1 block">South African Mobile</label>
                <div className="flex gap-2 mb-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-slate-400 font-bold">+27</div>
                  <input 
                    type="tel" autoFocus value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="076 000 0000"
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-[#29a8c2] transition-all"
                  />
                </div>
                <button onClick={handlePhoneNext} className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                  Send OTP Code
                </button>
                <button onClick={() => setMethod('choice')} className="w-full mt-4 text-slate-500 text-xs font-bold hover:text-slate-300">Back to Options</button>
              </div>
            )}

            {method === 'otp' && (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <div className="text-center mb-6">
                  <p className="text-slate-400 text-sm mb-1">Code sent to <b>{phone}</b></p>
                  <button onClick={() => setMethod('phone')} className="text-[#29a8c2] text-[10px] font-bold uppercase underline">Change Number</button>
                </div>
                <input 
                  type="text" maxLength={6} autoFocus value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="0 0 0 0 0 0"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 text-white text-center text-3xl font-mono tracking-[0.5em] outline-none focus:border-[#29a8c2] transition-all mb-6"
                />
                <button onClick={handleOtpVerify} className="w-full py-4 rounded-2xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all shadow-xl">
                  Verify & Enter
                </button>
                <p className="text-center mt-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest">Didn't get code? <button className="text-[#29a8c2]">Resend</button></p>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
            By continuing, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

const Calendar = ({ selectedDate, onSelect }: { selectedDate: string, onSelect: (date: string) => void }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const days = daysInMonth(currentMonth, currentYear);
  const firstDay = firstDayOfMonth(currentMonth, currentYear);

  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const renderDays = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="h-10"></div>);
    
    const now = new Date();
    const isAfterSixAM = now.getHours() >= 6;

    for (let d = 1; d <= days; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(currentYear, currentMonth, d);
      const isSunday = dateObj.getDay() === 0;
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      const isSelected = selectedDate === dateStr;

      let status: 'available' | 'booked' | 'past' = 'available';
      if (isPast) status = 'past';
      else if (isToday && isAfterSixAM) status = 'past';
      else if (isSunday) status = 'booked';

      cells.push(
        <button
          key={d} disabled={status !== 'available'} onClick={() => onSelect(dateStr)}
          className={`h-10 w-full flex flex-col items-center justify-center rounded-lg text-xs font-bold transition-all relative group
            ${isSelected ? 'bg-[#29a8c2] text-white shadow-lg scale-105 z-10' : ''}
            ${status === 'available' && !isSelected ? 'hover:bg-emerald-500/10 text-slate-300 border border-emerald-500/20' : ''}
            ${status === 'booked' ? 'bg-red-500/5 text-red-500/40 border border-red-500/10 cursor-not-allowed' : ''}
            ${status === 'past' ? 'text-slate-700 cursor-not-allowed opacity-50' : ''}
          `}
        >
          <span>{d}</span>
          {status === 'booked' && <span className="text-[6px] uppercase absolute bottom-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Full</span>}
          {isToday && isAfterSixAM && status === 'past' && <span className="text-[5px] uppercase absolute bottom-0.5 text-slate-600">Closed</span>}
          {status === 'available' && !isSelected && <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-emerald-500"></div>}
        </button>
      );
    }
    return cells;
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-inner mt-2">
      <div className="flex justify-between items-center mb-4 px-2">
        <h4 className="text-sm font-bold text-white">{monthNames[currentMonth]} {currentYear}</h4>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400">←</button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400">→</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <span key={i} className={`text-[10px] font-black uppercase ${i === 0 ? 'text-red-500/50' : 'text-slate-500'}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
      <div className="mt-4 border-t border-slate-800 pt-3 space-y-2">
        <div className="flex gap-4 text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/50"></span> Fully Booked</div>
        </div>
        <p className="text-[8px] text-slate-600 px-1 italic">*Same-day bookings unavailable after 06:00 AM</p>
      </div>
    </div>
  );
};

const Sidebar = ({ current, setMode, user, onLogout }: { current: AppMode, setMode: (m: AppMode) => void, user: User, onLogout: () => void }) => {
  const navItems = [
    { id: 'home', icon: '🏠', label: 'Homepage' },
    { id: 'services', icon: '✨', label: 'All Services' },
    { id: 'booking', icon: '📅', label: 'Book Service' },
    { id: 'concierge', icon: '🎙️', label: 'Voice Concierge' },
    { id: 'wiki', icon: '📖', label: 'PureExpert Wiki' },
  ];

  return (
    <aside className="w-64 h-screen glass border-r border-slate-800 flex flex-col p-6 fixed left-0 top-0 z-50">
      <div className="mb-10 text-center flex flex-col items-center">
        <div className="w-20 h-20 mb-2 relative flex items-center justify-center">
           <img src="logo.png" alt="Pure360" className="max-h-full max-w-full object-contain" onError={(e) => {
             e.currentTarget.style.display = 'none';
             const parent = e.currentTarget.parentElement;
             if(parent) parent.innerHTML = `<span style="color: ${BRAND_BLUE}; font-weight: 900; font-size: 1.5rem;">Pure360</span>`;
           }} />
        </div>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black leading-tight">Total Care, Inside and Out</p>
      </div>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id} onClick={() => setMode(item.id as AppMode)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              current === item.id 
                ? 'bg-[#29a8c21a] text-[#29a8c2] border border-[#29a8c233] shadow-lg shadow-[#29a8c20d]' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-semibold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="glass p-4 rounded-2xl border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#29a8c21a] border border-[#29a8c233] flex items-center justify-center text-[#29a8c2] font-black uppercase text-xs">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{user.name}</p>
            <p className="text-[8px] text-[#29a8c2] uppercase font-bold tracking-tighter">Verified via {user.method}</p>
          </div>
          <button onClick={onLogout} title="Logout" className="text-slate-600 hover:text-red-400 transition-colors">🚪</button>
        </div>

        <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
          <a href="https://wa.me/27764002332" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
            <span>WhatsApp Us</span> <span className="text-sm">💬</span>
          </a>
          <p className="font-bold text-slate-400 mb-1 text-center">Support: 076 400 2332</p>
        </div>
      </div>
    </aside>
  );
};

const Home = ({ setMode }: { setMode: (m: AppMode) => void }) => (
  <div className="space-y-12">
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-12">
      <div className="relative z-10 max-w-2xl">
        <h2 className="text-5xl font-extrabold text-white mb-6 leading-tight">Welcome to <br/><span style={{ color: BRAND_BLUE }}>Pure360</span></h2>
        <p className="text-slate-300 text-xl font-medium mb-8 leading-relaxed">{SLOGAN}</p>
        <div className="flex gap-4">
          <button onClick={() => setMode('booking')} className="bg-[#29a8c2] hover:bg-[#218da3] text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl shadow-[#29a8c233]">Book a Service</button>
          <button onClick={() => setMode('junk')} className="glass text-white px-8 py-4 rounded-full font-bold hover:bg-slate-800 transition-all border-slate-700">Junk Removal</button>
        </div>
      </div>
      <div className="absolute right-[-10%] top-[-20%] w-[500px] h-[500px] rounded-full blur-[120px] bg-[#29a8c2] opacity-10"></div>
    </section>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass p-6 rounded-2xl border-slate-800 hover:border-[#29a8c244] transition-colors group">
        <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">🛡️</span>
        <h3 className="text-white font-bold mb-2">Trusted Quality</h3>
        <p className="text-slate-400 text-sm">Professional cleaners dedicated to making your space spotless and fresh.</p>
      </div>
      <div className="glass p-6 rounded-2xl border-slate-800 hover:border-[#29a8c244] transition-colors group">
        <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">💰</span>
        <h3 className="text-white font-bold mb-2">Affordable Rates</h3>
        <p className="text-slate-400 text-sm">Top-tier cleaning doesn't have to break the bank. Transparent flat rates.</p>
      </div>
      <div className="glass p-6 rounded-2xl border-slate-800 hover:border-[#29a8c244] transition-colors group">
        <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">🛠️</span>
        <h3 className="text-white font-bold mb-2">Tailored to You</h3>
        <p className="text-slate-400 text-sm">From routine upkeep to deep sanitization, we adapt to your specific needs.</p>
      </div>
    </div>
  </div>
);

const ServiceGrid = ({ onSelect }: { onSelect: (id: string) => void }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {SERVICES.map(s => (
      <div key={s.id} className="glass p-8 rounded-2xl border border-slate-800 hover:border-[#29a8c2] transition-all group cursor-default relative overflow-hidden">
        {!s.active && (
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
             <span className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-slate-700">Coming Soon</span>
           </div>
        )}
        <div className="flex justify-between items-start mb-6">
          <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{s.icon}</span>
          {s.active && <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter bg-emerald-500/20 text-emerald-400">Active</span>}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{s.name}</h3>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed h-12 overflow-hidden">{s.desc}</p>
        <button 
          disabled={!s.active} onClick={() => onSelect(s.id)}
          className={`text-xs font-bold text-white px-4 py-2 rounded-lg transition-colors ${s.active ? 'bg-slate-800 hover:bg-[#29a8c2]' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
        >
          {s.id === 'junk' ? 'Get Quote' : (s.active ? 'Select' : 'Locked')}
        </button>
      </div>
    ))}
  </div>
);

const BookingForm = ({ initialService = 'cleaning', setMode }: { initialService?: string, setMode: (m: AppMode) => void }) => {
  const activeServices = SERVICES.filter(s => s.active);
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', date: '', service: initialService, subService: 'home', address: '', recurrence: 'once' 
  });
  const [errors, setErrors] = useState({ email: '', phone: '', name: '', address: '' });
  const [touched, setTouched] = useState({ email: false, phone: false, name: false, address: false });
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [refNumber, setRefNumber] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const newErrors = { email: '', phone: '', name: '', address: '' };
    if (formData.name && formData.name.length < 2) newErrors.name = 'Name is too short.';
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Invalid email address.';
    if (formData.phone && formData.phone.length < 10) newErrors.phone = 'Phone number too short.';
    if (formData.address && formData.address.length < 10) newErrors.address = 'Provide a full address.';
    setErrors(newErrors);
  }, [formData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOpenSummary = () => {
    if (Object.values(errors).some(e => e !== '') || !formData.date) {
        alert("Please complete the form correctly.");
        return;
    }
    setRefNumber(`P360-${Math.floor(Math.random() * 900000) + 100000}`);
    setShowSummary(true);
  };

  const isRecurring = formData.recurrence !== 'once';
  const recurrenceText = RECURRENCE_OPTIONS.find(o => o.id === formData.recurrence)?.label;
  const displayServiceName = formData.service === 'cleaning' 
    ? SUB_CLEANING_SERVICES.find(s => s.id === formData.subService)?.name 
    : SERVICES.find(s => s.id === formData.service)?.name;

  if (isConfirmed) {
      return (
          <div className="max-w-2xl mx-auto glass p-10 rounded-3xl border-slate-800 text-center animate-in zoom-in duration-500 shadow-2xl">
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✓</span></div>
              <h3 className="text-3xl font-bold text-white mb-2">Request Received!</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">Thank you, {formData.name}. We will contact you shortly regarding {displayServiceName}.</p>
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 text-left mb-8 space-y-4">
                  <div className="flex justify-between border-b border-slate-800 pb-3 items-center">
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Reference No.</span>
                      <span className="text-[#29a8c2] font-mono font-bold text-lg">{refNumber}</span>
                  </div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Service</span><span className="text-slate-200 text-sm font-semibold">{displayServiceName}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Frequency</span><span className="text-slate-200 text-sm font-semibold">{recurrenceText}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Requested Start Date</span><span className="text-slate-200 text-sm font-semibold">{formData.date}</span></div>
              </div>
              <button onClick={() => setMode('home')} className="w-full py-4 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700">Back to Home</button>
          </div>
      );
  }
  
  return (
    <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {showSummary && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="glass p-8 rounded-3xl border-slate-700 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4">Booking Summary</h3>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3"><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ref Number</p><p className="text-[#29a8c2] font-mono font-bold">{refNumber}</p></div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Service & Frequency</p>
                <p className="text-white font-semibold">{displayServiceName} <span className="ml-2 text-[11px] text-[#29a8c2] px-2 py-0.5 rounded-full border border-[#29a8c244]">{recurrenceText}</span></p>
              </div>
              {isRecurring && <p className="text-[9px] text-emerald-400/70 mt-1 italic leading-tight">Recurring every {recurrenceText?.toLowerCase()} on the selected day.</p>}
              <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Name</p><p className="text-white font-semibold">{formData.name}</p></div>
              <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Date</p><p className="text-white font-semibold">{formData.date}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSummary(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 border border-slate-800 hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={() => setIsConfirmed(true)} className="flex-1 py-3 rounded-xl font-bold text-white bg-[#29a8c2] hover:brightness-110 shadow-lg shadow-[#29a8c222] transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 glass p-8 rounded-3xl border-slate-800 shadow-2xl">
        <h3 className="text-2xl font-bold text-white mb-8 text-center">Pure360 Booking Portal</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Main Category</label>
              <select name="service" value={formData.service} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 text-white focus:border-[#29a8c2] outline-none cursor-pointer">
                {activeServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {formData.service === 'cleaning' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Cleaning Type</label>
                <select name="subService" value={formData.subService} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 text-white focus:border-[#29a8c2] outline-none cursor-pointer">
                  {SUB_CLEANING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Frequency</label>
              <select name="recurrence" value={formData.recurrence} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 text-white focus:border-[#29a8c2] outline-none cursor-pointer">
                {RECURRENCE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
              <input name="name" value={formData.name} onChange={handleInputChange} placeholder="John Doe" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 text-white outline-none focus:border-[#29a8c2] transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
              <input name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-[#29a8c2] transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone</label>
              <input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="076 000 0000" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-[#29a8c2] transition-all" />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Address</label>
            <textarea name="address" rows={2} value={formData.address} onChange={handleInputChange} placeholder="123 Ocean View Drive..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none resize-none focus:border-[#29a8c2] transition-all" />
          </div>
          
          <button onClick={handleOpenSummary} className="w-full py-4 mt-4 rounded-xl font-bold text-white bg-[#29a8c2] hover:brightness-110 active:scale-95 shadow-lg shadow-[#29a8c222] flex items-center justify-center gap-2">
            <span>{formData.service === 'junk' ? 'Request Free Quote' : 'Confirm Booking'}</span> <span className="text-lg">✨</span>
          </button>
        </div>
      </div>

      <div className="lg:w-80 space-y-4">
        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Select Service Date</label>
        <Calendar selectedDate={formData.date} onSelect={d => setFormData(p => ({ ...p, date: d }))} />
      </div>
    </div>
  );
};

const VoiceConcierge = () => {
  const [active, setActive] = useState(false);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);

  const startSession = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inputCtx = new AudioContext({ sampleRate: 16000 });
    const outputCtx = new AudioContext({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setActive(true);
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
            sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            const buffer = await decodeAudioData(decode(audio), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputCtx.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
          }
        },
        onclose: () => setActive(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are the Pure360 Voice Assistant. We offer Cleaning (Home, Office, Moving, Airbnb), Gardening, and Junk Removal. Deep Cleaning is coming soon."
      }
    });
    sessionRef.current = await sessionPromise;
  };

  return (
    <div className="max-w-3xl mx-auto glass p-12 rounded-3xl border-slate-800 text-center">
      <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-10 transition-all duration-500 shadow-2xl ${active ? 'bg-[#29a8c2] animate-pulse-slow' : 'bg-slate-800'}`}>
        <span className="text-5xl">{active ? '🎙️' : '💤'}</span>
      </div>
      <h3 className="text-3xl font-bold text-white mb-4">Voice Concierge</h3>
      <button onClick={active ? () => sessionRef.current?.close() : startSession} className={`px-12 py-4 rounded-full font-bold transition-all ${active ? 'bg-red-500 shadow-red-500/20' : 'bg-[#29a8c2] shadow-[#29a8c222]'} text-white`}>
        {active ? 'End Session' : 'Start Talking'}
      </button>
    </div>
  );
};

const ExpertSearch = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{text: string, urls: any[]} | null>(null);

  const search = async () => {
    if (!query) return;
    setLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: query, config: { tools: [{ googleSearch: {} }] } });
    const urls = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c => c.web).map(c => ({ uri: c.web!.uri, title: c.web!.title }));
    setAnswer({ text: response.text || '', urls: urls || [] });
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass p-8 rounded-3xl border-slate-800">
        <h3 className="text-2xl font-bold text-white mb-6">Expert Wiki</h3>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cleaning building rubble?" className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white outline-none" />
          <button onClick={search} className="bg-[#29a8c2] text-white px-8 rounded-xl font-bold">{loading ? '...' : 'Search'}</button>
        </div>
      </div>
      {answer && (
        <div className="glass p-8 rounded-3xl border-slate-800">
          <p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">{answer.text}</p>
          {answer.urls.length > 0 && (
            <div className="pt-6 border-t border-slate-800 flex flex-wrap gap-2">
              {answer.urls.map((u, i) => <a key={i} href={u.uri} target="_blank" className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">🔗 {u.title}</a>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main App Controller ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AppMode>('home');
  const [selectedInitialService, setSelectedInitialService] = useState('cleaning');

  useEffect(() => {
    const saved = localStorage.getItem('p360_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('p360_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('p360_user');
  };

  if (!user) return <AuthGate onLogin={handleLogin} />;

  const renderContent = () => {
    switch (mode) {
      case 'home': return <Home setMode={setMode} />;
      case 'services': return <ServiceGrid onSelect={(id) => { setSelectedInitialService(id); setMode('booking'); }} />;
      case 'junk': return <ServiceGrid onSelect={(id) => { setSelectedInitialService(id); setMode('booking'); }} />; // Handled via services logic
      case 'booking': return <BookingForm initialService={selectedInitialService} setMode={setMode} />;
      case 'concierge': return <VoiceConcierge />;
      case 'wiki': return <ExpertSearch />;
      default: return <Home setMode={setMode} />;
    }
  };

  const headers: Record<string, {t: string, s: string}> = {
    home: { t: "Pure360 Homepage", s: SLOGAN },
    services: { t: "Available Services", s: "Professional care for every need." },
    booking: { t: "Booking Portal", s: "Secure your slot in seconds." },
    concierge: { t: "Smart Concierge", s: "Talk to us for instant assistance." },
    wiki: { t: "Knowledge Base", s: "AI-grounded expert cleaning techniques." }
  };

  const activeHeader = headers[mode] || headers.home;

  return (
    <div className="flex bg-[#0f172a] min-h-screen text-slate-200">
      <Sidebar current={mode} setMode={setMode} user={user} onLogout={handleLogout} />
      <main className="flex-1 ml-64 p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          <header className="mb-12">
            <h2 className="text-4xl font-bold text-white mb-2">{activeHeader.t}</h2>
            <p className="text-slate-400 font-medium max-w-2xl">{activeHeader.s}</p>
          </header>
          {renderContent()}
        </div>
      </main>
      <footer className="fixed bottom-6 right-6 pointer-events-none opacity-40 text-[10px] uppercase tracking-widest font-bold text-slate-500">
        &copy; 2025 Pure360 Cleaning Services Cape Town
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
