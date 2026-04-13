import { Navigate } from "react-router-dom";

export function LoginPage() {
  return <Navigate to="/auth?mode=signin" replace />;
}
