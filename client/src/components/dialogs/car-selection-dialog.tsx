import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { BadgeCheck, Car as CarIcon, Plus } from "lucide-react";

interface CarSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCarSelected: (car: Car) => void;
}

export function CarSelectionDialog({
  open,
  onOpenChange,
  onCarSelected,
}: CarSelectionDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("existing");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state for new car
  const [newCar, setNewCar] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    androidVersion: "",
    buildFingerprint: "",
    location: "",
    imageUrl: "",
  });

  // Get existing cars
  const {
    data: cars = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/cars"],
    enabled: open,
  });

  // Create new car mutation
  const createCarMutation = useMutation({
    mutationFn: async (car: typeof newCar) => {
      return apiRequest<Car>("/api/cars", {
        method: "POST",
        body: JSON.stringify(car),
      });
    },
    onSuccess: (newCar) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      toast({
        title: "Car created",
        description: `Successfully created ${newCar.make} ${newCar.model}`,
      });
      onCarSelected(newCar);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error creating car",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  // Handle selecting a car
  const handleCarSelect = (car: Car) => {
    onCarSelected(car);
    onOpenChange(false);
  };

  // Handle creating a new car
  const handleCreateCar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCar.make || !newCar.model) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createCarMutation.mutate(newCar);
  };

  // Handle input changes for new car form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Special handling for year to ensure it's a number
    if (name === "year") {
      const yearNum = parseInt(value, 10);
      if (!isNaN(yearNum)) {
        setNewCar({ ...newCar, [name]: yearNum });
      }
    } else {
      setNewCar({ ...newCar, [name]: value });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select a Car for Review</DialogTitle>
          <DialogDescription>
            Choose an existing car or create a new one for this review.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="existing"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Cars</TabsTrigger>
            <TabsTrigger value="new">New Car</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <p>Loading cars...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-[300px] text-destructive">
                <p>Error loading cars</p>
              </div>
            ) : cars.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <p>No cars available</p>
                <Button onClick={() => setActiveTab("new")}>Create a new car</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2">
                {cars.map((car: Car) => (
                  <Card key={car.id} className="hover:border-primary transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">
                          {car.make} {car.model}
                        </h3>
                        <CarIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground">Year: {car.year}</p>
                      <p className="text-sm text-muted-foreground">
                        Android: {car.androidVersion}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Location: {car.location}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="default"
                        className="w-full flex gap-2"
                        onClick={() => handleCarSelect(car)}
                      >
                        <BadgeCheck className="h-4 w-4" />
                        Select
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new">
            <form onSubmit={handleCreateCar} className="space-y-4 p-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    name="make"
                    value={newCar.make}
                    onChange={handleInputChange}
                    placeholder="BMW, Mercedes, etc."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    name="model"
                    value={newCar.model}
                    onChange={handleInputChange}
                    placeholder="i7, S-Class, etc."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    value={newCar.year}
                    onChange={handleInputChange}
                    min={2000}
                    max={new Date().getFullYear() + 1}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="androidVersion">Android Version *</Label>
                  <Input
                    id="androidVersion"
                    name="androidVersion"
                    value={newCar.androidVersion}
                    onChange={handleInputChange}
                    placeholder="Android 12"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="buildFingerprint">Build Fingerprint</Label>
                  <Input
                    id="buildFingerprint"
                    name="buildFingerprint"
                    value={newCar.buildFingerprint}
                    onChange={handleInputChange}
                    placeholder="google/coral/coral:12/SP2A.220505.002/8353555:user/release-keys"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    value={newCar.location}
                    onChange={handleInputChange}
                    placeholder="Mountain View, CA"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="imageUrl">Image URL (optional)</Label>
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    value={newCar.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/car-image.jpg"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  className="flex gap-2 items-center"
                  disabled={createCarMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                  {createCarMutation.isPending ? "Creating..." : "Create & Select"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}