import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import Header from "./header";
import MobileNav from "./mobile-nav";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const [location] = useLocation();

  // Check if currently on login page
  const isLoginPage = location === "/login";
  
  // Show global loading state 
  // Let the Router in App.tsx handle the actual redirects
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't apply layout on login page or not authenticated pages
  if (isLoginPage || !isAuthenticated) {
    return children;
  }

  // Authenticated layout for authenticated non-login pages
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

export default AuthenticatedLayout;
