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
  username: z.string().min(1, "LDAP identifier is required"),
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
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log("Form submitted with:", data);
    setIsLoggingIn(true);
    try {
      await login(data.username);
      // The redirection is handled by the useEffect above
    } catch (err) {
      console.error("Login error in form:", err);
      setLoginAttempts(prev => prev + 1);
      
      toast({
        title: "Login Failed",
        description: error || "Invalid LDAP identifier",
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
        break;
      case 'admin':
        form.setValue('username', 'admin');
        break;
      case 'internal':
        form.setValue('username', 'internal');
        break;
      case 'external':
        form.setValue('username', 'external');
        break;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-3 text-center pb-2">
          <div className="flex justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Car className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Score My Car</CardTitle>
          <CardDescription className="text-base">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {loginAttempts > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                Please use one of the following test accounts:
                <div className="mt-2 text-xs bg-white/20 p-3 rounded space-y-1">
                  <div><strong>Reviewer:</strong> username: reviewer</div>
                  <div><strong>Admin:</strong> username: admin</div>
                  <div><strong>Internal:</strong> username: internal</div>
                  <div><strong>External:</strong> username: external</div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your username" 
                        {...field} 
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium" 
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Logging in..." : "Sign In"}
              </Button>
              
              <div className="mt-6">
                <p className="text-sm text-center mb-3 text-muted-foreground">Quick access demo accounts:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="lg"
                    onClick={() => fillDemoCredentials('reviewer')}
                    className="h-11"
                  >
                    Reviewer
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="lg"
                    onClick={() => fillDemoCredentials('admin')}
                    className="h-11"
                  >
                    Admin
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="lg"
                    onClick={() => fillDemoCredentials('internal')}
                    className="h-11"
                  >
                    Internal
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="lg"
                    onClick={() => fillDemoCredentials('external')}
                    className="h-11"
                  >
                    External
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col pt-0">
          <p className="text-sm text-center text-muted-foreground">
            Car evaluation platform for internal reviewers, stakeholders and administrators.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
