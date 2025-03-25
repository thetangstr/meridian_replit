import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ScoringConfig } from "@shared/schema";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for tracking if weights have been changed
  const [taskWeightsChanged, setTaskWeightsChanged] = useState(false);
  const [categoryWeightsChanged, setCategoryWeightsChanged] = useState(false);
  
  // Fetch current scoring configuration
  const { data: config, isLoading: isLoadingConfig } = useQuery<ScoringConfig>({
    queryKey: ['/api/admin/scoring-config'],
  });
  
  // Fetch CUJ data sync status
  const { data: cujSyncStatus, isLoading: isLoadingCujStatus } = useQuery<{ lastSync: string; status: string }>({
    queryKey: ['/api/admin/cuj-sync-status'],
  });
  
  // State for task level weights
  const [taskLevelWeights, setTaskLevelWeights] = useState({
    doableWeight: 0,
    usabilityWeight: 0,
    visualsWeight: 0
  });
  
  // State for category level weights
  const [categoryLevelWeights, setCategoryLevelWeights] = useState({
    taskAvgWeight: 0,
    responsivenessWeight: 0,
    writingWeight: 0,
    emotionalWeight: 0
  });
  
  // Set initial weights when data is loaded
  useState(() => {
    if (config) {
      setTaskLevelWeights({
        doableWeight: config.taskDoableWeight,
        usabilityWeight: config.taskUsabilityWeight,
        visualsWeight: config.taskVisualsWeight
      });
      
      setCategoryLevelWeights({
        taskAvgWeight: config.categoryTasksWeight,
        responsivenessWeight: config.categoryResponsivenessWeight,
        writingWeight: config.categoryWritingWeight,
        emotionalWeight: config.categoryEmotionalWeight
      });
    }
  });
  
  // Update task weights
  const updateTaskWeights = useMutation({
    mutationFn: async (weights: typeof taskLevelWeights) => {
      return await apiRequest('PATCH', '/api/admin/scoring-config/task', weights);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/scoring-config'] });
      toast({
        title: "Task Weights Updated",
        description: "Task level scoring weights have been successfully updated.",
      });
      setTaskWeightsChanged(false);
    },
    onError: (error) => {
      toast({
        title: "Error Updating Weights",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Update category weights
  const updateCategoryWeights = useMutation({
    mutationFn: async (weights: typeof categoryLevelWeights) => {
      return await apiRequest('PATCH', '/api/admin/scoring-config/category', weights);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/scoring-config'] });
      toast({
        title: "Category Weights Updated",
        description: "Category level scoring weights have been successfully updated.",
      });
      setCategoryWeightsChanged(false);
    },
    onError: (error) => {
      toast({
        title: "Error Updating Weights",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Sync CUJ data mutation
  const syncCujData = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/sync-cuj-data', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cuj-sync-status'] });
      toast({
        title: "CUJ Data Synced",
        description: "Critical User Journey data has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Syncing CUJ Data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handle task weight changes
  const handleTaskWeightChange = (field: keyof typeof taskLevelWeights, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setTaskLevelWeights(prev => ({ ...prev, [field]: numValue }));
      setTaskWeightsChanged(true);
    }
  };
  
  // Handle category weight changes
  const handleCategoryWeightChange = (field: keyof typeof categoryLevelWeights, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setCategoryLevelWeights(prev => ({ ...prev, [field]: numValue }));
      setCategoryWeightsChanged(true);
    }
  };
  
  // Save task configuration
  const handleSaveTaskConfig = () => {
    updateTaskWeights.mutate(taskLevelWeights);
  };
  
  // Save category configuration
  const handleSaveCategoryConfig = () => {
    updateCategoryWeights.mutate(categoryLevelWeights);
  };
  
  // Handle CUJ data sync
  const handleSyncCujData = () => {
    syncCujData.mutate();
  };
  
  // Show loading state
  if (isLoadingConfig || isLoadingCujStatus) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-foreground">Admin Configuration</h2>
          <p className="text-muted-foreground mt-1">Loading configuration settings...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (!config) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-foreground">Admin Configuration</h2>
          <p className="text-muted-foreground mt-1">Error loading configuration</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-destructive">Configuration Error</h3>
            <p className="text-muted-foreground mt-2">
              There was an error loading the scoring configuration. Please try refreshing the page.
            </p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/scoring-config'] })}
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-medium text-foreground">Admin Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure scoring parameters and weights for the evaluation system.</p>
      </div>

      <div className="space-y-6">
        {/* Task Score Configuration */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200">
            <h3 className="font-medium text-lg text-primary">Task Level Scoring</h3>
          </div>
          
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="doableWeight" className="block text-sm font-medium mb-1">Doable Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="doableWeight"
                    type="number"
                    value={taskLevelWeights.doableWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleTaskWeightChange('doableWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                  <div className="ml-4 text-sm text-muted-foreground">
                    If "Yes" = full score, "No" = 0 points
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="usabilityWeight" className="block text-sm font-medium mb-1">Usability & Interaction Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="usabilityWeight"
                    type="number"
                    value={taskLevelWeights.usabilityWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleTaskWeightChange('usabilityWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="visualsWeight" className="block text-sm font-medium mb-1">Visuals Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="visualsWeight"
                    type="number"
                    value={taskLevelWeights.visualsWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleTaskWeightChange('visualsWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveTaskConfig}
                disabled={!taskWeightsChanged || updateTaskWeights.isPending}
              >
                {updateTaskWeights.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Category Score Configuration */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200">
            <h3 className="font-medium text-lg text-primary">Category Level Scoring</h3>
          </div>
          
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="taskAvgWeight" className="block text-sm font-medium mb-1">Task Average Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="taskAvgWeight"
                    type="number"
                    value={categoryLevelWeights.taskAvgWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleCategoryWeightChange('taskAvgWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                  <div className="ml-4 text-sm text-muted-foreground">
                    Average of all task scores in the category
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="responsivenessWeight" className="block text-sm font-medium mb-1">System Feedback & Responsiveness Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="responsivenessWeight"
                    type="number"
                    value={categoryLevelWeights.responsivenessWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleCategoryWeightChange('responsivenessWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="writingWeight" className="block text-sm font-medium mb-1">Writing Weight</Label>
                <div className="flex items-center">
                  <Input
                    id="writingWeight"
                    type="number"
                    value={categoryLevelWeights.writingWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleCategoryWeightChange('writingWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="emotionalWeight" className="block text-sm font-medium mb-1">Emotional Weight (Bonus)</Label>
                <div className="flex items-center">
                  <Input
                    id="emotionalWeight"
                    type="number"
                    value={categoryLevelWeights.emotionalWeight}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    onChange={(e) => handleCategoryWeightChange('emotionalWeight', e.target.value)}
                  />
                  <span className="ml-2">%</span>
                  <div className="ml-4 text-sm text-muted-foreground">
                    Bonus points that won't decrease the score
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveCategoryConfig}
                disabled={!categoryWeightsChanged || updateCategoryWeights.isPending}
              >
                {updateCategoryWeights.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CUJ Data Management */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200">
            <h3 className="font-medium text-lg text-primary">CUJ Data Management</h3>
          </div>
          
          <CardContent className="p-4">
            <div className="mb-4">
              <p className="text-muted-foreground">Update the master CUJ data from external source.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                {cujSyncStatus && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      Last updated: {formatDateTime(cujSyncStatus.lastSync)}
                    </div>
                    <div className={`text-sm ${cujSyncStatus.status === 'up_to_date' ? 'text-accent' : 'text-warning'} mt-1`}>
                      {cujSyncStatus.status === 'up_to_date' 
                        ? 'Data is up to date' 
                        : 'Updates available'}
                    </div>
                  </>
                )}
              </div>
              <Button 
                onClick={handleSyncCujData}
                disabled={syncCujData.isPending}
                className="flex items-center"
              >
                {syncCujData.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
