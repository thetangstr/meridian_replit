import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronRight, Navigation, Headphones, Phone, Settings, Check, X, Download, FileSpreadsheet, FileText, Camera as CameraIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CujCategory, Task, Review, ReviewWithDetails, TaskEvaluation, CategoryEvaluation, Cuj } from "@shared/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportReviewToCSV, generateGoogleDocsExport, exportReviewToGoogleSheets } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import FileSaver from "file-saver";

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
import { getScoreColorClass, getScoreTextColorClass, calculateTaskScore, calculateCategoryScore as utilsCalculateCategoryScore } from "@/lib/utils";

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
  
  // Get query parameters from URL
  const getURLParams = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params;
    }
    return new URLSearchParams();
  };
  
  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<number[]>(() => {
    // Check for expandCategory parameter in URL
    const params = getURLParams();
    const expandCategory = params.get('expandCategory');
    return expandCategory ? [parseInt(expandCategory)] : [];
  });
  
  const { toast } = useToast();
  
  // Also look for category parameter which is passed from task evaluation page
  useEffect(() => {
    const params = getURLParams();
    const category = params.get('category');
    if (category && !expandedCategories.includes(parseInt(category))) {
      setExpandedCategories(prev => [...prev, parseInt(category)]);
    }
  }, []);
  
  // Store task evaluations data
  const [taskEvaluations, setTaskEvaluations] = useState<Record<number, TaskEvaluation>>({});
  // Store category evaluations data
  const [categoryEvaluations, setCategoryEvaluations] = useState<Record<number, CategoryEvaluation>>({});
  
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
  
  // Fetch category evaluations for this review
  const { data: categoryEvaluationsData, isLoading: isLoadingCategoryEvals } = useQuery<CategoryEvaluation[]>({
    queryKey: [`/api/reviews/${reviewId}/category-evaluations`],
    enabled: !!reviewId && !!categories && categories.length > 0,
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
  
  // Process category evaluations when data is loaded
  useEffect(() => {
    // Initialize with empty object instead of setting to null when no data
    const categoryEvalsMap: Record<number, CategoryEvaluation> = {};
    
    if (categoryEvaluationsData && categoryEvaluationsData.length > 0) {
      console.log('Processing category evaluations data:', categoryEvaluationsData);
      
      categoryEvaluationsData.forEach(catEval => {
        categoryEvalsMap[catEval.categoryId] = catEval;
      });
      
      console.log('Resulting category evaluations map:', categoryEvalsMap);
    } else {
      console.log('No category evaluations data available:', categoryEvaluationsData);
    }
    
    // Always update state, even with empty map
    setCategoryEvaluations(categoryEvalsMap);
  }, [categoryEvaluationsData]);
  
  // Loading states
  const isLoading = isLoadingReview || isLoadingCategories || isLoadingTasks || isLoadingTaskEvals || isLoadingCategoryEvals;
  
  // Update review status mutation
  const updateReviewStatus = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
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
  
  // Convert task evaluations map to array for export
  const getTaskEvaluationsForExport = () => {
    if (!taskEvaluationsData || !tasks || !tasks.tasks) return [];
    
    return taskEvaluationsData.map(taskEval => {
      const task = tasks.tasks.find(t => t.id === taskEval.taskId);
      if (!task) return null;
      
      // Create a properly typed TaskEvaluationWithTask object
      return {
        ...taskEval,
        task: {
          ...task,
          cuj: task.cuj || { id: 0, name: 'Unknown', categoryId: 0, category: null }
        }
      } as any; // Use type assertion to avoid TypeScript errors
    }).filter(item => item !== null) as any[]; // Filter out null values
  };
  
  // Convert category evaluations to the proper format with category info
  const getCategoryEvaluationsForExport = () => {
    if (!categoryEvaluationsData || !categories) return [];
    
    return categoryEvaluationsData.map(catEval => {
      const category = categories.find(cat => cat.id === catEval.categoryId);
      // Add category information to each evaluation for export
      return {
        ...catEval,
        category: category || { id: 0, name: 'Unknown', description: null, icon: null }
      };
    }) as any[]; // Type assertion to avoid TypeScript errors
  };
  
  // Export to CSV
  const handleExportCSV = () => {
    if (!review) return;
    
    try {
      const taskEvaluationsForExport = getTaskEvaluationsForExport();
      const categoryEvals = getCategoryEvaluationsForExport();
      
      // Check if all tasks are completed
      const isComplete = totalCompleted === totalTasks;
      
      if (!isComplete) {
        // Show warning about incomplete data
        const confirmed = window.confirm(
          `This review is incomplete (${totalCompleted} of ${totalTasks} tasks completed). The export may contain partial data. Do you want to continue?`
        );
        
        if (!confirmed) return;
      }
      
      exportReviewToCSV(review, taskEvaluationsForExport, categoryEvals);
      
      toast({
        title: "Export Successful",
        description: `Data has been exported to CSV${!isComplete ? ' (incomplete)' : ''}.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export to CSV. Please try again.",
        variant: "destructive"
      });
      console.error("CSV export error:", error);
    }
  };
  
  // Export to Google Docs
  const handleExportGoogleDocs = () => {
    if (!review) return;
    
    try {
      // Check if all tasks are completed
      const isComplete = totalCompleted === totalTasks;
      
      if (!isComplete) {
        // Show warning about incomplete data
        const confirmed = window.confirm(
          `This review is incomplete (${totalCompleted} of ${totalTasks} tasks completed). The export may contain partial data. Do you want to continue?`
        );
        
        if (!confirmed) return;
      }
      
      // Prepare "report" structure for the Google Docs export
      const mockReport = {
        id: 0,
        reviewId: review.id,
        summary: `${review.car.make} ${review.car.model} (${review.car.year}) Review${!isComplete ? ' - INCOMPLETE' : ''}`,
        findings: !isComplete ? 'This is an incomplete review with partial data.' : '',
        recommendations: '',
        issues: [],
        overallScore: null,
        topLikes: null,
        topHates: null,
        benchmarkRank: null,
        benchmarkComparison: null,
        topIssues: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        review: review
      } as any; // Type assertion to satisfy TypeScript
      
      const taskEvaluationsForExport = getTaskEvaluationsForExport();
      const categoryEvals = getCategoryEvaluationsForExport();
      
      const url = generateGoogleDocsExport(mockReport, taskEvaluationsForExport, categoryEvals);
      window.open(url, '_blank');
      
      toast({
        title: "Export Initiated",
        description: "A simplified summary is being created in Google Docs. For full details, download the CSV export.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not open Google Docs. Please try again.",
        variant: "destructive"
      });
      console.error("Google Docs export error:", error);
    }
  };
  
  // Export to Google Sheets
  const handleExportGoogleSheets = () => {
    if (!review) return;
    
    try {
      // Check if all tasks are completed
      const isComplete = totalCompleted === totalTasks;
      
      if (!isComplete) {
        // Show warning about incomplete data
        const confirmed = window.confirm(
          `This review is incomplete (${totalCompleted} of ${totalTasks} tasks completed). The export may contain partial data. Do you want to continue?`
        );
        
        if (!confirmed) return;
      }
      
      const taskEvaluationsForExport = getTaskEvaluationsForExport();
      const categoryEvals = getCategoryEvaluationsForExport();
      
      const url = exportReviewToGoogleSheets(review, taskEvaluationsForExport, categoryEvals);
      window.open(url, '_blank');
      
      toast({
        title: "CSV Export Complete",
        description: "Your CSV file has been downloaded. Google Sheets will now open in a new tab for importing.",
      });
    } catch (error) {
      toast({
        title: "Export Failed", 
        description: "Could not open Google Sheets. Please try again.",
        variant: "destructive"
      });
      console.error("Google Sheets export error:", error);
    }
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
  
  // Calculate category score based on task evaluations and category evaluations
  const calculateCategoryScore = (categoryId: number) => {
    if (!tasks || !tasks.tasks) {
      return null;
    }
    
    const categoryTasks = tasks.tasks.filter(task => getCategoryByCujId(task.cujId)?.id === categoryId);
    const completedTasks = categoryTasks.filter(task => isTaskCompleted(task.id));
    const categoryEvaluation = categoryEvaluations[categoryId];
    
    // If no tasks are completed and no category evaluation exists, return null
    if (completedTasks.length === 0 && !categoryEvaluation) {
      return null;
    }
    
    // Calculate average task scores using our utility function
    let taskScoresSum = 0;
    let taskScoresCount = 0;
    
    completedTasks.forEach(task => {
      const evaluation = taskEvaluations[task.id];
      if (evaluation) {
        const taskScore = calculateTaskScore(evaluation);
        if (taskScore !== null) {
          taskScoresSum += taskScore;
          taskScoresCount++;
        }
      }
    });
    
    // Get average task score if any valid scores exist
    const avgTaskScore = taskScoresCount > 0 ? taskScoresSum / taskScoresCount : null;
    
    // Use our utility function to calculate the category score
    return utilsCalculateCategoryScore(avgTaskScore, categoryEvaluation);
  };
  
  // Calculate overall vehicle score across all categories
  const calculateOverallScore = () => {
    if (!categories || categories.length === 0) {
      return 'N/A';
    }
    
    let totalScore = 0;
    let totalCategories = 0;
    
    categories.forEach(category => {
      const score = calculateCategoryScore(category.id);
      if (score !== null) {
        totalScore += score;
        totalCategories++;
      }
    });
    
    return totalCategories > 0 
      ? parseFloat((totalScore / totalCategories).toFixed(1)) 
      : 'N/A';
  };
  
  // Get category by CUJ ID
  const getCategoryByCujId = (cujId: number) => {
    if (!categories || !tasks || !tasks.tasks) return null;
    
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" className="mr-2" onClick={() => setLocation('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-medium text-foreground">
            {review.car.make} {review.car.model} ({review.car.year}) Review
          </h2>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-1 h-4 w-4" />
              Export <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportGoogleSheets}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Google Sheets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportGoogleDocs}>
              <FileText className="mr-2 h-4 w-4" />
              Google Docs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Car Details Card */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-4 md:gap-6">
            {/* Car Image */}
            <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-muted rounded-md overflow-hidden">
              {review.car.imageUrl ? (
                <img 
                  src={review.car.imageUrl} 
                  alt={`${review.car.make} ${review.car.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                  <CameraIcon className="h-8 w-8 opacity-50" />
                </div>
              )}
            </div>
            
            {/* Car Info */}
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-1">{review.car.make} {review.car.model} ({review.car.year})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Android Version:</span>{" "}
                  <span className="font-medium">{review.car.androidVersion}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-medium">{review.car.location}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Build:</span>{" "}
                  <span className="font-mono text-xs">{review.car.buildFingerprint}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Review Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Review Progress</h3>
            <div className="flex items-center gap-2">
              {totalCompleted === totalTasks && totalTasks > 0 ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All Tasks Complete
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">{totalCompleted}/{totalTasks} tasks completed</span>
              )}
            </div>
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
      
      {/* Overall Vehicle Score */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="font-medium mb-4">Overall Vehicle Score</h3>
          
          <div className="flex flex-col sm:flex-row justify-between mb-6">
            <div className="flex-1 text-center mb-4 sm:mb-0">
              <div className="inline-flex items-center justify-center bg-primary/10 w-20 h-20 rounded-full mb-2">
                <span className="text-3xl font-bold text-primary">
                  {calculateOverallScore()}
                </span>
              </div>
              <div className="text-sm font-medium">Overall Rating</div>
            </div>
            
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-2">CUJ Category Scores</h4>
              <div className="space-y-3">
                {categories.map(category => {
                  const score = calculateCategoryScore(category.id);
                  return (
                    <div key={category.id} className="flex items-center">
                      <div className="w-6 h-6 mr-2 flex items-center justify-center">
                        {getCategoryIcon(category.icon)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{category.name}</span>
                          <span className={`text-sm font-medium ${getScoreTextColorClass(score)}`}>
                            {score !== null ? score.toFixed(1) : 'N/A'}
                          </span>
                        </div>
                        <Progress 
                          value={score !== null ? score : 0} 
                          max={100}
                          className={`h-1.5 ${getScoreColorClass(score)}`} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* CUJ Categories */}
      <div className="space-y-6">
        {categories.map(category => {
          const categoryTasks = tasks?.tasks?.filter(task => getCategoryByCujId(task.cujId)?.id === category.id) || [];
          const completedCount = categoryTasks.filter(task => isTaskCompleted(task.id)).length;
          const isExpanded = expandedCategories.includes(category.id);
          
          return (
            <Card key={category.id} className="overflow-hidden">
              <div 
                className="p-4 cursor-pointer flex justify-between items-center bg-muted/30"
                onClick={() => toggleCategoryExpand(category.id)}
              >
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {getCategoryIcon(category.icon)}
                  </div>
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    {/* Display category score if available */}
                    {calculateCategoryScore(category.id) !== null && (
                      <div className="mt-1">
                        <div className="flex items-center">
                          <span className="text-xs text-muted-foreground mr-1">Score:</span>
                          <span className={`text-xs font-medium ${getScoreTextColorClass(calculateCategoryScore(category.id))}`}>
                            {calculateCategoryScore(category.id)?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        <div className="w-20 h-1.5 mt-0.5">
                          <Progress 
                            value={calculateCategoryScore(category.id)} 
                            max={100}
                            className={`h-1.5 ${getScoreColorClass(calculateCategoryScore(category.id))}`} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
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
                  {/* Category evaluation display section */}
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-base">{category.name} Category</h4>
                      
                      {/* Category Evaluation Button - Moved higher in UI */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEvaluateCategory(category.id);
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Evaluate Category
                      </Button>
                    </div>

                    {/* Category evaluation results summary */}
                    {categoryEvaluations && categoryEvaluations[category.id] && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-muted-foreground">Responsiveness:</span>
                            {(() => {
                              const evalData = categoryEvaluations[category.id];
                              if (!evalData) return <span className="text-xs font-medium">N/A</span>;
                              
                              const score = evalData.responsivenessScore;
                              const scorePercentage = score ? (score / 4) * 100 : null;
                              return (
                                <span className={`text-xs font-medium ${getScoreColorClass(scorePercentage)}`}>
                                  {score ? `${score}/4` : "N/A"}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-muted-foreground">Writing:</span>
                            {(() => {
                              const evalData = categoryEvaluations[category.id];
                              if (!evalData) return <span className="text-xs font-medium">N/A</span>;
                              
                              const score = evalData.writingScore;
                              const scorePercentage = score ? (score / 4) * 100 : null;
                              return (
                                <span className={`text-xs font-medium ${getScoreColorClass(scorePercentage)}`}>
                                  {score ? `${score}/4` : "N/A"}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-muted-foreground">Emotional:</span>
                            {(() => {
                              const evalData = categoryEvaluations[category.id];
                              if (!evalData) return <span className="text-xs font-medium">N/A</span>;
                              
                              const score = evalData.emotionalScore;
                              const scorePercentage = score ? (score / 4) * 100 : null;
                              return (
                                <span className={`text-xs font-medium ${getScoreColorClass(scorePercentage)}`}>
                                  {score ? `${score}/4` : "N/A"}
                                </span>
                              );
                            })()}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary ml-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEvaluateCategory(category.id);
                            }}
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            View/Edit Evaluation
                          </Button>
                        </div>
                        
                        {/* Display feedback when available */}
                        {(() => {
                          const evalData = categoryEvaluations[category.id];
                          if (!evalData) return null;
                          
                          const hasFeedback = evalData.responsivenessFeedback || evalData.writingFeedback || evalData.emotionalFeedback;
                          
                          if (!hasFeedback) return null;
                          
                          return (
                            <div className="border-t border-gray-200 pt-3 mt-3">
                              <h5 className="font-medium text-sm mb-2">Feedback Notes</h5>
                              <div className="space-y-2 text-sm">
                                {evalData.responsivenessFeedback && (
                                  <div className="bg-white p-2 rounded-md">
                                    <span className="font-medium">Responsiveness: </span>
                                    {evalData.responsivenessFeedback}
                                  </div>
                                )}
                                {evalData.writingFeedback && (
                                  <div className="bg-white p-2 rounded-md">
                                    <span className="font-medium">Writing: </span>
                                    {evalData.writingFeedback}
                                  </div>
                                )}
                                {evalData.emotionalFeedback && (
                                  <div className="bg-white p-2 rounded-md">
                                    <span className="font-medium">Emotional Engagement: </span>
                                    {evalData.emotionalFeedback}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Display media evidence when available */}
                        {(() => {
                          const evalData = categoryEvaluations[category.id];
                          if (!evalData) return null;
                          
                          // Ensure media is an array with a default of empty array
                          const mediaArray = Array.isArray(evalData.media) ? evalData.media : [];
                          if (mediaArray.length === 0) return null;
                          
                          return (
                            <div className="border-t border-gray-200 pt-3 mt-3">
                              <h5 className="font-medium text-sm mb-2">Evidence</h5>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {mediaArray.map((item: any) => (
                                  <div key={item.id} className="relative aspect-video rounded-md overflow-hidden bg-black/5">
                                    {item.type === 'image' ? (
                                      <img 
                                        src={item.url} 
                                        alt="Evidence" 
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <video 
                                        src={item.url} 
                                        controls 
                                        className="h-full w-full object-cover"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="mt-3 flex justify-between items-center">
                      <div className="flex space-x-4">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">Tasks:</span>
                          <span className="text-sm">
                            {completedCount}/{categoryTasks.length} completed
                          </span>
                        </div>
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
                                {(() => {
                                  const score = taskEvaluations[task.id]?.usabilityScore;
                                  const scorePercentage = score ? (score / 4) * 100 : null;
                                  return (
                                    <span className={`text-xs font-medium ${getScoreColorClass(scorePercentage)}`}>
                                      {score ? `${score}/4` : "N/A"}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-muted-foreground">Visuals:</span>
                                {(() => {
                                  const score = taskEvaluations[task.id]?.visualsScore;
                                  const scorePercentage = score ? (score / 4) * 100 : null;
                                  return (
                                    <span className={`text-xs font-medium ${getScoreColorClass(scorePercentage)}`}>
                                      {score ? `${score}/4` : "N/A"}
                                    </span>
                                  );
                                })()}
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

                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
