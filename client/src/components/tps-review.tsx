import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TpsStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { formatDate, formatTimeRange, getStatusBadgeColor } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface TpsReviewProps {
  report: any;
  isCreator: boolean;
  username: string;
  partnerName: string;
  onSuccessAction?: () => void;
}

export default function TpsReview({ 
  report, 
  isCreator, 
  username, 
  partnerName,
  onSuccessAction
}: TpsReviewProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emotionalState, setEmotionalState] = useState("");
  const [notes, setNotes] = useState("");
  const [initials, setInitials] = useState("");
  
  const statusColors = getStatusBadgeColor(report.status);
  
  let statusLabel = "";
  switch (report.status) {
    case TpsStatus.PENDING_REVIEW:
      statusLabel = isCreator ? "Awaiting Review" : "Awaiting Your Review";
      break;
    case TpsStatus.PENDING_APPROVAL:
      statusLabel = isCreator ? "Your Approval Needed" : "Awaiting Approval";
      break;
    case TpsStatus.COMPLETED:
      statusLabel = "Completed";
      break;
    case TpsStatus.ABORTED:
      statusLabel = "Aborted";
      break;
    default:
      statusLabel = report.status;
  }
  
  const handleAction = async (action: "approve" | "deny") => {
    if (!initials) {
      toast({
        title: "Initials Required",
        description: "Please enter your initials to continue",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare form data
      const updatedReport = { ...report };
      
      if (isCreator) {
        // If creator is approving/denying
        updatedReport.creator_initials = initials;
        
        if (action === "approve") {
          updatedReport.status = TpsStatus.COMPLETED;
        } else {
          updatedReport.status = TpsStatus.ABORTED;
        }
      } else {
        // If receiver is approving/denying
        updatedReport.receiver_initials = initials;
        
        if (emotionalState) {
          if (!updatedReport.form_data.emotional_state) {
            updatedReport.form_data.emotional_state = {};
          }
          
          // If Matt is the receiver
          if (username.toLowerCase() === "matt") {
            updatedReport.form_data.emotional_state.matt = emotionalState;
          } else {
            updatedReport.form_data.emotional_state.mina = emotionalState;
          }
        }
        
        if (notes) {
          if (username.toLowerCase() === "matt") {
            updatedReport.form_data.matt_notes = notes;
          } else {
            updatedReport.form_data.mina_notes = notes;
          }
        }
        
        if (action === "approve") {
          updatedReport.status = TpsStatus.PENDING_APPROVAL;
        } else {
          updatedReport.status = TpsStatus.ABORTED;
        }
      }
      
      // Make API request
      const res = await apiRequest("PUT", `/api/tps-reports/${report.id}`, updatedReport);
      
      if (res.ok) {
        toast({
          title: "Success!",
          description: action === "approve" 
            ? isCreator 
              ? "TPS Report has been completed!"
              : "TPS Report has been sent for approval"
            : "TPS Report has been aborted",
          variant: action === "approve" ? "success" : "destructive"
        });
        
        if (onSuccessAction) {
          onSuccessAction();
        } else {
          setLocation("/");
        }
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to update TPS Report");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update TPS Report",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const replicateReport = async () => {
    setIsSubmitting(true);
    
    try {
      const res = await apiRequest("POST", `/api/tps-reports/${report.id}/replicate`, {});
      
      if (res.ok) {
        const newReport = await res.json();
        
        toast({
          title: "Report Replicated",
          description: "A new TPS Report has been created based on this one",
          variant: "success"
        });
        
        setLocation(`/reports/${newReport.id}`);
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to replicate TPS Report");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to replicate TPS Report",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const needsReview = report.status === TpsStatus.PENDING_REVIEW && !isCreator;
  const needsApproval = report.status === TpsStatus.PENDING_APPROVAL && isCreator;
  const canReplicate = report.status === TpsStatus.COMPLETED || report.status === TpsStatus.ABORTED;
  
  const renderActivities = () => {
    const activities = [];
    
    const formData = report.form_data;
    if (!formData || !formData.activities) return null;
    
    if (formData.activities.affection?.includes("netflix")) {
      activities.push(`Netflix and Chill™${formData.netflix_show ? ` (show: ${formData.netflix_show})` : ''}`);
    }
    
    if (formData.activities.affection?.includes("hands")) {
      activities.push("Hold hands for a little bit");
    }
    
    if (formData.activities.affection?.includes("hug")) {
      activities.push("Squeeze hug");
    }
    
    if (formData.activities.affection?.includes("hair")) {
      activities.push("Brush hair");
    }
    
    if (formData.activities.light_intimacy?.includes("massage")) {
      activities.push("Back massage");
    }
    
    if (formData.activities.light_intimacy?.includes("cuddle")) {
      activities.push("Cuddle on the couch");
    }
    
    if (formData.activities.light_intimacy?.includes("kisses")) {
      activities.push("Light kisses");
    }
    
    if (formData.activities.moderate_intimacy?.includes("deep")) {
      activities.push("Deep kissing");
    }
    
    if (formData.activities.moderate_intimacy?.includes("touch")) {
      activities.push("Above-clothes touching");
    }
    
    if (activities.length === 0) return <p className="text-sm text-gray-500">No activities selected</p>;
    
    return (
      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
        {activities.map((activity, index) => (
          <li key={index}>{activity}</li>
        ))}
      </ul>
    );
  };
  
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">TPS Report v1.2</h3>
        <Badge className={`${statusColors.bgColor} ${statusColors.textColor}`}>
          {statusLabel}
        </Badge>
      </div>
      
      <div className="border-t border-gray-200">
        <div className="px-4 py-5 sm:px-6">
          <div className="sm:flex sm:items-center sm:justify-between mb-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900">
                Submitted by {report.creator_name} on {formatDate(report.created_at)}
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                {(needsReview || needsApproval) 
                  ? "Please review the details and approve or deny this request" 
                  : `This report is ${report.status.toLowerCase()}`}
              </p>
            </div>
          </div>
          
          {/* Form summary */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h5 className="font-medium text-gray-700 mb-2">Summary</h5>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(report.date)}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Time</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatTimeRange(report.time_start, report.time_end)}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {report.location === "master" ? "Master bedroom" : 
                   report.location === "basement" ? "Basement" : 
                   report.location === "other" ? `Other: ${report.location_other}` : 
                   report.location}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Sound</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {report.sound === "quiet" ? "No music, quiet" : 
                   report.sound === "soft" ? "Soft background music" : 
                   report.sound === "white" ? "White noise / ambient" : 
                   report.sound}
                </dd>
              </div>
            </dl>
          </div>
          
          <div className="mb-6">
            <h5 className="font-medium text-gray-700 mb-2">Emotional State</h5>
            <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {report.creator_name}: 
                  <span className="text-gray-900 ml-1">
                    {report.form_data?.emotional_state?.matt && report.creator_name === "Matt" 
                      ? (report.form_data.emotional_state.matt === "calm" ? "Calm or relaxed" :
                         report.form_data.emotional_state.matt === "anxious" ? "Anxious or nervous" :
                         report.form_data.emotional_state.matt === "curious" ? "Curious or open" :
                         report.form_data.emotional_state.matt === "not" ? "Not into this" :
                         report.form_data.emotional_state.matt === "other" ? "Other" : "")
                      : report.form_data?.emotional_state?.mina && report.creator_name === "Mina"
                      ? (report.form_data.emotional_state.mina === "calm" ? "Calm or relaxed" :
                         report.form_data.emotional_state.mina === "anxious" ? "Anxious or nervous" :
                         report.form_data.emotional_state.mina === "curious" ? "Curious or open" :
                         report.form_data.emotional_state.mina === "not" ? "Not into this" :
                         report.form_data.emotional_state.mina === "other" ? "Other" : "")
                      : <span className="italic">Not specified</span>
                    }
                  </span>
                </p>
                {(report.form_data?.matt_notes && report.creator_name === "Matt") || 
                 (report.form_data?.mina_notes && report.creator_name === "Mina") ? (
                  <p className="text-sm text-gray-900 mt-1">
                    Notes: {report.creator_name === "Matt" ? report.form_data.matt_notes : report.form_data.mina_notes}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {report.receiver_name}: 
                  <span className="text-gray-900 ml-1">
                    {report.form_data?.emotional_state?.matt && report.receiver_name === "Matt" 
                      ? (report.form_data.emotional_state.matt === "calm" ? "Calm or relaxed" :
                         report.form_data.emotional_state.matt === "anxious" ? "Anxious or nervous" :
                         report.form_data.emotional_state.matt === "curious" ? "Curious or open" :
                         report.form_data.emotional_state.matt === "not" ? "Not into this" :
                         report.form_data.emotional_state.matt === "other" ? "Other" : "")
                      : report.form_data?.emotional_state?.mina && report.receiver_name === "Mina"
                      ? (report.form_data.emotional_state.mina === "calm" ? "Calm or relaxed" :
                         report.form_data.emotional_state.mina === "anxious" ? "Anxious or nervous" :
                         report.form_data.emotional_state.mina === "curious" ? "Curious or open" :
                         report.form_data.emotional_state.mina === "not" ? "Not into this" :
                         report.form_data.emotional_state.mina === "other" ? "Other" : "")
                      : needsReview
                      ? <span className="italic">To be filled during review</span>
                      : <span className="italic">Not specified</span>
                    }
                  </span>
                </p>
                {(report.form_data?.matt_notes && report.receiver_name === "Matt") || 
                 (report.form_data?.mina_notes && report.receiver_name === "Mina") ? (
                  <p className="text-sm text-gray-900 mt-1">
                    Notes: {report.receiver_name === "Matt" ? report.form_data.matt_notes : report.form_data.mina_notes}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h5 className="font-medium text-gray-700 mb-2">Requested Activities</h5>
            {renderActivities()}
          </div>
          
          {/* Approval/Review Section */}
          {(needsReview || needsApproval) && (
            <div className="mt-8 border-t pt-6">
              <h5 className="font-medium text-gray-700 mb-3">Your Response</h5>
              
              {needsReview && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="mb-4">
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Emotional State
                    </Label>
                    <RadioGroup value={emotionalState} onValueChange={setEmotionalState}>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="calm" id="emotional_calm" />
                          <Label htmlFor="emotional_calm">Calm or relaxed</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="anxious" id="emotional_anxious" />
                          <Label htmlFor="emotional_anxious">Anxious or nervous</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="curious" id="emotional_curious" />
                          <Label htmlFor="emotional_curious">Curious or open</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="not" id="emotional_not" />
                          <Label htmlFor="emotional_not">Not into this</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="review_notes" className="block text-sm font-medium text-gray-700">
                      Your Notes (Optional)
                    </Label>
                    <Textarea
                      id="review_notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <Label htmlFor="review_initials" className="block text-sm font-medium text-gray-700">
                  Your Initials
                </Label>
                <Input
                  id="review_initials"
                  placeholder="Initials"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  className="mt-1 w-40"
                />
              </div>
              
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => handleAction("deny")}
                  disabled={isSubmitting}
                >
                  <X className="h-5 w-5 mr-2" />
                  Not Into This
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => handleAction("approve")}
                  disabled={isSubmitting || !initials}
                >
                  <Check className="h-5 w-5 mr-2" />
                  {needsReview ? "Send for Approval" : "Approve"}
                </Button>
              </div>
            </div>
          )}
          
          {/* Replication Section */}
          {canReplicate && (
            <div className="mt-8 border-t pt-6">
              <h5 className="font-medium text-gray-700 mb-3">Replicate this TPS Report</h5>
              <p className="text-sm text-gray-500 mb-4">
                Create a new TPS report with the same settings but reset date and emotional state.
              </p>
              <Button
                type="button"
                onClick={replicateReport}
                disabled={isSubmitting}
              >
                Replicate Report
              </Button>
            </div>
          )}
          
          {/* Initials Section */}
          {(report.creator_initials || report.receiver_initials) && (
            <div className="mt-8 border-t pt-6">
              <h5 className="font-medium text-gray-700 mb-3">Signatures</h5>
              <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2">
                {report.creator_initials && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{report.creator_name}</p>
                    <p className="text-sm text-gray-900">{report.creator_initials}</p>
                  </div>
                )}
                {report.receiver_initials && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{report.receiver_name}</p>
                    <p className="text-sm text-gray-900">{report.receiver_initials}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
