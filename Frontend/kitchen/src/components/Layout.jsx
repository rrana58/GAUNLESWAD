import { Outlet, useNavigate } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LogOut, ChefHat, Wifi, WifiOff, Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { initPushNotifications } from "../utils/pushNotifications";

/**
 * Layout — Kitchen Display System: Phase 6.0
 *
 * Design System Tokens & WCAG 2.1 AA:
 *  - bg-slate-100/white -> bg-background / bg-card
 *  - text-slate-* -> text-foreground / text-muted-foreground
 *  - border-slate-200 -> border-border
 *  - Accent & badge -> semantic colors + gs-admin-focus-ring
 *  - <header> landmark, <main aria-label="Kitchen Display System">
 *  - Decorative icons aria-hidden="true"
 *  - Sound toggle & Sign Out buttons get descriptive aria-label, aria-pressed, & gs-admin-focus-ring
 */

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    initPushNotifications(navigate);
  }, [navigate]);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("kitchen_sound") !== "off";
  });

  useEffect(() => {
    window.__kitchenSoundEnabled = soundEnabled;
    localStorage.setItem("kitchen_sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="h-screen bg-muted/30 flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border px-6 py-3 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div
            className="p-2 text-white shadow-sm flex items-center justify-center"
            style={{
              backgroundColor: "var(--gs-kitchen-accent, #e11d48)",
              borderRadius: "var(--gs-admin-radius-xl, 0.75rem)",
            }}
          >
            <ChefHat size={22} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-black text-foreground text-lg leading-tight">Gaunle Swad</h1>
            <p className="text-xs text-muted-foreground">Kitchen Display System — Pokhara</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live / Offline status badge */}
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
              connected ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-100 text-red-600 border border-red-200"
            }`}
            style={{ borderRadius: "var(--gs-admin-radius-full, 9999px)" }}
          >
            {connected ? <Wifi size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
            <span>{connected ? "Live" : "Offline"}</span>
          </div>

          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute new order sound" : "Unmute new order sound"}
            aria-label={soundEnabled ? "Mute new order sound" : "Unmute new order sound"}
            aria-pressed={soundEnabled}
            className={`p-2 transition-colors gs-admin-focus-ring ${
              soundEnabled
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-red-500 hover:text-red-600 hover:bg-red-50"
            }`}
            style={{ borderRadius: "var(--gs-admin-radius-xl, 0.75rem)" }}
          >
            {soundEnabled ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
          </button>

          <div className="text-right">
            <p className="font-semibold text-foreground text-sm">{user?.name}</p>
            <p className="text-xs text-muted-foreground">Kitchen Staff</p>
          </div>

          <button
            onClick={logout}
            aria-label="Sign out of Kitchen Display System"
            title="Sign Out"
            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors gs-admin-focus-ring"
            style={{ borderRadius: "var(--gs-admin-radius-xl, 0.75rem)" }}
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col min-h-0" aria-label="Kitchen Display Board">
        <Outlet />
      </main>
    </div>
  );
}
