import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session } = useSession();
  
  return {
    role: session?.user?.role,
    isAdmin: session?.user?.role === "ADMIN",
    isOperator: session?.user?.role === "OPERATOR" || session?.user?.role === "ADMIN",
    isViewer: session?.user?.role === "VIEWER",
  };
}