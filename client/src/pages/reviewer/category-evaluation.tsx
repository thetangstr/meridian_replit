import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { CujCategory, CategoryEvaluation, scoringScaleDescriptions } from "@shared/schema";
import { MediaCapture } from "@/components/ui/media-capture";
import { useToast } from "@/hooks/use-toast";

// Form validation schema
const categoryEvaluationSchema = z.object({
  responsivenessScore: z.number().min(1).max(4),
  responsivenessFeedback: z.string().optional(),
  writingScore: z.number().min(1).max(4),
  writingFeedback: z.string().optional(),
  emotionalScore: z.number().min(1).max(4),
  emotionalFeedback: z.string().optional(),
  media: z.any().optional(),
});

type CategoryEvaluationFormValues = z.infer<typeof categoryEvaluationSchema>;

export default function CategoryEvaluationPage() {
  const params = useParams();
  const reviewId = Number(params.reviewId);
  const categoryId = Number(params.categoryId);
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [submitting, setSubmitting] = useState(false);
  
  // Fetch category details
  const { data: category, isLoading: isLoadingCategory } = useQuery<CujCategory>({
    queryKey: [`/api/cuj-categories/${categoryId}`],
  });
  
  // Fetch existing evaluation if any
  const { data: evaluation, isLoading: isLoadingEvaluation } = useQuery<CategoryEvaluation>({
    queryKey: [`/api/reviews/${reviewId}/categories/${categoryId}/evaluation`],
  });
  
  const isLoading = isLoadingCategory || isLoadingEvaluation;
  
  // Setup form with existing data if available
  const form = useForm<CategoryEvaluationFormValues>({
    resolver: zodResolver(categoryEvaluationSchema),
    defaultValues: {
      responsivenessScore: evaluation?.responsivenessScore || undefined,
      responsivenessFeedback: evaluation?.responsivenessFeedback || '',
      writingScore: evaluation?.writingScore || undefined,
      writingFeedback: evaluation?.writingFeedback || '',
      emotionalScore: evaluation?.emotionalScore || undefined,
      emotionalFeedback: evaluation?.emotionalFeedback || '',
      media: evaluation?.media || [],
    },
  });
  
  // Watch form values for conditional rendering
  const watchResponsivenessScore = form.watch("responsivenessScore");
  const watchWritingScore = form.watch("writingScore");
  const watchEmotionalScore = form.watch("emotionalScore");
  
  // Submit evaluation mutation
  const submitEvaluation = useMutation({
    mutationFn: async (data: CategoryEvaluationFormValues) => {
      return await apiRequest(
        `/api/reviews/${reviewId}/categories/${categoryId}/evaluation`,
        {
          method: evaluation ? 'PUT' : 'POST',
          body: JSON.stringify(data)
        }
      );
    },
    onSuccess: () => {
      // Invalidate single category evaluation
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/categories/${categoryId}/evaluation`] });
      // Invalidate all category evaluations for this review
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/category-evaluations`] });
      // Invalidate review data
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}`] });
      
      toast({
        title: "Evaluation Saved",
        description: "Your category evaluation has been successfully saved.",
      });
      
      // Navigate back to review detail
      setLocation(`/reviews/${reviewId}`);
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
    mutationFn: async (data: CategoryEvaluationFormValues) => {
      return await apiRequest(
        `/api/reviews/${reviewId}/categories/${categoryId}/evaluation`,
        {
          method: evaluation ? 'PUT' : 'POST',
          body: JSON.stringify(data)
        }
      );
    },
    onSuccess: () => {
      // Invalidate single category evaluation
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/categories/${categoryId}/evaluation`] });
      // Invalidate all category evaluations for this review
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/category-evaluations`] });
      
      toast({
        title: "Draft Saved",
        description: "Your category evaluation draft has been saved.",
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
  const onSubmit = async (data: CategoryEvaluationFormValues) => {
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
          <h2 className="text-xl font-medium text-foreground">Loading Category Evaluation...</h2>
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
  
  if (!category) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => setLocation(`/reviews/${reviewId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-medium text-foreground">Category Not Found</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-destructive">Error loading category</h3>
            <p className="text-muted-foreground mt-2">
              The requested category could not be found or there was an error loading data.
            </p>
            <Button className="mt-4" onClick={() => setLocation(`/reviews/${reviewId}`)}>
              Back to Review
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-2" onClick={() => setLocation(`/reviews/${reviewId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-medium text-foreground">{category.name} Category Evaluation</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="font-medium text-lg">Category Overview</h3>
          <p className="text-sm text-muted-foreground mt-2">
            This evaluation covers the entire {category.name} category functionality. Please provide an overall assessment based on your experience with all the tasks in this category.
          </p>
        </CardContent>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* System Feedback Question */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium">System Feedback & Responsiveness</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Rate the system's performance and responsiveness for the entire category.
              </p>
              
              <FormField
                control={form.control}
                name="responsivenessScore"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col space-y-8">
                        <RadioGroup 
                          onValueChange={(value) => field.onChange(Number(value))} 
                          defaultValue={field.value ? field.value.toString() : undefined}
                          className="grid grid-cols-4 gap-2 w-full"
                        >
                          {Object.entries(scoringScaleDescriptions.responsiveness).map(([value, { label, description }]) => (
                            <div key={value} className="flex flex-col items-center">
                              <div className="text-center mb-2">
                                <span className="font-medium text-sm block">{label}</span>
                                <span className="text-xs block">{value}</span>
                              </div>
                              <RadioGroupItem value={value} id={`responsiveness-${value}`} 
                                className={`w-12 h-12 rounded-full border-2 ${
                                  Number(value) === 1 ? 'border-score-poor bg-score-poor/20' : 
                                  Number(value) === 2 ? 'border-score-fair bg-score-fair/20' : 
                                  Number(value) === 3 ? 'border-score-good bg-score-good/20' : 
                                  'border-score-excellent bg-score-excellent/20'
                                }`} 
                              />
                              <div className="mt-2 text-center">
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
              
              {/* Render feedback field if score is 1 or 2 */}
              {(watchResponsivenessScore === 1 || watchResponsivenessScore === 2) && (
                <FormField
                  control={form.control}
                  name="responsivenessFeedback"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Please provide details about the responsiveness issues</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the specific responsiveness issues you experienced..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Your feedback will help identify and address system performance issues.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
          
          {/* Writing Question */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium">Readability & Writing</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Rate the quality of text and language used in this category.
              </p>
              
              <FormField
                control={form.control}
                name="writingScore"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col space-y-8">
                        <RadioGroup 
                          onValueChange={(value) => field.onChange(Number(value))} 
                          defaultValue={field.value ? field.value.toString() : undefined}
                          className="grid grid-cols-4 gap-2 w-full"
                        >
                          {Object.entries(scoringScaleDescriptions.writing).map(([value, { label, description }]) => (
                            <div key={value} className="flex flex-col items-center">
                              <div className="text-center mb-2">
                                <span className="font-medium text-sm block">{label}</span>
                                <span className="text-xs block">{value}</span>
                              </div>
                              <RadioGroupItem value={value} id={`writing-${value}`} 
                                className={`w-12 h-12 rounded-full border-2 ${
                                  Number(value) === 1 ? 'border-score-poor bg-score-poor/20' : 
                                  Number(value) === 2 ? 'border-score-fair bg-score-fair/20' : 
                                  Number(value) === 3 ? 'border-score-good bg-score-good/20' : 
                                  'border-score-excellent bg-score-excellent/20'
                                }`} 
                              />
                              <div className="mt-2 text-center">
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
              
              {/* Render feedback field if score is 1 or 2 */}
              {(watchWritingScore === 1 || watchWritingScore === 2) && (
                <FormField
                  control={form.control}
                  name="writingFeedback"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Please provide details about the writing/text issues</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the specific writing, text, or language issues you found..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Your feedback will help improve the text quality and readability.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
          
          {/* Emotional Question */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium">Emotional Engagement (Bonus)</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Rate the emotional connection and satisfaction with this category.
              </p>
              
              <FormField
                control={form.control}
                name="emotionalScore"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col space-y-8">
                        <RadioGroup 
                          onValueChange={(value) => field.onChange(Number(value))} 
                          defaultValue={field.value ? field.value.toString() : undefined}
                          className="grid grid-cols-4 gap-2 w-full"
                        >
                          {Object.entries(scoringScaleDescriptions.emotional).map(([value, { label, description }]) => (
                            <div key={value} className="flex flex-col items-center">
                              <div className="text-center mb-2">
                                <span className="font-medium text-sm block">{label}</span>
                                <span className="text-xs block">{value}</span>
                              </div>
                              <RadioGroupItem value={value} id={`emotional-${value}`} 
                                className={`w-12 h-12 rounded-full border-2 ${
                                  Number(value) === 1 ? 'border-score-poor bg-score-poor/20' : 
                                  Number(value) === 2 ? 'border-score-fair bg-score-fair/20' : 
                                  Number(value) === 3 ? 'border-score-good bg-score-good/20' : 
                                  'border-score-excellent bg-score-excellent/20'
                                }`} 
                              />
                              <div className="mt-2 text-center">
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
              
              {/* Render feedback field if score is 1 or 2 */}
              {(watchEmotionalScore === 1 || watchEmotionalScore === 2) && (
                <FormField
                  control={form.control}
                  name="emotionalFeedback"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Please provide details about the emotional engagement issues</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe what aspects affected your emotional response or satisfaction..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Your feedback will help improve the overall user experience.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
  );
}
