import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ScoringConfig, 
  CujCategory,
  Cuj,
  Task,
  TaskWithCategory,
  CujDatabaseVersion,
  ReviewerAssignmentWithDetails,
  User,
  Car
} from "@shared/schema";
import { 
  Loader2, 
  RefreshCw, 
  FileText, 
  Layers, 
  FolderTree,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Database,
  Upload,
  PlusCircle,
  Trash,
  UserCheck,
  X,
  AlertTriangle
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for data table searches and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("config");
  
  // State for tracking if weights have been changed
  const [taskWeightsChanged, setTaskWeightsChanged] = useState(false);
  const [categoryWeightsChanged, setCategoryWeightsChanged] = useState(false);
  
  // State for reviewer assignment management
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    reviewerId: 0,
    carId: 0,
    categoryId: 0
  });
  const [existingAssignment, setExistingAssignment] = useState<ReviewerAssignmentWithDetails | null>(null);
  
  // Fetch current scoring configuration
  const { data: config, isLoading: isLoadingConfig } = useQuery<ScoringConfig>({
    queryKey: ['/api/admin/scoring-config'],
  });
  
  // Fetch CUJ data sync status
  const { data: cujSyncStatus, isLoading: isLoadingCujStatus } = useQuery<{ lastSync: string; status: string }>({
    queryKey: ['/api/admin/cuj-sync-status'],
  });
  
  // Fetch CUJ database versions
  const { data: cujDatabaseVersions, isLoading: isLoadingVersions } = useQuery<CujDatabaseVersion[]>({
    queryKey: ['/api/cuj-database-versions'],
  });
  
  // Fetch active CUJ database version
  const { data: activeCujDatabaseVersion, isLoading: isLoadingActiveVersion } = useQuery<CujDatabaseVersion>({
    queryKey: ['/api/cuj-database-versions/active'],
  });
  
  // Fetch CUJ categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery<CujCategory[]>({
    queryKey: ['/api/cuj-categories'],
  });
  
  // Fetch CUJs
  const { data: cujs, isLoading: isLoadingCujs } = useQuery<Cuj[]>({
    queryKey: ['/api/cujs'],
  });
  
  // Fetch Tasks
  const { data: tasks, isLoading: isLoadingTasks } = useQuery<TaskWithCategory[]>({
    queryKey: ['/api/tasks'],
  });
  
  // Fetch Users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  // Fetch Cars
  const { data: cars, isLoading: isLoadingCars } = useQuery<Car[]>({
    queryKey: ['/api/cars'],
  });
  
  // Fetch Reviewer Assignments
  const { data: reviewerAssignments, isLoading: isLoadingAssignments } = useQuery<ReviewerAssignmentWithDetails[]>({
    queryKey: ['/api/reviewer-assignments'],
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
  useEffect(() => {
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
  }, [config]);
  
  // Update task weights
  const updateTaskWeights = useMutation({
    mutationFn: async (weights: typeof taskLevelWeights) => {
      return await apiRequest('/api/admin/scoring-config/task', {
        method: 'PATCH',
        body: JSON.stringify(weights)
      });
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
      return await apiRequest('/api/admin/scoring-config/category', {
        method: 'PATCH',
        body: JSON.stringify(weights)
      });
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
  
  // Create reviewer assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignment: { reviewerId: number; carId: number; categoryId: number }) => {
      return await apiRequest('/api/reviewer-assignments', {
        method: 'POST',
        body: JSON.stringify(assignment)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviewer-assignments'] });
      toast({
        title: "Assignment Created",
        description: "Reviewer assignment has been successfully created.",
      });
      setIsCreateAssignmentOpen(false);
      setNewAssignment({ reviewerId: 0, carId: 0, categoryId: 0 });
    },
    onError: (error) => {
      toast({
        title: "Error Creating Assignment",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Delete reviewer assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return await apiRequest(`/api/reviewer-assignments/${assignmentId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviewer-assignments'] });
      toast({
        title: "Assignment Removed",
        description: "Reviewer assignment has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Removing Assignment",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Sync CUJ data mutation
  const syncCujData = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/sync-cuj-data', {
        method: 'POST',
        body: JSON.stringify({})
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cuj-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cuj-database-versions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cuj-database-versions/active'] });
      
      toast({
        title: "CUJ Data Synced",
        description: `Critical User Journey data has been successfully updated. Version ${data?.versionId ? `#${data.versionId}` : ''} created.`,
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
  
  // Set active CUJ database version mutation
  const setActiveCujDatabaseVersion = useMutation({
    mutationFn: async (versionId: number) => {
      return await apiRequest(`/api/cuj-database-versions/${versionId}/activate`, {
        method: 'POST',
        body: JSON.stringify({})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cuj-database-versions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cuj-database-versions/active'] });
      toast({
        title: "Version Activated",
        description: "This CUJ database version is now active for new reviews.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Activating Version",
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
  
  // Handle set active CUJ database version
  const handleSetActiveCujDatabaseVersion = (versionId: number) => {
    setActiveCujDatabaseVersion.mutate(versionId);
  };
  
  // Handle creating a new reviewer assignment
  const handleCreateAssignment = () => {
    if (newAssignment.reviewerId <= 0 || newAssignment.carId <= 0 || newAssignment.categoryId <= 0) {
      toast({
        title: "Validation Error",
        description: "Please select a reviewer, car, and CUJ category for the assignment.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if an assignment already exists
    const existingAssignment = reviewerAssignments?.find(
      a => a.reviewerId === newAssignment.reviewerId && 
           a.carId === newAssignment.carId && 
           a.categoryId === newAssignment.categoryId
    );
    
    if (existingAssignment) {
      toast({
        title: "Assignment Already Exists",
        description: "This reviewer is already assigned to this car and CUJ category.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if the category is already assigned to a different reviewer for this car
    const conflictingAssignment = reviewerAssignments?.find(
      a => a.carId === newAssignment.carId && 
           a.categoryId === newAssignment.categoryId &&
           a.reviewerId !== newAssignment.reviewerId
    );
    
    if (conflictingAssignment) {
      const reviewer = users?.find(u => u.id === conflictingAssignment.reviewerId);
      toast({
        title: "Category Already Assigned",
        description: `This category for this car is already assigned to ${reviewer?.name || 'another reviewer'}. Please remove that assignment first or select a different category.`,
        variant: "destructive",
      });
      return;
    }
    
    createAssignmentMutation.mutate(newAssignment);
  };
  
  // State for delete assignment confirmation dialog
  const [isDeleteAssignmentOpen, setIsDeleteAssignmentOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<ReviewerAssignmentWithDetails | null>(null);

  // Handle showing delete confirmation dialog
  const handleShowDeleteDialog = (assignment: ReviewerAssignmentWithDetails) => {
    setAssignmentToDelete(assignment);
    setIsDeleteAssignmentOpen(true);
  };
  
  // Handle deleting a reviewer assignment
  const handleDeleteAssignment = () => {
    if (!assignmentToDelete) return;
    
    deleteAssignmentMutation.mutate(assignmentToDelete.id);
    setIsDeleteAssignmentOpen(false);
    setAssignmentToDelete(null);
  };
  
  // Filter tasks by category
  const getTasksByCategory = (categoryId: number) => {
    if (!tasks) return [];
    return tasks.filter(task => task.cuj.category.id === categoryId);
  };
  
  // Filter function for search
  const filterBySearchTerm = (item: any) => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(searchLower) || 
           (item.description && item.description.toLowerCase().includes(searchLower));
  };
  
  // Show loading state
  if (isLoadingConfig || isLoadingCujStatus || isLoadingCategories || isLoadingCujs || isLoadingTasks || isLoadingVersions || isLoadingActiveVersion) {
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
        <h2 className="text-2xl font-medium text-foreground">Admin Dashboard</h2>
        <p className="text-muted-foreground mt-1">Manage configuration and view CUJ data.</p>
      </div>
      
      {/* Delete Assignment Confirmation Dialog */}
      <Dialog open={isDeleteAssignmentOpen} onOpenChange={setIsDeleteAssignmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reviewer assignment?
            </DialogDescription>
          </DialogHeader>
          
          {assignmentToDelete && (
            <div className="py-4">
              <div className="space-y-2">
                <div className="bg-muted p-3 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-sm font-medium">Reviewer</div>
                      <div className="text-sm">{assignmentToDelete.reviewer.name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Car</div>
                      <div className="text-sm">{assignmentToDelete.car.make} {assignmentToDelete.car.model}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm font-medium">Category</div>
                      <div className="text-sm">{assignmentToDelete.category.name}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div className="text-sm">
                      <strong>Warning:</strong> Deleting this assignment will remove the reviewer's access to evaluate this CUJ category for this car. Any existing evaluations will remain but can no longer be modified by this reviewer.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteAssignmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAssignment}
              disabled={deleteAssignmentMutation.isPending}
            >
              {deleteAssignmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Assignment Dialog */}
      <Dialog open={isCreateAssignmentOpen} onOpenChange={setIsCreateAssignmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Reviewer Assignment</DialogTitle>
            <DialogDescription>
              Assign a reviewer to evaluate a specific CUJ category for a car.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select 
                value={newAssignment.reviewerId.toString()}
                onValueChange={(value) => setNewAssignment({...newAssignment, reviewerId: parseInt(value)})}
              >
                <SelectTrigger id="reviewer">
                  <SelectValue placeholder="Select a reviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select a reviewer</SelectItem>
                  {users?.filter(user => user.role === 'reviewer').map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="car">Car</Label>
              <Select 
                value={newAssignment.carId.toString()}
                onValueChange={(value) => setNewAssignment({...newAssignment, carId: parseInt(value)})}
              >
                <SelectTrigger id="car">
                  <SelectValue placeholder="Select a car" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select a car</SelectItem>
                  {cars?.map(car => (
                    <SelectItem key={car.id} value={car.id.toString()}>
                      {car.make} {car.model} ({car.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">CUJ Category</Label>
              <Select 
                value={newAssignment.categoryId.toString()}
                onValueChange={(value) => setNewAssignment({...newAssignment, categoryId: parseInt(value)})}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select a category</SelectItem>
                  {categories?.map(category => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Warning about existing assignments */}
            {newAssignment.carId > 0 && newAssignment.categoryId > 0 && reviewerAssignments?.some(
              a => a.carId === newAssignment.carId && a.categoryId === newAssignment.categoryId
            ) && (
              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md border border-amber-200 dark:border-amber-800 mt-4">
                <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong>Warning:</strong> This category is already assigned to another reviewer for this car. Creating a new assignment will replace the existing one.
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex space-x-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateAssignmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateAssignment}
              disabled={createAssignmentMutation.isPending}
            >
              {createAssignmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Create Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="assignments">Reviewer Assignments</TabsTrigger>
          <TabsTrigger value="data">CUJ Data Tables</TabsTrigger>
        </TabsList>
        
        <TabsContent value="assignments" className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Reviewer Assignments</h3>
              <Button 
                onClick={() => setIsCreateAssignmentOpen(true)}
                className="flex items-center"
              >
                <PlusCircle className="mr-1 h-4 w-4" />
                Create Assignment
              </Button>
            </div>
            
            {isLoadingUsers || isLoadingCars || isLoadingCategories || isLoadingAssignments ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !reviewerAssignments || reviewerAssignments.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">No reviewer assignments have been created yet.</p>
                  <Button 
                    onClick={() => setIsCreateAssignmentOpen(true)}
                    variant="outline"
                    className="mx-auto"
                  >
                    <PlusCircle className="mr-1 h-4 w-4" />
                    Create Your First Assignment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-medium">Current Assignments</h4>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Search assignments"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>Car</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewerAssignments
                        .filter(assignment => {
                          if (!searchTerm) return true;
                          const searchLower = searchTerm.toLowerCase();
                          return (
                            assignment.reviewer.name.toLowerCase().includes(searchLower) ||
                            assignment.car.make.toLowerCase().includes(searchLower) ||
                            assignment.car.model.toLowerCase().includes(searchLower) ||
                            assignment.category.name.toLowerCase().includes(searchLower)
                          );
                        })
                        .map(assignment => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="font-medium">{assignment.reviewer.name}</div>
                              <div className="text-xs text-muted-foreground">{assignment.reviewer.role}</div>
                            </TableCell>
                            <TableCell>
                              <div>{assignment.car.make} {assignment.car.model}</div>
                              <div className="text-xs text-muted-foreground">{assignment.car.year}</div>
                            </TableCell>
                            <TableCell>
                              <div>{assignment.category.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{formatDateTime(assignment.createdAt)}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleShowDeleteDialog(assignment)}
                                disabled={deleteAssignmentMutation.isPending}
                              >
                                {deleteAssignmentMutation.isPending && assignmentToDelete?.id === assignment.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="config" className="space-y-6 mt-6">
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

                <div className="flex items-center justify-between mb-6">
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
                
                {/* CUJ Database Versions */}
                <div>
                  <h4 className="text-base font-medium mb-3 flex items-center">
                    <Database className="h-4 w-4 mr-1" />
                    CUJ Database Versions
                  </h4>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-32 text-center">Status</TableHead>
                          <TableHead className="w-32 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cujDatabaseVersions && cujDatabaseVersions.length > 0 ? (
                          cujDatabaseVersions.map((version) => {
                            const isActive = activeCujDatabaseVersion?.id === version.id;
                            return (
                              <TableRow key={version.id} className={isActive ? "bg-primary/5" : ""}>
                                <TableCell className="font-mono">{version.id}</TableCell>
                                <TableCell className="font-medium">{version.versionNumber}</TableCell>
                                <TableCell>{version.sourceType}{version.sourceFileName ? `: ${version.sourceFileName}` : ''}</TableCell>
                                <TableCell>{formatDateTime(version.createdAt)}</TableCell>
                                <TableCell className="text-center">
                                  {isActive ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                      Inactive
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {!isActive && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSetActiveCujDatabaseVersion(version.id)}
                                      disabled={setActiveCujDatabaseVersion.isPending}
                                      className="text-xs"
                                    >
                                      {setActiveCujDatabaseVersion.isPending ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Setting...
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="h-3 w-3 mr-1" />
                                          Set Active
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                              No database versions found. Click "Sync Now" to create a new version.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="assignments" className="mt-6">
          <div className="space-y-6">
            {/* Current Assignments */}
            <Card className="overflow-hidden">
              <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-lg text-primary">Current Reviewer Assignments</h3>
                <Button 
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    // Open the create assignment dialog
                    setIsCreateAssignmentOpen(true);
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>New Assignment</span>
                </Button>
              </div>
              
              <CardContent className="p-4">
                {isLoadingAssignments || isLoadingUsers || isLoadingCars || isLoadingCategories ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : reviewerAssignments?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No reviewer assignments have been made yet.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setIsCreateAssignmentOpen(true)}
                    >
                      <PlusCircle className="mr-1 h-4 w-4" />
                      Create your first assignment
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reviewer</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead>CUJ Category</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviewerAssignments?.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="font-medium">{assignment.reviewer.name}</div>
                              <div className="text-xs text-muted-foreground">{assignment.reviewer.username}</div>
                            </TableCell>
                            <TableCell>
                              <div>{assignment.car.make} {assignment.car.model}</div>
                              <div className="text-xs text-muted-foreground">{assignment.car.year}</div>
                            </TableCell>
                            <TableCell>{assignment.category.name}</TableCell>
                            <TableCell>
                              {formatDateTime(assignment.createdAt)}
                              {assignment.createdByUser && (
                                <div className="text-xs text-muted-foreground">
                                  by {assignment.createdByUser.name}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteAssignment(assignment.id)}
                                disabled={deleteAssignmentMutation.isPending}
                              >
                                {deleteAssignmentMutation.isPending && deleteAssignmentMutation.variables === assignment.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash className="h-3 w-3 mr-1" />
                                )}
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="data" className="mt-6">
          <div className="flex mb-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search CUJs, tasks, or categories..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        
          {/* Categories Table */}
          <Card className="mb-6 overflow-hidden">
            <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200 flex items-center">
              <FolderTree className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-medium text-lg text-primary">Categories</h3>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Icon</TableHead>
                    <TableHead className="w-24 text-right">Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.filter(filterBySearchTerm).map((category) => {
                    const categoryTasks = getTasksByCategory(category.id);
                    return (
                      <TableRow key={category.id}>
                        <TableCell className="font-mono">{category.id}</TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell>{category.icon || "-"}</TableCell>
                        <TableCell className="text-right">{categoryTasks.length}</TableCell>
                      </TableRow>
                    );
                  })}
                  {categories?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No categories found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          {/* CUJs Table */}
          <Card className="mb-6 overflow-hidden">
            <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200 flex items-center">
              <Layers className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-medium text-lg text-primary">Critical User Journeys</h3>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24 text-right">Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cujs?.filter(filterBySearchTerm).map((cuj) => {
                    const cujCategory = categories?.find(cat => cat.id === cuj.categoryId);
                    const cujTasks = tasks?.filter(task => task.cuj.id === cuj.id) || [];
                    return (
                      <TableRow key={cuj.id}>
                        <TableCell className="font-mono">{cuj.id}</TableCell>
                        <TableCell className="font-medium">{cuj.name}</TableCell>
                        <TableCell>{cujCategory?.name || "-"}</TableCell>
                        <TableCell>{cuj.description || "-"}</TableCell>
                        <TableCell className="text-right">{cujTasks.length}</TableCell>
                      </TableRow>
                    );
                  })}
                  {cujs?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No CUJs found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          {/* Tasks Table */}
          <Card className="overflow-hidden">
            <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-medium text-lg text-primary">Tasks</h3>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>CUJ</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Prerequisites</TableHead>
                    <TableHead>Expected Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks?.filter(filterBySearchTerm).map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono">{task.id}</TableCell>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell>{task.cuj.name}</TableCell>
                      <TableCell>{task.cuj.category.name}</TableCell>
                      <TableCell>{task.prerequisites || "-"}</TableCell>
                      <TableCell>{task.expectedOutcome}</TableCell>
                    </TableRow>
                  ))}
                  {tasks?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No tasks found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}