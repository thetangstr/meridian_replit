import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Info } from "lucide-react";
import { Review, ReviewWithDetails, Car } from "@shared/schema";
import { formatDateRange, formatShortDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CarSelectionDialog } from "@/components/dialogs/car-selection-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface CompletionStatus {
  completedTasks: number;
  totalTasks: number;
}

export default function ReviewerDashboard() {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const [isCarDialogOpen, setIsCarDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: reviews, isLoading, error } = useQuery<ReviewWithDetails[]>({
    queryKey: ['/api/reviews'],
  });
  
  // Get task completion data for all reviews
  const { data: completionStatus, isLoading: isLoadingCompletion } = useQuery<Record<string, CompletionStatus>>({
    queryKey: ['/api/reviews-completion-status'],
    enabled: !!reviews && reviews.length > 0,
  });
  
  // Create new review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (data: { carId: number }) => {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 14); // Set due date 2 weeks from now
      
      return apiRequest<Review>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          carId: data.carId,
          reviewerId: user?.id,
          startDate: today.toISOString(),
          endDate: endDate.toISOString(),
          status: 'pending'
        }),
      });
    },
    onSuccess: (newReview) => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
      toast({
        title: "Review created",
        description: "New car review has been created successfully"
      });
      setLocation(`/reviews/${newReview.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating review",
        description: String(error),
        variant: "destructive",
      });
    },
  });
  
  const handleStartReview = (reviewId: number) => {
    setLocation(`/reviews/${reviewId}`);
  };
  
  const handleNewReview = () => {
    setIsCarDialogOpen(true);
  };
  
  const handleCarSelected = (car: Car) => {
    createReviewMutation.mutate({ carId: car.id });
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-medium text-foreground">Your Review Queue</h2>
          <div className="hidden sm:block">
            <Button disabled>
              <PlusCircle className="mr-1 h-4 w-4" />
              New Review
            </Button>
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-60 mb-1" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-10 w-24 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-medium text-foreground">Your Review Queue</h2>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <h3 className="text-lg font-medium text-red-800">Error loading reviews</h3>
            <p className="text-red-600">{error instanceof Error ? error.message : "An unexpected error occurred"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Determine status display properties
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'New', bgColor: 'bg-accent bg-opacity-10', textColor: 'text-accent' };
      case 'in_progress':
        return { text: 'In Progress', bgColor: 'bg-primary bg-opacity-10', textColor: 'text-primary' };
      case 'completed':
        return { text: 'Completed', bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
      default:
        return { text: status, bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
    }
  };
  
  // Determine button text based on status
  const getButtonText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Start';
      case 'in_progress':
        return 'Continue';
      case 'completed':
        return 'View';
      default:
        return 'View';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-medium text-foreground">Your Review Queue</h2>
        <div className="hidden sm:block">
          <Button onClick={handleNewReview}>
            <PlusCircle className="mr-1 h-4 w-4" />
            New Review
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        {reviews && reviews.length > 0 ? (
          reviews.map(review => {
            const { text, bgColor, textColor } = getStatusDisplay(review.status);
            const buttonText = getButtonText(review.status);
            
            // Check if review is past due date
            const isPastDue = new Date(review.endDate) < new Date() && review.status !== 'completed';
            const isPublished = review.isPublished;
            
            return (
              <Card 
                key={review.id} 
                className={`border ${isPastDue ? 'border-red-300' : isPublished ? 'border-green-300' : 'border-gray-200'} 
                           ${isPublished ? 'bg-green-50' : ''}`}
              >
                <CardContent className="p-4 relative">
                  {isPublished && (
                    <div className="absolute top-2 right-2 text-green-600 flex items-center gap-1">
                      <Info className="h-4 w-4" />
                      <span className="text-xs">Published</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium">
                        {review.car.make} {review.car.model} ({review.car.year})
                      </h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Android v{review.car.androidVersion} • Build: {review.car.buildFingerprint}</p>
                        <p>Location: {review.car.location}</p>
                      </div>
                    </div>
                    <div className={`${bgColor} ${textColor} px-3 py-1 rounded-full text-sm mt-6`}>
                      {text}
                    </div>
                  </div>
                  {/* Progress Indicator */}
                  <div className="mt-3">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                      <span>Completion Progress</span>
                      <span>
                        {completionStatus && completionStatus[review.id] ? 
                          `${completionStatus[review.id].completedTasks} / ${completionStatus[review.id].totalTasks} tasks` : 
                          "Loading..."}
                      </span>
                    </div>
                    <Progress 
                      value={completionStatus && completionStatus[review.id] ? 
                        (completionStatus[review.id].completedTasks / 
                        completionStatus[review.id].totalTasks) * 100 : 0} 
                      className="h-2"
                    />
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date:</p>
                      <p className={`text-sm font-medium ${isPastDue ? 'text-red-600' : ''}`}>
                        {formatDateRange(review.startDate, review.endDate)}
                      </p>
                      
                      {review.lastModifiedBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last modified by {review.lastModifiedBy.name} on {formatShortDate(new Date(review.updatedAt))}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleStartReview(review.id)}
                      disabled={isPublished}
                      title={isPublished ? "This review is published and cannot be modified" : ""}
                    >
                      {isPublished ? "View" : buttonText}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border border-gray-200">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-medium text-gray-600">No reviews in your queue</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You don't have any reviews assigned to you yet.
              </p>
              <Button 
                onClick={handleNewReview}
                className="mt-4"
                variant="outline"
              >
                <PlusCircle className="mr-1 h-4 w-4" />
                Create your first review
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Car Selection Dialog */}
      <CarSelectionDialog
        open={isCarDialogOpen}
        onOpenChange={setIsCarDialogOpen}
        onCarSelected={handleCarSelected}
      />
    </div>
  );
}
