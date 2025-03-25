import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ReviewerDashboard from "@/pages/reviewer";
import ReviewDetail from "@/pages/reviewer/review-detail";
import TaskEvaluation from "@/pages/reviewer/task-evaluation";
import CategoryEvaluation from "@/pages/reviewer/category-evaluation";
import ReportView from "@/pages/reports/report";
import AdminDashboard from "@/pages/admin";
import MediaTestPage from "@/pages/media-test";
import AuthenticatedLayout from "@/components/layout/authenticated-layout";

function PrivateRoute({ component: Component, roles, ...rest }: any) {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  // Check role access if specified
  if (roles && user && !roles.includes(user.role)) {
    return <Redirect to="/" />;
  }
  
  return <Component {...rest} />;
}

function AuthRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Component {...rest} />;
}

function Router() {
  const [location, setLocation] = useLocation();
  const { checkAuth, isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      
      // After checking auth, redirect to login if not authenticated
      if (!isAuthenticated && location !== '/login' && location !== '/media-test' && !location.startsWith('/media-test/')) {
        console.log('Not authenticated, redirecting to login');
        setLocation('/login');
      }
    };
    
    initAuth();
  }, [checkAuth, isAuthenticated, location, setLocation]);
  
  // Force redirect to login during initial load
  useEffect(() => {
    if (loading === false && !isAuthenticated && location !== '/login' && location !== '/media-test' && !location.startsWith('/media-test/')) {
      console.log('Not authenticated (after load), redirecting to login');
      setLocation('/login');
    }
  }, [loading, isAuthenticated, location, setLocation]);
  
  // If not authenticated and not on login page, show a temporary loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }
  
  // Render content with or without the authenticated layout
  // Login page should not have the authenticated layout
  // Everything else should be wrapped with the AuthenticatedLayout component
  
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={(props) => <AuthRoute component={Login} {...props} />} />
      
      {/* Media Test route - fully public for test purposes */}
      <Route path="/media-test" component={MediaTestPage} />
      
      {/* All authenticated routes wrapped in AuthenticatedLayout */}
      <Route>
        <AuthenticatedLayout>
          <Switch>
            {/* Reviewer routes */}
            <Route path="/" component={(props) => 
              <PrivateRoute component={ReviewerDashboard} roles={["reviewer", "admin"]} {...props} />
            } />
            <Route path="/reviews/:id" component={(props) => 
              <PrivateRoute component={ReviewDetail} roles={["reviewer", "admin"]} {...props} />
            } />
            <Route path="/reviews/:reviewId/tasks/:taskId" component={(props) => 
              <PrivateRoute component={TaskEvaluation} roles={["reviewer", "admin"]} {...props} />
            } />
            <Route path="/reviews/:reviewId/categories/:categoryId" component={(props) => 
              <PrivateRoute component={CategoryEvaluation} roles={["reviewer", "admin"]} {...props} />
            } />
            
            {/* Report routes - available to all authenticated users */}
            <Route path="/reports/:id" component={(props) => 
              <PrivateRoute component={ReportView} {...props} />
            } />
            
            {/* Admin routes */}
            <Route path="/admin" component={(props) => 
              <PrivateRoute component={AdminDashboard} roles={["admin"]} {...props} />
            } />
            
            {/* Fallback to 404 */}
            <Route component={NotFound} />
          </Switch>
        </AuthenticatedLayout>
      </Route>
    </Switch>
  );
}

function App() {
  // Add basic error handling
  try {
    // We need to always render the Router component to handle auth state and routing
    // The AuthenticatedLayout will only be shown for protected routes
    return (
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    );
  } catch (error) {
    console.error("Error rendering app:", error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
        <p className="text-red-500">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }
}

export default App;
