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
  const [location] = useLocation();
  const { checkAuth } = useAuth();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  return (
    <Switch>
      <Route path="/login" component={(props) => <AuthRoute component={Login} {...props} />} />
      
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedLayout>
        <Router />
      </AuthenticatedLayout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
