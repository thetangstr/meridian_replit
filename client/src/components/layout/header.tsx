import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/utils";
import { Car, LogOut } from "lucide-react";
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
    await logout();
    setLocation('/login');
  };

  if (!user) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        <div className="flex items-center">
          <Car className="text-primary mr-2" />
          <h1 className="text-xl font-medium text-foreground" onClick={() => setLocation('/')} style={{ cursor: 'pointer' }}>
            Score My Car
          </h1>
        </div>
        
        <div className="hidden sm:flex items-center space-x-4">
          {canReviewCars(user) && (
            <Button variant="ghost" onClick={() => setLocation('/')}>Reviews</Button>
          )}
          
          {canAccessAdminSettings(user) && (
            <Button variant="ghost" onClick={() => setLocation('/admin')}>Admin</Button>
          )}
        </div>
        
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center cursor-pointer">
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
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="flex items-center">
                  Role: <span className="ml-1 capitalize">{user.role}</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
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
