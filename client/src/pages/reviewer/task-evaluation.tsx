import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Task as BaseTask, TaskEvaluation as BaseTaskEvaluation, scoringScaleDescriptions } from "@shared/schema";
import { MediaCapture } from "@/components/ui/media-capture";
import { useToast } from "@/hooks/use-toast";
import { CSSTransition, TransitionGroup } from "react-transition-group";

// Extend the base Task type to include the cuj property with category data
type Task = BaseTask & { 
  cuj?: { 
    categoryId: number;
    category?: { 
      id: number;
      name: string;
      icon: string;
    }
  }
};

// Extend the TaskEvaluation to include our new fields
type TaskEvaluation = BaseTaskEvaluation & {
  undoableReason?: string;
  usabilityFeedback?: string;
  visualsFeedback?: string;
};

// Form validation schema
const taskEvaluationSchema = z.object({
  doable: z.boolean(),
  undoableReason: z.string().optional(),
  usabilityScore: z.number().min(1).max(4),
  usabilityFeedback: z.string().optional(),
  visualsScore: z.number().min(1).max(4),
  visualsFeedback: z.string().optional(),
  media: z.any().optional(),
});

type TaskEvaluationFormValues = z.infer<typeof taskEvaluationSchema>;

export default function TaskEvaluationPage() {
  const params = useParams();
  const reviewId = Number(params.reviewId);
  const taskId = Number(params.taskId);
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Reference for transition animation
  const nodeRef = useRef(null);
  
  const [submitting, setSubmitting] = useState(false);
  
  // Fetch task details
  const { data: task, isLoading: isLoadingTask } = useQuery<Task>({
    queryKey: [`/api/tasks/${taskId}`],
  });
  
  // Fetch existing evaluation if any
  const { data: evaluation, isLoading: isLoadingEvaluation } = useQuery<TaskEvaluation>({
    queryKey: [`/api/reviews/${reviewId}/tasks/${taskId}/evaluation`],
  });
  
  // Fetch all tasks for this review to find next task in the same category
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery<{ 
    tasks: Array<Task & { 
      cuj?: { 
        categoryId: number,
        category?: { 
          id: number,
          name: string,
          icon: string
        } 
      } 
    }>, 
    completedTaskIds: number[] 
  }>({
    queryKey: [`/api/reviews/${reviewId}/tasks`],
  });
  
  const isLoading = isLoadingTask || isLoadingEvaluation || isLoadingTasks;
  
  // Setup form with existing data if available
  const form = useForm<TaskEvaluationFormValues>({
    resolver: zodResolver(taskEvaluationSchema),
    defaultValues: {
      doable: evaluation?.doable ?? true,
      undoableReason: evaluation?.undoableReason ?? '',
      usabilityScore: evaluation?.usabilityScore ?? undefined,
      usabilityFeedback: evaluation?.usabilityFeedback ?? '',
      visualsScore: evaluation?.visualsScore ?? undefined,
      visualsFeedback: evaluation?.visualsFeedback ?? '',
      media: evaluation?.media ?? [],
    },
  });
  
  // Watch form values to show/hide conditional fields
  const watchDoable = form.watch("doable");
  const watchUsabilityScore = form.watch("usabilityScore");
  const watchVisualsScore = form.watch("visualsScore");
  
  // Find the next task in the same category
  const findNextTask = () => {
    if (!task || !tasksData || !tasksData.tasks) return null;
    
    // Get the current task's category ID
    const currentTask = tasksData.tasks.find(t => t.id === taskId);
    if (!currentTask || !currentTask.cuj) {
      return null; // Can't determine the category
    }
    
    const currentCategoryId = currentTask.cuj.categoryId;
    
    // Find all tasks in the same category
    const tasksInSameCategory = tasksData.tasks.filter(t => 
      t.cuj && t.cuj.categoryId === currentCategoryId
    );
    
    // Sort them by ID to maintain order
    tasksInSameCategory.sort((a, b) => a.id - b.id);
    
    // Find the current task's index
    const currentIndex = tasksInSameCategory.findIndex(t => t.id === taskId);
    
    // If there's a next task in the same category, return it
    if (currentIndex >= 0 && currentIndex < tasksInSameCategory.length - 1) {
      return tasksInSameCategory[currentIndex + 1];
    }
    
    return null; // No next task in the same category
  };

  // Submit evaluation mutation
  const submitEvaluation = useMutation({
    mutationFn: async (data: TaskEvaluationFormValues) => {
      return await apiRequest(
        evaluation ? 'PUT' : 'POST',
        `/api/reviews/${reviewId}/tasks/${taskId}/evaluation`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/tasks/${taskId}/evaluation`] });
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}`] });
      
      // Find next task in the same category
      const nextTask = findNextTask();
      const currentTaskData = tasksData?.tasks?.find(t => t.id === taskId);
      const currentCategoryId = currentTaskData?.cuj?.categoryId;
      const currentCategory = currentTaskData?.cuj?.category?.name || "this category";
      
      // Show appropriate toast message based on what's happening next
      if (nextTask) {
        toast({
          title: "✅ Evaluation Saved",
          description: `Your evaluation has been saved. Moving to the next task in ${currentCategory}.`,
          variant: "default",
          className: "bg-green-100 text-green-900 border-green-500 border font-medium",
        });
        
        // Navigate to the next task after a small delay
        setTimeout(() => {
          setLocation(`/reviews/${reviewId}/tasks/${nextTask.id}?category=${nextTask.cuj?.categoryId || ''}`);
        }, 300);
      } else {
        toast({
          title: "🎉 Category Complete!",
          description: `You've completed all tasks in ${currentCategory}. Returning to review summary.`,
          variant: "default",
          className: "bg-blue-100 text-blue-900 border-blue-500 border font-medium",
        });
        
        // Return to review page with the current category expanded
        setTimeout(() => {
          setLocation(`/reviews/${reviewId}${currentCategoryId ? `?expandCategory=${currentCategoryId}` : ''}`);
        }, 300);
      }
    },
    onError: (error) => {
      toast({
        title: "Error Saving Evaluation",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Save as draft (same as submit but stay on page)
  const saveDraft = useMutation({
    mutationFn: async (data: TaskEvaluationFormValues) => {
      return await apiRequest(
        evaluation ? 'PUT' : 'POST',
        `/api/reviews/${reviewId}/tasks/${taskId}/evaluation`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/tasks/${taskId}/evaluation`] });
      
      toast({
        title: "Draft Saved",
        description: "Your task evaluation draft has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Saving Draft",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = async (data: TaskEvaluationFormValues) => {
    setSubmitting(true);
    try {
      await submitEvaluation.mutateAsync(data);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle save as draft
  const handleSaveAsDraft = () => {
    const data = form.getValues();
    saveDraft.mutate(data);
  };
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-medium text-foreground">Loading Task Evaluation...</h2>
        </div>
        <div className="space-y-4">
          <Card className="animate-pulse">
            <CardContent className="p-4 space-y-2">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  if (!task) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => setLocation(`/reviews/${reviewId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-medium text-foreground">Task Not Found</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-destructive">Error loading task</h3>
            <p className="text-muted-foreground mt-2">
              The requested task could not be found or there was an error loading data.
            </p>
            <Button className="mt-4" onClick={() => setLocation(`/reviews/${reviewId}`)}>
              Back to Review
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create a unique key for the task to use with the transition
  const taskKey = `task-${taskId}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-2" onClick={() => setLocation(`/reviews/${reviewId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-medium text-foreground">Task Evaluation</h2>
      </div>
      
      <TransitionGroup component={null}>
        <CSSTransition
          key={taskKey}
          nodeRef={nodeRef}
          timeout={300}
          classNames="task-slide"
        >
          <div ref={nodeRef}>
            <Card className="mb-6">
              <CardContent className="p-4">
                <h3 className="font-medium text-lg">{task.name}</h3>
                <div className="text-sm text-muted-foreground mt-2">
                  {task.prerequisites && (
                    <p><span className="font-medium">Prerequisites:</span> {task.prerequisites}</p>
                  )}
                  <p className="mt-1"><span className="font-medium">Expected Outcome:</span> {task.expectedOutcome}</p>
                </div>
                
                {/* Task progress indicator */}
                {tasksData && tasksData.tasks && task.cuj?.categoryId && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Category Progress</h4>
                      {(() => {
                        const categoryTasks = tasksData.tasks.filter(t => 
                          t.cuj?.categoryId === task.cuj?.categoryId
                        );
                        const completedCount = categoryTasks.filter(t => 
                          tasksData.completedTaskIds.includes(t.id)
                        ).length;
                        const totalCount = categoryTasks.length;
                        const currentPosition = categoryTasks.findIndex(t => t.id === task.id) + 1;
                        
                        return (
                          <span className="text-xs text-muted-foreground">
                            Task {currentPosition} of {totalCount} in {task.cuj?.category?.name || "this category"}
                          </span>
                        );
                      })()}
                    </div>
                    
                    {(() => {
                      const categoryTasks = tasksData.tasks.filter(t => 
                        t.cuj?.categoryId === task.cuj?.categoryId
                      );
                      const completedCount = categoryTasks.filter(t => 
                        tasksData.completedTaskIds.includes(t.id)
                      ).length;
                      const totalCount = categoryTasks.length;
                      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                      
                      return <Progress value={progress} className="h-2" />;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Doable Question */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium">Task Doable</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Was the task able to be completed as expected?
                    </p>
                    
                    <FormField
                      control={form.control}
                      name="doable"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup 
                              onValueChange={(value) => field.onChange(value === 'true')} 
                              defaultValue={field.value ? 'true' : 'false'}
                              className="flex space-x-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="doable-yes" />
                                <label htmlFor="doable-yes">Yes</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="doable-no" />
                                <label htmlFor="doable-no">No</label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Conditional feedback field for non-doable tasks */}
                    {!watchDoable && (
                      <div className="mt-4 border-t pt-4 border-gray-100">
                        <FormField
                          control={form.control}
                          name="undoableReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <div className="text-sm font-medium text-destructive">How come this task wasn't doable?</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Please explain why the task couldn't be completed and provide evidence below
                                </div>
                              </FormLabel>
                              <FormControl>
                                <textarea 
                                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="Explain what went wrong..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Usability Question */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium">Usability & Interaction</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Rate how easy and intuitive it was to complete this task.
                    </p>
                    
                    <FormField
                      control={form.control}
                      name="usabilityScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex flex-col space-y-8">
                              <div className="grid grid-cols-4 w-full">
                                {Object.entries(scoringScaleDescriptions.usability).map(([value, { label }]) => (
                                  <div key={value} className="flex flex-col items-center justify-center">
                                    <span className="font-medium text-sm">{label}</span>
                                    <span className="text-xs">{value}</span>
                                  </div>
                                ))}
                              </div>
                              <RadioGroup 
                                onValueChange={(value) => field.onChange(Number(value))} 
                                defaultValue={field.value?.toString()}
                                className="grid grid-cols-4 w-full gap-4"
                              >
                                {Object.entries(scoringScaleDescriptions.usability).map(([value, { label, description }]) => (
                                  <div key={value} className="flex flex-col items-center justify-center">
                                    <div className="flex justify-center">
                                      <RadioGroupItem value={value} id={`usability-${value}`} 
                                        className={`w-10 h-10 rounded-full border-2 ${
                                          Number(value) === 1 ? 'border-score-poor bg-score-poor/20' : 
                                          Number(value) === 2 ? 'border-score-fair bg-score-fair/20' : 
                                          Number(value) === 3 ? 'border-score-good bg-score-good/20' : 
                                          'border-score-excellent bg-score-excellent/20'
                                        }`} 
                                      />
                                    </div>
                                    <div className="mt-2 text-center px-2">
                                      <p className="text-xs text-muted-foreground">{description}</p>
                                    </div>
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Conditional feedback field for low usability scores */}
                    {watchDoable && watchUsabilityScore !== undefined && watchUsabilityScore <= 2 && (
                      <div className="mt-4 border-t pt-4 border-gray-100">
                        <FormField
                          control={form.control}
                          name="usabilityFeedback"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <div className="text-sm font-medium text-amber-700">What made this difficult to use?</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Please explain the issues with usability and provide evidence below
                                </div>
                              </FormLabel>
                              <FormControl>
                                <textarea 
                                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="Describe the usability issues..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Visuals Question */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium">Visual Design</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Rate the visual design and aesthetics of this feature.
                    </p>
                    
                    <FormField
                      control={form.control}
                      name="visualsScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex flex-col space-y-8">
                              <div className="grid grid-cols-4 w-full">
                                {Object.entries(scoringScaleDescriptions.visuals).map(([value, { label }]) => (
                                  <div key={value} className="flex flex-col items-center justify-center">
                                    <span className="font-medium text-sm">{label}</span>
                                    <span className="text-xs">{value}</span>
                                  </div>
                                ))}
                              </div>
                              <RadioGroup 
                                onValueChange={(value) => field.onChange(Number(value))} 
                                defaultValue={field.value?.toString()}
                                className="grid grid-cols-4 w-full gap-4"
                              >
                                {Object.entries(scoringScaleDescriptions.visuals).map(([value, { label, description }]) => (
                                  <div key={value} className="flex flex-col items-center justify-center">
                                    <div className="flex justify-center">
                                      <RadioGroupItem value={value} id={`visuals-${value}`} 
                                        className={`w-10 h-10 rounded-full border-2 ${
                                          Number(value) === 1 ? 'border-score-poor bg-score-poor/20' : 
                                          Number(value) === 2 ? 'border-score-fair bg-score-fair/20' : 
                                          Number(value) === 3 ? 'border-score-good bg-score-good/20' : 
                                          'border-score-excellent bg-score-excellent/20'
                                        }`} 
                                      />
                                    </div>
                                    <div className="mt-2 text-center px-2">
                                      <p className="text-xs text-muted-foreground">{description}</p>
                                    </div>
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Conditional feedback field for low visuals scores */}
                    {watchDoable && watchVisualsScore !== undefined && watchVisualsScore <= 2 && (
                      <div className="mt-4 border-t pt-4 border-gray-100">
                        <FormField
                          control={form.control}
                          name="visualsFeedback"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <div className="text-sm font-medium text-amber-700">What visual issues did you notice?</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Please explain the problems with the visual design and provide evidence below
                                </div>
                              </FormLabel>
                              <FormControl>
                                <textarea 
                                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="Describe the visual issues..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Media Capture */}
                <FormField
                  control={form.control}
                  name="media"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MediaCapture
                          media={field.value || []}
                          onChange={field.onChange}
                          maxItems={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleSaveAsDraft}
                    disabled={submitting || saveDraft.isPending}
                  >
                    {saveDraft.isPending ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting || submitEvaluation.isPending}
                  >
                    {submitEvaluation.isPending ? "Submitting..." : "Submit Evaluation"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CSSTransition>
      </TransitionGroup>
    </div>
  );
}
