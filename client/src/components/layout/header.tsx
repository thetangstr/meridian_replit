import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/utils";
import { Car, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canAccessAdminSettings, canReviewCars } from "@/lib/auth";

function Header() {
  const { user, logout } = useAuth();
  const [_, setLocation] = useLocation();

  const handleLogout = async () => {
    // The logout function now handles redirection
    await logout();
    // No need to manually redirect, it's handled in the auth.ts logout function
  };

  if (!user) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        <div className="flex items-center">
          <div className="bg-primary/10 p-2 rounded-full mr-3">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <h1 
            className="text-xl font-semibold text-foreground tracking-tight" 
            onClick={() => setLocation('/')} 
            style={{ cursor: 'pointer' }}
          >
            Score My Car
          </h1>
        </div>
        
        <div className="hidden sm:flex items-center space-x-1">
          {canReviewCars(user) && (
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/')}
              className="px-4 h-10"
            >
              Reviews
            </Button>
          )}
          
          {canAccessAdminSettings(user) && (
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/admin')}
              className="px-4 h-10"
            >
              Admin
            </Button>
          )}
        </div>
        
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center cursor-pointer hover:bg-gray-100 rounded-full p-1.5 transition-colors">
                <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
                  {user.name}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {getUserInitials(user.name)}
                  </span>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-medium">Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span className="flex items-center">
                  Role: <span className="ml-1 capitalize font-medium">{user.role}</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default Header;
