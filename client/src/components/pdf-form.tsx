import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TpsStatus, PdfFormField } from "@shared/schema";
import { 
  loadPdfForm, 
  renderPdfToCanvas, 
  getFormFields, 
  createInteractiveFormElements,
  convertToPdfFormFields,
  createFieldsFromPdfFormData,
  createFilledPdf,
  savePdfToFile
} from "@/lib/pdf";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Check, X, Save, FileDown } from "lucide-react";

interface PdfFormProps {
  reportId?: number;
  initialData?: any;
  mode: "create" | "edit" | "review" | "approve" | "view";
  userId: number;
  partnerId: number;
  userNames: {
    user: string;
    partner: string;
  };
  onSubmitSuccess?: () => void;
}

export default function PdfForm({
  reportId,
  initialData,
  mode,
  userId,
  partnerId,
  userNames,
  onSubmitSuccess
}: PdfFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfFields, setPdfFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  // Refs for canvas and form overlay
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formOverlayRef = useRef<HTMLDivElement>(null);
  
  // Load PDF and extract form fields
  useEffect(() => {
    async function loadPdf() {
      try {
        console.log('Attempting to load PDF template...');
        
        // First check if we can access the template
        const templateResponse = await fetch('/api/templates/tps-vanilla');
        if (!templateResponse.ok) {
          throw new Error(`Failed to fetch PDF template: ${templateResponse.status} ${templateResponse.statusText}`);
        }
        
        // For safer loading, we'll read the arrayBuffer directly 
        const arrayBuffer = await templateResponse.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        
        console.log('PDF template loaded successfully, size:', pdfBytes.length, 'bytes');
        setPdfData(pdfBytes);
        
        // Render PDF to canvas
        if (canvasRef.current) {
          console.log('Rendering PDF to canvas...');
          await renderPdfToCanvas(pdfBytes, canvasRef.current);
          console.log('PDF rendered to canvas successfully');
          
          // Get form fields
          const fields = await getFormFields();
          console.log('PDF form fields extracted:', fields.length, 'fields found');
          setPdfFields(fields);
          
          // Create interactive form elements
          if (formOverlayRef.current) {
            // Initialize form values from existing form fields
            const initialFormValues: Record<string, any> = {};
            fields.forEach(field => {
              initialFormValues[field.name] = field.value;
            });
            
            // If we have initial data from a saved report, use that
            if (initialData?.form_data?.fields) {
              Object.keys(initialData.form_data.fields).forEach(key => {
                initialFormValues[key] = initialData.form_data.fields[key];
              });
            }
            
            setFormValues(initialFormValues);
            
            // Create interactive form elements
            console.log('Creating interactive form elements...');
            const isReadOnly = (mode === "approve") || (mode === "review" && initialData?.status === TpsStatus.PENDING_APPROVAL);
            createInteractiveFormElements(
              formOverlayRef.current, 
              canvasRef.current, 
              fields, 
              initialFormValues, 
              handleFormFieldChange,
              isReadOnly
            );
            console.log('Interactive form elements created successfully');
          } else {
            console.error('Form overlay ref is null');
          }
        } else {
          console.error('Canvas ref is null');
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
        toast({
          title: "Error loading PDF",
          description: "Could not load or render the TPS Report template: " + (error instanceof Error ? error.message : String(error)),
          variant: "destructive"
        });
      }
    }
    
    loadPdf();
  }, [initialData, toast]);
  
  // Handle changes to form fields
  const handleFormFieldChange = (fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  // Initialize minimal metadata with defaults
  const metaValues = {
    date: new Date().toISOString().split('T')[0],
    time_start: "21:30",
    time_end: "22:00",
  };
  
  // Handle form submission
  const handleSubmit = async (type: "save" | "submit" | "approve" | "deny") => {
    setIsSubmitting(true);
    try {
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
      
      // Prepare payload with merged data
      const payload = {
        ...metaValues,
        status,
        creator_id: mode === "create" ? userId : initialData?.creator_id,
        receiver_id: mode === "create" ? partnerId : initialData?.receiver_id,
        form_data: {
          // Store form fields directly
          fields: formValues,
          // Include any additional metadata if needed
          metadata: {
            matt_notes: initialData?.form_data?.metadata?.matt_notes || "",
            mina_notes: initialData?.form_data?.metadata?.mina_notes || "",
          }
        }
      };
      
      // Make API request to save the form
      let res;
      if (mode === "create") {
        res = await apiRequest("POST", "/api/tps-reports", payload);
      } else {
        res = await apiRequest("PUT", `/api/tps-reports/${reportId}`, payload);
      }
      
      if (res.ok) {
        const data = await res.json();
        
        // Show success toast
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
          variant: type === "deny" ? "destructive" : "default",
        });
        
        // Navigate or trigger callback
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
  
  // Handle PDF download
  const handleDownloadPdf = async () => {
    if (!pdfData) return;
    
    try {
      // Create filled PDF with form data
      const filledPdf = await createFilledPdf(formValues);
      
      // Save to file
      savePdfToFile(filledPdf, `tps_report_${reportId || 'new'}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Could not download the filled PDF",
        variant: "destructive",
      });
    }
  };
  
  // Determine read-only status based on mode and role
  const isCreator = mode === "create" || (initialData && initialData.creator_id === userId);
  const isReceiver = !isCreator;
  const isReadOnly = (isCreator && mode === "approve") || (isReceiver && initialData?.status === TpsStatus.PENDING_APPROVAL);
  
  // Get status badge for display
  const getStatusBadge = () => {
    if (!initialData) return null;
    
    switch (initialData.status) {
      case TpsStatus.DRAFT:
        return <Badge>Draft</Badge>;
      case TpsStatus.PENDING_REVIEW:
        return <Badge variant="warning">Awaiting Review</Badge>;
      case TpsStatus.PENDING_APPROVAL:
        return <Badge variant="secondary">Awaiting Approval</Badge>;
      case TpsStatus.COMPLETED:
        return <Badge variant="outline">Completed</Badge>;
      case TpsStatus.ABORTED:
        return <Badge variant="destructive">Aborted</Badge>;
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
      
      <div className="px-4 py-5 sm:px-6">
        {/* PDF Interactive View - Only show the PDF form */}
        <div className="mb-6">
          <div className="overflow-auto max-h-[700px] border rounded relative">
            <canvas ref={canvasRef} className="mx-auto" />
            <div ref={formOverlayRef} className="absolute top-0 left-0 w-full h-full pointer-events-auto"></div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-end mt-8">
          {/* Download PDF button always available */}
          <Button 
            variant="outline" 
            onClick={handleDownloadPdf}
            disabled={!pdfData || isSubmitting}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          
          {/* Create/Edit Mode Buttons */}
          {(mode === "create" || mode === "edit") && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSubmit("save")}
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit("submit")}
                disabled={isSubmitting}
              >
                Submit for Review
              </Button>
            </>
          )}
          
          {/* Review Mode Buttons */}
          {mode === "review" && !isReadOnly && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleSubmit("deny")}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Deny
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSubmit("approve")}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          
          {/* Approval Mode Buttons */}
          {mode === "approve" && !isReadOnly && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleSubmit("deny")}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Deny
              </Button>
              <Button
                onClick={() => handleSubmit("approve")}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                Complete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}