import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Navbar } from "@/components/layout/navbar";
import { HomePage } from "@/pages/HomePage";
import { PanelPage } from "@/pages/PanelPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { AuthPage } from "./pages/AuthPage";

function AppFrame() {
  const location = useLocation();
  const hideNavbar = ["/", "/auth", "/login", "/signup"].includes(location.pathname);

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/panel" element={<PanelPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<Navigate to="/auth?mode=signin" replace />} />
        <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppFrame />
    </BrowserRouter>
  );
}
