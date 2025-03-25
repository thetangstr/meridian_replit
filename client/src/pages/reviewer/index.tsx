import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Review, ReviewWithDetails } from "@shared/schema";
import { formatDateRange } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewerDashboard() {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: reviews, isLoading, error } = useQuery<ReviewWithDetails[]>({
    queryKey: ['/api/reviews'],
  });
  
  const handleStartReview = (reviewId: number) => {
    setLocation(`/reviews/${reviewId}`);
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
          <Button>
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
            
            return (
              <Card key={review.id} className="border border-gray-200">
                <CardContent className="p-4">
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
                    <div className={`${bgColor} ${textColor} px-3 py-1 rounded-full text-sm`}>
                      {text}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Time Window:</p>
                      <p className="text-sm font-medium">
                        {formatDateRange(review.startDate, review.endDate)}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleStartReview(review.id)}
                    >
                      {buttonText}
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
