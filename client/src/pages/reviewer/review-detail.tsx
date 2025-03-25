import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronRight, Navigation, Headphones, Phone, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CujCategory, Task, Review, ReviewWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

type CategoryProgress = {
  id: number;
  name: string;
  icon: string;
  completedTasks: number;
  totalTasks: number;
};

export default function ReviewDetail() {
  const params = useParams();
  const reviewId = Number(params.id);
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
  
  // Fetch review details
  const { data: review, isLoading: isLoadingReview } = useQuery<ReviewWithDetails>({
    queryKey: [`/api/reviews/${reviewId}`],
  });
  
  // Fetch CUJ categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery<CujCategory[]>({
    queryKey: ['/api/cuj-categories'],
  });
  
  // Fetch tasks with their completion status
  const { data: tasks, isLoading: isLoadingTasks } = useQuery<{ tasks: Task[], completedTaskIds: number[] }>({
    queryKey: [`/api/reviews/${reviewId}/tasks`],
  });
  
  // Loading states
  const isLoading = isLoadingReview || isLoadingCategories || isLoadingTasks;
  
  // Update review status mutation
  const updateReviewStatus = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest('PATCH', `/api/reviews/${reviewId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
    }
  });
  
  // Calculate progress
  const calculateProgress = () => {
    if (!tasks) return { totalCompleted: 0, totalTasks: 0, progressPercentage: 0, categoriesProgress: [] };
    
    const { tasks: allTasks, completedTaskIds } = tasks;
    const totalCompleted = completedTaskIds.length;
    const totalTasks = allTasks.length;
    const progressPercentage = totalTasks === 0 ? 0 : (totalCompleted / totalTasks) * 100;
    
    // Group tasks by category
    const tasksByCategory = allTasks.reduce((acc, task) => {
      const categoryId = task.cujId; // This would need to be adjusted based on the actual data structure
      if (!acc[categoryId]) {
        acc[categoryId] = { total: 0, completed: 0 };
      }
      acc[categoryId].total += 1;
      if (completedTaskIds.includes(task.id)) {
        acc[categoryId].completed += 1;
      }
      return acc;
    }, {} as Record<number, { total: number, completed: number }>);
    
    // Map to category progress
    const categoriesProgress: CategoryProgress[] = categories?.map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      completedTasks: tasksByCategory[category.id]?.completed || 0,
      totalTasks: tasksByCategory[category.id]?.total || 0,
    })) || [];
    
    return { totalCompleted, totalTasks, progressPercentage, categoriesProgress };
  };
  
  const { totalCompleted, totalTasks, progressPercentage, categoriesProgress } = calculateProgress();
  
  // Toggle category expansion
  const toggleCategoryExpand = (categoryId: number) => {
    setExpandedCategories(current => 
      current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId]
    );
  };
  
  // Start or continue review
  const handleStartReview = () => {
    if (review?.status === 'pending') {
      updateReviewStatus.mutate('in_progress');
    }
  };
  
  // Go to task evaluation
  const handleEvaluateTask = (taskId: number) => {
    setLocation(`/reviews/${reviewId}/tasks/${taskId}`);
  };
  
  // Go to category evaluation
  const handleEvaluateCategory = (categoryId: number) => {
    setLocation(`/reviews/${reviewId}/categories/${categoryId}`);
  };
  
  // Get icon component for category
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'navigation':
        return <Navigation className="text-primary mr-2" />;
      case 'headphones':
        return <Headphones className="text-primary mr-2" />;
      case 'phone':
        return <Phone className="text-primary mr-2" />;
      default:
        return <Settings className="text-primary mr-2" />;
    }
  };
  
  // Check if a task is completed
  const isTaskCompleted = (taskId: number) => {
    return tasks?.completedTaskIds.includes(taskId) || false;
  };
  
  // Get category by CUJ ID
  const getCategoryByCujId = (cujId: number) => {
    if (!categories) return null;
    // This assumes cujId corresponds to a category id, which may not be the case
    // You would need to adjust based on your actual data structure
    return categories.find(cat => cat.id === cujId);
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-full mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="text-center">
                  <Skeleton className="h-8 w-16 mx-auto mb-1" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Skeleton className="h-6 w-6 mr-2 rounded-full" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (!review || !categories || !tasks) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => setLocation('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-medium text-foreground">Review Not Found</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-destructive">Error loading review</h3>
            <p className="text-muted-foreground mt-2">
              The requested review could not be found or there was an error loading data.
            </p>
            <Button className="mt-4" onClick={() => setLocation('/')}>
              Back to Reviews
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-2" onClick={() => setLocation('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-medium text-foreground">
          {review.car.make} {review.car.model} ({review.car.year}) Review
        </h2>
      </div>
      
      {/* Review Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Review Progress</h3>
            <span className="text-sm text-muted-foreground">{totalCompleted}/{totalTasks} tasks completed</span>
          </div>
          <Progress value={progressPercentage} className="h-2.5" />
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categoriesProgress.map(cat => (
              <div key={cat.id} className="text-center">
                <div className="text-2xl font-bold text-primary">{cat.completedTasks}/{cat.totalTasks}</div>
                <div className="text-sm text-muted-foreground">{cat.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* CUJ Categories */}
      <div className="space-y-6">
        {categories.map(category => {
          const categoryTasks = tasks.tasks.filter(task => getCategoryByCujId(task.cujId)?.id === category.id);
          const completedCount = categoryTasks.filter(task => isTaskCompleted(task.id)).length;
          const isExpanded = expandedCategories.includes(category.id);
          
          return (
            <Card key={category.id} className="overflow-hidden">
              <div 
                className="p-4 cursor-pointer flex justify-between items-center"
                onClick={() => toggleCategoryExpand(category.id)}
              >
                <div className="flex items-center">
                  {getCategoryIcon(category.icon)}
                  <h3 className="font-medium">{category.name}</h3>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-2">
                    {completedCount}/{categoryTasks.length} completed
                  </span>
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {categoryTasks.map(task => (
                    <div key={task.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium">{task.name}</h4>
                          {task.prerequisites && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Prerequisites: {task.prerequisites}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center">
                          {isTaskCompleted(task.id) ? (
                            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-primary border-primary rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEvaluateTask(task.id);
                              }}
                            >
                              Evaluate
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium">Expected Outcome:</p>
                        <p className="text-sm text-muted-foreground">{task.expectedOutcome}</p>
                      </div>
                      {isTaskCompleted(task.id) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-3 text-primary p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEvaluateTask(task.id);
                          }}
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          View Evaluation
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {/* Category Evaluation Button */}
                  <div className="p-4 flex justify-center border-b border-gray-200">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEvaluateCategory(category.id);
                      }}
                    >
                      Evaluate Category Overall
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
