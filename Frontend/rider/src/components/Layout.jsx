import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogOut, Bike, Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { initPushNotifications } from "../utils/pushNotifications";
import { requestRiderLocationPermission } from "../utils/locationPermissions";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("rider_sound") !== "off";
  });

  useEffect(() => {
    if (user) {
      initPushNotifications(navigate);
    }
    requestRiderLocationPermission();
  }, [navigate, user]);

  useEffect(() => {
    window.__riderSoundEnabled = soundEnabled;
    localStorage.setItem("rider_sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-rose-100 text-rose-600 p-2 rounded-full">
            <Bike size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg">Gaunle Rider</h1>
            <p className="text-xs text-slate-500">{user?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
            className={`p-2 rounded-full transition-colors ${
              soundEnabled
                ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                : "text-red-400 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            {soundEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      
      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 pb-safe z-10">
        <button className="flex flex-col items-center text-rose-600">
          <Bike size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Deliveries</span>
        </button>
      </nav>
    </div>
  );
}
