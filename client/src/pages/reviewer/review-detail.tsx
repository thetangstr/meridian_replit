import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronRight, Navigation, Headphones, Phone, Settings, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CujCategory, Task, Review, ReviewWithDetails, TaskEvaluation, Cuj } from "@shared/schema";

// Extend Task type to include cuj relationship
type TaskWithCuj = Task & {
  cuj?: {
    id: number;
    name: string;
    categoryId: number;
    category?: CujCategory;
  };
};
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { getScoreColorClass } from "@/lib/utils";

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
  
  // Store task evaluations data
  const [taskEvaluations, setTaskEvaluations] = useState<Record<number, TaskEvaluation>>({});
  
  // Fetch review details
  const { data: review, isLoading: isLoadingReview } = useQuery<ReviewWithDetails>({
    queryKey: [`/api/reviews/${reviewId}`],
  });
  
  // Fetch CUJ categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery<CujCategory[]>({
    queryKey: ['/api/cuj-categories'],
  });
  
  // Fetch tasks with their completion status
  const { data: tasks, isLoading: isLoadingTasks } = useQuery<{ tasks: TaskWithCuj[], completedTaskIds: number[] }>({
    queryKey: [`/api/reviews/${reviewId}/tasks`],
  });
  
  // Fetch task evaluations for this review
  const { data: taskEvaluationsData, isLoading: isLoadingTaskEvals } = useQuery<TaskEvaluation[]>({
    queryKey: [`/api/reviews/${reviewId}/task-evaluations`],
    enabled: !!reviewId && !!tasks && Array.isArray(tasks.completedTaskIds) && tasks.completedTaskIds.length > 0,
  });
  
  // Process task evaluations when data is loaded
  useEffect(() => {
    if (taskEvaluationsData && taskEvaluationsData.length > 0) {
      const taskEvalsMap: Record<number, TaskEvaluation> = {};
      taskEvaluationsData.forEach(taskEval => {
        taskEvalsMap[taskEval.taskId] = taskEval;
      });
      setTaskEvaluations(taskEvalsMap);
    }
  }, [taskEvaluationsData]);
  
  // Loading states
  const isLoading = isLoadingReview || isLoadingCategories || isLoadingTasks || isLoadingTaskEvals;
  
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
    if (!tasks || !categories) return { totalCompleted: 0, totalTasks: 0, progressPercentage: 0, categoriesProgress: [] };
    
    const { tasks: allTasks, completedTaskIds } = tasks;
    const totalCompleted = completedTaskIds.length;
    const totalTasks = allTasks.length;
    const progressPercentage = totalTasks === 0 ? 0 : (totalCompleted / totalTasks) * 100;
    
    // Initialize category progress tracking
    const categoryProgressMap = categories.reduce((acc, category) => {
      acc[category.id] = { 
        id: category.id, 
        name: category.name, 
        icon: category.icon || '', 
        completedTasks: 0, 
        totalTasks: 0 
      };
      return acc;
    }, {} as Record<number, CategoryProgress>);
    
    // Count tasks for each category
    allTasks.forEach(task => {
      // Get the category for this task through the CUJ
      if (task.cuj && task.cuj.category && task.cuj.category.id) {
        const categoryId = task.cuj.category.id;
        if (categoryProgressMap[categoryId]) {
          categoryProgressMap[categoryId].totalTasks += 1;
          
          if (completedTaskIds.includes(task.id)) {
            categoryProgressMap[categoryId].completedTasks += 1;
          }
        }
      }
    });
    
    // Convert to array
    const categoriesProgress = Object.values(categoryProgressMap);
    
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
  const getCategoryIcon = (iconName: string | null) => {
    if (!iconName) return <Settings className="text-primary mr-2" />;
    
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
    if (!categories || !tasks) return null;
    
    // Find all tasks with this CUJ ID and check if any of them have the category info
    const tasksWithCuj = tasks.tasks.filter(task => task.cujId === cujId);
    
    for (const task of tasksWithCuj) {
      if (task.cuj && task.cuj.category) {
        return task.cuj.category;
      }
    }
    
    // If we couldn't find a category through the tasks, 
    // try finding one directly from the categories list by matching the CUJ
    for (const category of categories) {
      // If we have a task with this CUJ in this category, return the category
      const taskInCategory = tasks.tasks.find(
        task => task.cujId === cujId && task.cuj && task.cuj.category && task.cuj.category.id === category.id
      );
      
      if (taskInCategory) {
        return category;
      }
    }
    
    // If nothing else works, return the first category as a fallback
    return categories.length > 0 ? categories[0] : null;
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
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Tasks ({completedCount}/{categoryTasks.length})</h4>
                      <div className="text-xs text-muted-foreground">
                        Each task requires ratings for: Doable (Yes/No), Usability (1-4), Visuals (1-4)
                      </div>
                    </div>
                  </div>
                  
                  {categoryTasks.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No tasks found for this category
                    </div>
                  ) : (
                    categoryTasks.map(task => (
                      <div key={task.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                        <div className="flex justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{task.name}</h4>
                            {task.prerequisites && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <span className="font-medium">Prerequisites:</span> {task.prerequisites}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            {isTaskCompleted(task.id) ? (
                              <div className="flex items-center space-x-1">
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <span className="text-xs text-muted-foreground">Completed</span>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-primary border-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEvaluateTask(task.id);
                                }}
                              >
                                Evaluate Task
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm font-medium">Expected Outcome:</p>
                          <p className="text-sm text-muted-foreground">{task.expectedOutcome}</p>
                        </div>
                        {isTaskCompleted(task.id) && (
                          <div className="mt-3 flex justify-between items-center">
                            <div className="flex space-x-4">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Doable:</span>
                                <span className="text-xs font-medium">
                                  {taskEvaluations[task.id]?.doable === true ? (
                                    <span className="text-green-600">Yes</span>
                                  ) : taskEvaluations[task.id]?.doable === false ? (
                                    <span className="text-red-600">No</span>
                                  ) : "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Usability:</span>
                                <span className={`text-xs font-medium ${getScoreColorClass(taskEvaluations[task.id]?.usabilityScore)}`}>
                                  {taskEvaluations[task.id]?.usabilityScore ? `${taskEvaluations[task.id]?.usabilityScore}/4` : "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Visuals:</span>
                                <span className={`text-xs font-medium ${getScoreColorClass(taskEvaluations[task.id]?.visualsScore)}`}>
                                  {taskEvaluations[task.id]?.visualsScore ? `${taskEvaluations[task.id]?.visualsScore}/4` : "N/A"}
                                </span>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEvaluateTask(task.id);
                              }}
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              View/Edit Evaluation
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Category Evaluation Button */}
                  <div className="p-4 flex justify-center border-b border-gray-200">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEvaluateCategory(category.id);
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Evaluate {category.name} Category Overall
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
