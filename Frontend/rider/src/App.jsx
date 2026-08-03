import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { getRoleRedirectUrl, isCapacitorNative } from "@shared/auth/roleRedirect";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import TasksBoard from "./pages/TasksBoard";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "delivery" && user.role !== "rider") {
    if (isCapacitorNative()) {
      toast.error("This app is for delivery rider accounts only");
      return <Navigate to="/login" replace />;
    }
    const targetUrl = getRoleRedirectUrl(user.role);
    window.location.href = targetUrl;
    return null;
  }

  return children;
}

export default function App() {
  const isNativeBuild =
    import.meta.env.MODE === "native" ||
    import.meta.env.VITE_BUILD_TARGET === "native" ||
    isCapacitorNative();
  const hasRiderPrefix =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/rider");
  const basename = !isNativeBuild && hasRiderPrefix ? "/rider" : undefined;

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TasksBoard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

