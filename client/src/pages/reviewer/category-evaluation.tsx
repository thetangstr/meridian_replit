import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  writingScore: z.number().min(1).max(4),
  emotionalScore: z.number().min(1).max(4),
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
      responsivenessScore: evaluation?.responsivenessScore ?? 3,
      writingScore: evaluation?.writingScore ?? 3,
      emotionalScore: evaluation?.emotionalScore ?? 3,
      media: evaluation?.media ?? [],
    },
  });
  
  // Submit evaluation mutation
  const submitEvaluation = useMutation({
    mutationFn: async (data: CategoryEvaluationFormValues) => {
      return await apiRequest(
        evaluation ? 'PUT' : 'POST',
        `/api/reviews/${reviewId}/categories/${categoryId}/evaluation`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/categories/${categoryId}/evaluation`] });
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
        evaluation ? 'PUT' : 'POST',
        `/api/reviews/${reviewId}/categories/${categoryId}/evaluation`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${reviewId}/categories/${categoryId}/evaluation`] });
      
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
                      <RadioGroup 
                        onValueChange={(value) => field.onChange(Number(value))} 
                        defaultValue={field.value?.toString()}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        {Object.entries(scoringScaleDescriptions.responsiveness).map(([value, { label, description }]) => (
                          <div key={value} className="flex items-center border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                            <RadioGroupItem value={value} id={`responsiveness-${value}`} className="mr-3" />
                            <label htmlFor={`responsiveness-${value}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center">
                                <div className={`w-5 h-5 rounded-full ${Number(value) === 1 ? 'bg-score-poor' : Number(value) === 2 ? 'bg-score-fair' : Number(value) === 3 ? 'bg-score-good' : 'bg-score-excellent'} flex items-center justify-center mr-2`}></div>
                                <span className="font-medium">{label}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{description}</p>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <RadioGroup 
                        onValueChange={(value) => field.onChange(Number(value))} 
                        defaultValue={field.value?.toString()}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        {Object.entries(scoringScaleDescriptions.writing).map(([value, { label, description }]) => (
                          <div key={value} className="flex items-center border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                            <RadioGroupItem value={value} id={`writing-${value}`} className="mr-3" />
                            <label htmlFor={`writing-${value}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center">
                                <div className={`w-5 h-5 rounded-full ${Number(value) === 1 ? 'bg-score-poor' : Number(value) === 2 ? 'bg-score-fair' : Number(value) === 3 ? 'bg-score-good' : 'bg-score-excellent'} flex items-center justify-center mr-2`}></div>
                                <span className="font-medium">{label}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{description}</p>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <RadioGroup 
                        onValueChange={(value) => field.onChange(Number(value))} 
                        defaultValue={field.value?.toString()}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        {Object.entries(scoringScaleDescriptions.emotional).map(([value, { label, description }]) => (
                          <div key={value} className="flex items-center border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                            <RadioGroupItem value={value} id={`emotional-${value}`} className="mr-3" />
                            <label htmlFor={`emotional-${value}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center">
                                <div className={`w-5 h-5 rounded-full ${Number(value) === 1 ? 'bg-score-poor' : Number(value) === 2 ? 'bg-score-fair' : Number(value) === 3 ? 'bg-score-good' : 'bg-score-excellent'} flex items-center justify-center mr-2`}></div>
                                <span className="font-medium">{label}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{description}</p>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
