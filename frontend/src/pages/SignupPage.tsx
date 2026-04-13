import { Navigate } from "react-router-dom";

export function SignupPage() {
  return <Navigate to="/auth?mode=signup" replace />;
}
