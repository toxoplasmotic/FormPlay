import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { TpsStatus, TpsFormData } from "@shared/schema";
import { loadPdfForm, renderPdfToCanvas } from "@/lib/pdf";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { CalendarDays, Clock, Check, X, Save } from "lucide-react";

interface TpsFormProps {
  reportId?: number;
  initialData?: any;
  mode: "create" | "edit" | "review" | "approve";
  userId: number;
  partnerId: number;
  userNames: {
    user: string;
    partner: string;
  };
  onSubmitSuccess?: () => void;
}

export default function TpsForm({
  reportId,
  initialData,
  mode,
  userId,
  partnerId,
  userNames,
  onSubmitSuccess
}: TpsFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  
  const form = useForm({
    defaultValues: initialData || {
      date: new Date().toISOString().split('T')[0],
      time_start: "21:30",
      time_end: "22:00",
      location: "",
      location_other: "",
      sound: "",
      form_data: {
        emotional_state: {
          matt: "",
          mina: ""
        },
        physical_conditions: {
          matt: [],
          mina: []
        },
        matt_notes: "",
        mina_notes: "",
        alterations: [],
        kids: [],
        activities: {
          affection: [],
          light_intimacy: [],
          moderate_intimacy: [],
          intense_intimacy: [],
          intercourse: []
        },
        netflix_show: ""
      },
      creator_notes: "",
      receiver_notes: "",
      creator_initials: "",
      receiver_initials: ""
    }
  });
  
  const formData = form.watch();
  
  // Load PDF when component mounts
  useEffect(() => {
    async function loadPdf() {
      try {
        const pdfBytes = await loadPdfForm('/api/templates/tps-vanilla');
        if (canvasRef.current) {
          await renderPdfToCanvas(pdfBytes, canvasRef.current);
          setPdfLoaded(true);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
        toast({
          title: "Error loading PDF",
          description: "Could not load the TPS Report template",
          variant: "destructive"
        });
      }
    }
    
    loadPdf();
  }, []);

  const handleSubmit = async (type: "save" | "submit" | "approve" | "deny") => {
    setIsSubmitting(true);
    try {
      const formValues = form.getValues();
      
      // Determine status based on submission type
      let status;
      switch (type) {
        case "save":
          status = TpsStatus.DRAFT;
          break;
        case "submit":
          status = TpsStatus.PENDING_REVIEW;
          break;
        case "approve":
          status = mode === "review" ? TpsStatus.PENDING_APPROVAL : TpsStatus.COMPLETED;
          break;
        case "deny":
          status = TpsStatus.ABORTED;
          break;
      }
      
      const payload = {
        ...formValues,
        status,
        creator_id: mode === "create" ? userId : initialData?.creator_id,
        receiver_id: mode === "create" ? partnerId : initialData?.receiver_id
      };
      
      let res;
      if (mode === "create") {
        res = await apiRequest("POST", "/api/tps-reports", payload);
      } else {
        res = await apiRequest("PUT", `/api/tps-reports/${reportId}`, payload);
      }
      
      if (res.ok) {
        const data = await res.json();
        
        toast({
          title: "Success!",
          description: type === "save" 
            ? "TPS Report saved as draft" 
            : type === "submit" 
              ? "TPS Report submitted for review" 
              : type === "approve" 
                ? mode === "review" 
                  ? "TPS Report sent for approval" 
                  : "TPS Report completed!" 
                : "TPS Report aborted",
          variant: "success",
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        } else {
          setLocation("/");
        }
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to save TPS Report");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save TPS Report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreator = mode === "create" || mode === "approve";
  const isReceiver = mode === "review";
  const isReadOnly = (isCreator && mode === "approve") || (isReceiver && initialData?.status === TpsStatus.PENDING_APPROVAL);
  
  const getStatusBadge = () => {
    if (!initialData) return null;
    
    switch (initialData.status) {
      case TpsStatus.DRAFT:
        return <Badge variant="default">Draft</Badge>;
      case TpsStatus.PENDING_REVIEW:
        return <Badge variant="warning">Awaiting Review</Badge>;
      case TpsStatus.PENDING_APPROVAL:
        return <Badge variant="pending">Awaiting Approval</Badge>;
      case TpsStatus.COMPLETED:
        return <Badge variant="success">Completed</Badge>;
      case TpsStatus.ABORTED:
        return <Badge variant="danger">Aborted</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">TPS Report v1.2</h3>
        {getStatusBadge()}
      </div>
      
      <div className="border-t border-gray-200">
        <div className="px-4 py-5 sm:px-6">
          {showPdf ? (
            <div className="mb-6">
              <Button 
                variant="outline" 
                className="mb-4"
                onClick={() => setShowPdf(false)}
              >
                Hide PDF View
              </Button>
              <div className="overflow-auto max-h-[600px] border rounded">
                <canvas ref={canvasRef} className="mx-auto" />
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <Button 
                variant="outline"
                onClick={() => setShowPdf(true)}
                disabled={!pdfLoaded}
              >
                {pdfLoaded ? "Show PDF View" : "Loading PDF..."}
              </Button>
            </div>
          )}
          
          <form className="space-y-6">
            {/* Form Header */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date" className="flex items-center">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    className="mt-1"
                    {...form.register("date")}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="time_start" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Time (Start)
                  </Label>
                  <Input
                    id="time_start"
                    type="time"
                    className="mt-1"
                    {...form.register("time_start")}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="time_end" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Time (Estimated End)
                  </Label>
                  <Input
                    id="time_end"
                    type="time"
                    className="mt-1"
                    {...form.register("time_end")}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Emotional and Physical Check-In */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">1) Emotional and Physical Check-In</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Emotional State */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Emotional State</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Matt</p>
                      <RadioGroup 
                        value={formData.form_data?.emotional_state?.matt} 
                        onValueChange={(value) => {
                          form.setValue("form_data.emotional_state.matt", value);
                        }}
                        disabled={!isCreator || isReadOnly}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="calm" id="matt_emotional_calm" />
                            <Label htmlFor="matt_emotional_calm">Calm or relaxed</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="anxious" id="matt_emotional_anxious" />
                            <Label htmlFor="matt_emotional_anxious">Anxious or nervous</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="curious" id="matt_emotional_curious" />
                            <Label htmlFor="matt_emotional_curious">Curious or open</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="not" id="matt_emotional_not" />
                            <Label htmlFor="matt_emotional_not">Not into this</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="other" id="matt_emotional_other" />
                            <Label htmlFor="matt_emotional_other">Other (explain below)</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Mina</p>
                      <RadioGroup 
                        value={formData.form_data?.emotional_state?.mina} 
                        onValueChange={(value) => {
                          form.setValue("form_data.emotional_state.mina", value);
                        }}
                        disabled={!isReceiver || isReadOnly}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="calm" id="mina_emotional_calm" />
                            <Label htmlFor="mina_emotional_calm">Calm or relaxed</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="anxious" id="mina_emotional_anxious" />
                            <Label htmlFor="mina_emotional_anxious">Anxious or nervous</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="curious" id="mina_emotional_curious" />
                            <Label htmlFor="mina_emotional_curious">Curious or open</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="not" id="mina_emotional_not" />
                            <Label htmlFor="mina_emotional_not">Not into this</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="other" id="mina_emotional_other" />
                            <Label htmlFor="mina_emotional_other">Other (explain below)</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="matt_notes" className="block text-sm font-medium text-gray-700">
                      Matt's Notes
                    </Label>
                    <Textarea
                      id="matt_notes"
                      className="mt-1"
                      {...form.register("form_data.matt_notes")}
                      disabled={!isCreator || isReadOnly}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="mina_notes" className="block text-sm font-medium text-gray-700">
                      Mina's Notes
                    </Label>
                    <Textarea
                      id="mina_notes"
                      className="mt-1"
                      {...form.register("form_data.mina_notes")}
                      disabled={!isReceiver || isReadOnly}
                    />
                  </div>
                </div>

                {/* Physical Conditions */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Physical Conditions</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Matt</p>
                      <div className="space-y-2">
                        {["good", "fatigue", "headache", "hormonal", "sensitivities"].map((condition) => (
                          <div key={condition} className="flex items-center space-x-2">
                            <Checkbox
                              id={`matt_physical_${condition}`}
                              checked={formData.form_data?.physical_conditions?.matt?.includes(condition)}
                              onCheckedChange={(checked) => {
                                const current = formData.form_data?.physical_conditions?.matt || [];
                                const updated = checked
                                  ? [...current, condition]
                                  : current.filter(c => c !== condition);
                                form.setValue("form_data.physical_conditions.matt", updated);
                              }}
                              disabled={!isCreator || isReadOnly}
                            />
                            <Label htmlFor={`matt_physical_${condition}`}>
                              {condition === "good" ? "I'm good" :
                               condition === "fatigue" ? "Fatigue" :
                               condition === "headache" ? "Headache" :
                               condition === "hormonal" ? "Hormonal changes" :
                               "Sensitivities (explain in notes)"}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Mina</p>
                      <div className="space-y-2">
                        {["good", "fatigue", "headache", "hormonal", "sensitivities"].map((condition) => (
                          <div key={condition} className="flex items-center space-x-2">
                            <Checkbox
                              id={`mina_physical_${condition}`}
                              checked={formData.form_data?.physical_conditions?.mina?.includes(condition)}
                              onCheckedChange={(checked) => {
                                const current = formData.form_data?.physical_conditions?.mina || [];
                                const updated = checked
                                  ? [...current, condition]
                                  : current.filter(c => c !== condition);
                                form.setValue("form_data.physical_conditions.mina", updated);
                              }}
                              disabled={!isReceiver || isReadOnly}
                            />
                            <Label htmlFor={`mina_physical_${condition}`}>
                              {condition === "good" ? "I'm good" :
                               condition === "fatigue" ? "Fatigue" :
                               condition === "headache" ? "Headache" :
                               condition === "hormonal" ? "Hormonal changes" :
                               "Sensitivities (explain in notes)"}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Setting and Atmosphere */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4 mt-8">2) Setting and Atmosphere</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Location</h5>
                  <RadioGroup 
                    value={formData.location} 
                    onValueChange={(value) => {
                      form.setValue("location", value);
                    }}
                    disabled={isReadOnly}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="master" id="location_master" />
                        <Label htmlFor="location_master">Master bedroom</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="basement" id="location_basement" />
                        <Label htmlFor="location_basement">Basement</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="location_other" />
                        <Label htmlFor="location_other">Other:</Label>
                        <Input
                          className="w-48 h-8"
                          value={formData.location_other || ""}
                          onChange={(e) => form.setValue("location_other", e.target.value)}
                          disabled={formData.location !== "other" || isReadOnly}
                        />
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Sound */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Sound</h5>
                  <RadioGroup 
                    value={formData.sound} 
                    onValueChange={(value) => {
                      form.setValue("sound", value);
                    }}
                    disabled={isReadOnly}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="quiet" id="sound_quiet" />
                        <Label htmlFor="sound_quiet">No music, quiet</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="soft" id="sound_soft" />
                        <Label htmlFor="sound_soft">Soft background music</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="white" id="sound_white" />
                        <Label htmlFor="sound_white">White noise / ambient</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Alterations */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Alterations</h5>
                  <div className="space-y-2">
                    {["drinks", "sober"].map((alteration) => (
                      <div key={alteration} className="flex items-center space-x-2">
                        <Checkbox
                          id={`alterations_${alteration}`}
                          checked={formData.form_data?.alterations?.includes(alteration)}
                          onCheckedChange={(checked) => {
                            const current = formData.form_data?.alterations || [];
                            const updated = checked
                              ? [...current, alteration]
                              : current.filter(a => a !== alteration);
                            form.setValue("form_data.alterations", updated);
                          }}
                          disabled={isReadOnly}
                        />
                        <Label htmlFor={`alterations_${alteration}`}>
                          {alteration === "drinks" ? "Drinks" : "Sober (no weed)"}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="alterations_other"
                        checked={formData.form_data?.alterations?.includes("other")}
                        onCheckedChange={(checked) => {
                          const current = formData.form_data?.alterations || [];
                          const updated = checked
                            ? [...current, "other"]
                            : current.filter(a => a !== "other");
                          form.setValue("form_data.alterations", updated);
                        }}
                        disabled={isReadOnly}
                      />
                      <Label htmlFor="alterations_other">Other:</Label>
                      <Input
                        className="w-48 h-8"
                        value={formData.form_data?.alterations_other || ""}
                        onChange={(e) => form.setValue("form_data.alterations_other", e.target.value)}
                        disabled={!formData.form_data?.alterations?.includes("other") || isReadOnly}
                      />
                    </div>
                  </div>
                </div>

                {/* Kids */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Kids</h5>
                  <div className="space-y-2">
                    {["asleep", "movie"].map((kidStatus) => (
                      <div key={kidStatus} className="flex items-center space-x-2">
                        <Checkbox
                          id={`kids_${kidStatus}`}
                          checked={formData.form_data?.kids?.includes(kidStatus)}
                          onCheckedChange={(checked) => {
                            const current = formData.form_data?.kids || [];
                            const updated = checked
                              ? [...current, kidStatus]
                              : current.filter(k => k !== kidStatus);
                            form.setValue("form_data.kids", updated);
                          }}
                          disabled={isReadOnly}
                        />
                        <Label htmlFor={`kids_${kidStatus}`}>
                          {kidStatus === "asleep" ? "Asleep" : "Watching a movie"}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="kids_other"
                        checked={formData.form_data?.kids?.includes("other")}
                        onCheckedChange={(checked) => {
                          const current = formData.form_data?.kids || [];
                          const updated = checked
                            ? [...current, "other"]
                            : current.filter(k => k !== "other");
                          form.setValue("form_data.kids", updated);
                        }}
                        disabled={isReadOnly}
                      />
                      <Label htmlFor="kids_other">Other:</Label>
                      <Input
                        className="w-48 h-8"
                        value={formData.form_data?.kids_other || ""}
                        onChange={(e) => form.setValue("form_data.kids_other", e.target.value)}
                        disabled={!formData.form_data?.kids?.includes("other") || isReadOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Levels of Physical Contact */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4 mt-8">3) Levels of Physical Contact</h4>
              <p className="text-sm text-gray-500 mb-4">
                Check the box next to activities you feel like doing. Cross out checked suggestions you are uncomfortable with, if any.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Affection */}
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h5 className="text-sm font-medium text-indigo-700 mb-3">Affection</h5>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="affection_netflix"
                        checked={formData.form_data?.activities?.affection?.includes("netflix")}
                        onCheckedChange={(checked) => {
                          const current = formData.form_data?.activities?.affection || [];
                          const updated = checked
                            ? [...current, "netflix"]
                            : current.filter(a => a !== "netflix");
                          form.setValue("form_data.activities.affection", updated);
                        }}
                        disabled={isReadOnly}
                      />
                      <Label htmlFor="affection_netflix">Netflix and Chill™</Label>
                    </div>
                    {formData.form_data?.activities?.affection?.includes("netflix") && (
                      <div className="ml-6 mt-1">
                        <Input
                          placeholder="Show: (Optional)"
                          value={formData.form_data?.netflix_show || ""}
                          onChange={(e) => form.setValue("form_data.netflix_show", e.target.value)}
                          disabled={isReadOnly}
                        />
                      </div>
                    )}
                    
                    {["hands", "hug", "hair"].map((activity) => (
                      <div key={activity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`affection_${activity}`}
                          checked={formData.form_data?.activities?.affection?.includes(activity)}
                          onCheckedChange={(checked) => {
                            const current = formData.form_data?.activities?.affection || [];
                            const updated = checked
                              ? [...current, activity]
                              : current.filter(a => a !== activity);
                            form.setValue("form_data.activities.affection", updated);
                          }}
                          disabled={isReadOnly}
                        />
                        <Label htmlFor={`affection_${activity}`}>
                          {activity === "hands" ? "Hold hands for a little bit" : 
                           activity === "hug" ? "Squeeze hug" : "Brush hair"}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Light Intimacy */}
                <div className="bg-pink-50 p-4 rounded-lg">
                  <h5 className="text-sm font-medium text-pink-700 mb-3">Light Intimacy</h5>
                  <div className="space-y-2">
                    {["massage", "cuddle", "kisses"].map((activity) => (
                      <div key={activity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`light_${activity}`}
                          checked={formData.form_data?.activities?.light_intimacy?.includes(activity)}
                          onCheckedChange={(checked) => {
                            const current = formData.form_data?.activities?.light_intimacy || [];
                            const updated = checked
                              ? [...current, activity]
                              : current.filter(a => a !== activity);
                            form.setValue("form_data.activities.light_intimacy", updated);
                          }}
                          disabled={isReadOnly}
                        />
                        <Label htmlFor={`light_${activity}`}>
                          {activity === "massage" ? "Back massage" : 
                           activity === "cuddle" ? "Cuddle on the couch" : "Light kisses"}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Moderate Intimacy */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h5 className="text-sm font-medium text-purple-700 mb-3">Moderate Intimacy</h5>
                  <div className="space-y-2">
                    {["deep", "touch"].map((activity) => (
                      <div key={activity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`moderate_${activity}`}
                          checked={formData.form_data?.activities?.moderate_intimacy?.includes(activity)}
                          onCheckedChange={(checked) => {
                            const current = formData.form_data?.activities?.moderate_intimacy || [];
                            const updated = checked
                              ? [...current, activity]
                              : current.filter(a => a !== activity);
                            form.setValue("form_data.activities.moderate_intimacy", updated);
                          }}
                          disabled={isReadOnly}
                        />
                        <Label htmlFor={`moderate_${activity}`}>
                          {activity === "deep" ? "Deep kissing" : "Above-clothes touching"}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Initials Section */}
            <div className="mt-8 border-t pt-6">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Initials</h5>
              <p className="text-xs text-gray-500 mb-4">
                By initialing below, we agree that this reflects our understanding and comfort levels for the upcoming intimate encounter. 
                We acknowledge that consent can be withdrawn at any time, and that this form is a starting point for discussion, not a binding contract. 
                We acknowledge that only the items checked will be attempted. The purpose of this form is to ensure mutual respect, safety, and pleasure, 
                and is actually serious and not a joke.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="matt_initials" className="block text-sm font-medium text-gray-700">
                    Matt
                  </Label>
                  <Input
                    id="matt_initials"
                    placeholder="Initials"
                    {...form.register("creator_initials")}
                    disabled={!isCreator || (mode === "create")}
                    className="mt-1 w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="mina_initials" className="block text-sm font-medium text-gray-700">
                    Mina
                  </Label>
                  <Input
                    id="mina_initials"
                    placeholder="Initials"
                    {...form.register("receiver_initials")}
                    disabled={!isReceiver || (mode === "create")}
                    className="mt-1 w-40"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex justify-end space-x-3">
              {mode === "create" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit("save")}
                    disabled={isSubmitting}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit("submit")}
                    disabled={isSubmitting}
                  >
                    Submit
                  </Button>
                </>
              )}
              
              {mode === "review" && (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleSubmit("deny")}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Not Into This
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={() => handleSubmit("approve")}
                    disabled={isSubmitting || !formData.receiver_initials}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
              
              {mode === "approve" && (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleSubmit("deny")}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Not Into This
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={() => handleSubmit("approve")}
                    disabled={isSubmitting || !formData.creator_initials}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
