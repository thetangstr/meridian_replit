import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, History, Settings } from "lucide-react";
import { canAccessAdminSettings, canReviewCars } from "@/lib/auth";

function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-10 shadow-md">
      {canReviewCars(user) && (
        <Button
          variant="ghost" 
          className={`flex flex-col items-center px-4 py-2 h-auto ${location === '/' ? 'text-primary' : 'text-gray-500'}`}
          onClick={() => setLocation('/')}
        >
          <ClipboardCheck className="h-5 w-5 mb-1" />
          <span className="text-xs">Reviews</span>
        </Button>
      )}
      
      <Button
        variant="ghost" 
        className="flex flex-col items-center px-4 py-2 h-auto text-gray-500"
        onClick={() => {
          // This would go to history/recent reviews
          setLocation('/');
        }}
      >
        <History className="h-5 w-5 mb-1" />
        <span className="text-xs">History</span>
      </Button>
      
      {canAccessAdminSettings(user) && (
        <Button
          variant="ghost" 
          className={`flex flex-col items-center px-4 py-2 h-auto ${location === '/admin' ? 'text-primary' : 'text-gray-500'}`}
          onClick={() => setLocation('/admin')}
        >
          <Settings className="h-5 w-5 mb-1" />
          <span className="text-xs">Settings</span>
        </Button>
      )}
    </div>
  );
}

export default MobileNav;
