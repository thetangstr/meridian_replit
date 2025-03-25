import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Car, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, error, isAuthenticated } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [loginAttempts, setLoginAttempts] = useState(0);

  // If already authenticated, redirect to homepage
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log("Form submitted with:", data);
    setIsLoggingIn(true);
    try {
      await login(data.username, data.password);
      // The redirection is handled by the useEffect above
    } catch (err) {
      console.error("Login error in form:", err);
      setLoginAttempts(prev => prev + 1);
      
      toast({
        title: "Login Failed",
        description: error || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Helper function to fill demo credentials
  const fillDemoCredentials = (role: string) => {
    switch(role) {
      case 'reviewer':
        form.setValue('username', 'reviewer');
        form.setValue('password', 'review123');
        break;
      case 'admin':
        form.setValue('username', 'admin');
        form.setValue('password', 'admin123');
        break;
      case 'internal':
        form.setValue('username', 'internal');
        form.setValue('password', 'internal123');
        break;
      case 'external':
        form.setValue('username', 'external');
        form.setValue('password', 'external123');
        break;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary bg-opacity-10 p-3 rounded-full">
              <Car className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Score My Car</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginAttempts > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                Please use one of the following test accounts:
                <div className="mt-2 text-xs bg-white/20 p-2 rounded">
                  <div><strong>Reviewer:</strong> username: reviewer, password: review123</div>
                  <div><strong>Admin:</strong> username: admin, password: admin123</div>
                  <div><strong>Internal:</strong> username: internal, password: internal123</div>
                  <div><strong>External:</strong> username: external, password: external123</div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Logging in..." : "Sign In"}
              </Button>
              
              <div className="mt-4">
                <p className="text-xs text-center mb-2 text-gray-500">Quick access demo accounts:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fillDemoCredentials('reviewer')}
                  >
                    Reviewer
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fillDemoCredentials('admin')}
                  >
                    Admin
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fillDemoCredentials('internal')}
                  >
                    Internal
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fillDemoCredentials('external')}
                  >
                    External
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col">
          <p className="text-sm text-center text-gray-500 mt-4">
            Car evaluation platform for internal reviewers, stakeholders and administrators.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
