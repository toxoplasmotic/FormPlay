import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TpsStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Check, X, Save, FileDown } from "lucide-react";

// Import PDF.js directly
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js with fake worker for simplicity
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

interface SimplePdfFormProps {
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

export default function SimplePdfForm({
  reportId,
  initialData,
  mode,
  userId,
  partnerId,
  userNames,
  onSubmitSuccess
}: SimplePdfFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  // Refs for canvas and form overlay
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formOverlayRef = useRef<HTMLDivElement>(null);
  
  // Load and render PDF
  useEffect(() => {
    async function loadAndRenderPdf() {
      setIsLoading(true);
      
      try {
        // 1. Fetch the PDF template
        console.log('Attempting to load PDF template directly...');
        const response = await fetch('/api/templates/tps-vanilla');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF template: ${response.status} ${response.statusText}`);
        }
        
        // 2. Get the PDF data as an array buffer
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        setPdfBytes(bytes);
        
        if (!canvasRef.current) {
          console.error('Canvas reference is null');
          return;
        }
        
        // 3. Load PDF document
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        console.log('PDF loaded successfully with', pdfDoc.numPages, 'pages');
        
        // 4. Get the first page
        const page = await pdfDoc.getPage(1);
        
        // 5. Set up canvas for rendering
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // 6. Render PDF page to canvas
        await page.render({
          canvasContext: context!,
          viewport: viewport
        }).promise;
        
        console.log('PDF rendered successfully to canvas');
        
        // 7. Extract form fields
        const annotations = await page.getAnnotations();
        const formFields = annotations
          .filter((annot: any) => annot.subtype === 'Widget')
          .map((annot: any) => {
            return {
              name: annot.fieldName || 'unnamed',
              type: annot.fieldType || 'unknown',
              value: annot.buttonValue || annot.fieldValue || '',
              rect: annot.rect ? {
                left: annot.rect[0],
                top: annot.rect[1],
                right: annot.rect[2],
                bottom: annot.rect[3]
              } : null,
              options: annot.options ? annot.options.map((opt: any) => opt.displayValue || opt.exportValue) : []
            };
          });
        
        console.log('Found', formFields.length, 'form fields in the PDF');
        
        // 8. Create initial form values
        const initialFormValues: Record<string, any> = {};
        formFields.forEach(field => {
          initialFormValues[field.name] = field.value;
        });
        
        // 9. If we have data from a saved report, use that
        if (initialData?.form_data?.fields) {
          Object.keys(initialData.form_data.fields).forEach(key => {
            initialFormValues[key] = initialData.form_data.fields[key];
          });
        }
        
        setFormValues(initialFormValues);
        
        // 10. Create interactive form elements overlaid on the canvas
        if (formOverlayRef.current) {
          createInteractiveFormElements(
            formOverlayRef.current, 
            canvasRef.current,
            formFields,
            initialFormValues,
            (fieldName, value) => {
              setFormValues(prev => ({
                ...prev,
                [fieldName]: value
              }));
            },
            (mode === "approve") || (mode === "review" && initialData?.status === TpsStatus.PENDING_APPROVAL)
          );
        }
        
      } catch (error) {
        console.error('Error loading or rendering PDF:', error);
        toast({
          title: "Error loading PDF",
          description: "Could not load or render the PDF form: " + (error instanceof Error ? error.message : String(error)),
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAndRenderPdf();
  }, [initialData, toast]);
  
  // Function to create interactive form elements overlaid on the canvas
  function createInteractiveFormElements(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    fields: any[],
    values: Record<string, any>,
    onChange: (fieldName: string, value: any) => void,
    readOnly: boolean = false
  ) {
    // Clear existing elements
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Position container over canvas
    container.style.position = 'absolute';
    container.style.left = canvas.offsetLeft + 'px';
    container.style.top = canvas.offsetTop + 'px';
    container.style.width = canvas.width + 'px';
    container.style.height = canvas.height + 'px';
    
    const scale = canvas.width / 595; // Approximate scale based on standard PDF width
    
    fields.forEach(field => {
      if (!field.rect) return;
      
      // Create container for form element
      const fieldContainer = document.createElement('div');
      fieldContainer.style.position = 'absolute';
      
      // Scale and position
      const left = field.rect.left * scale;
      const top = canvas.height - field.rect.top * scale;
      const width = (field.rect.right - field.rect.left) * scale;
      const height = (field.rect.top - field.rect.bottom) * scale;
      
      fieldContainer.style.left = left + 'px';
      fieldContainer.style.top = top - height + 'px';
      fieldContainer.style.width = width + 'px';
      fieldContainer.style.height = height + 'px';
      
      let element: HTMLElement;
      const currentValue = values[field.name] || field.value || '';
      
      switch (field.type) {
        case 'text':
          const input = document.createElement('input');
          input.type = 'text';
          input.value = currentValue as string;
          input.disabled = readOnly;
          input.style.width = '100%';
          input.style.height = '100%';
          input.style.border = '1px solid transparent';
          input.style.background = 'transparent';
          input.style.fontFamily = 'Arial';
          input.style.fontSize = Math.min(height * 0.8, 16) + 'px';
          
          if (!readOnly) {
            input.addEventListener('focus', () => {
              input.style.border = '1px solid #0000ff';
              input.style.background = 'rgba(255, 255, 255, 0.9)';
            });
            
            input.addEventListener('blur', () => {
              input.style.border = '1px solid transparent';
              input.style.background = 'transparent';
              onChange(field.name, input.value);
            });
            
            input.addEventListener('input', () => {
              onChange(field.name, input.value);
            });
          }
          
          element = input;
          break;
          
        case 'checkbox':
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = currentValue === true || currentValue === field.exportValue;
          checkbox.disabled = readOnly;
          checkbox.style.width = '100%';
          checkbox.style.height = '100%';
          
          if (!readOnly) {
            checkbox.addEventListener('change', () => {
              onChange(field.name, checkbox.checked);
            });
          }
          
          element = checkbox;
          break;
          
        case 'choice':
          const select = document.createElement('select');
          select.disabled = readOnly;
          select.style.width = '100%';
          select.style.height = '100%';
          select.style.background = 'transparent';
          select.style.border = '1px solid transparent';
          select.style.fontFamily = 'Arial';
          select.style.fontSize = Math.min(height * 0.8, 16) + 'px';
          
          // Add empty option
          const emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.text = '';
          select.appendChild(emptyOption);
          
          // Add options
          if (field.options && field.options.length) {
            field.options.forEach((option: string) => {
              const optElement = document.createElement('option');
              optElement.value = option;
              optElement.text = option;
              if (currentValue === option) {
                optElement.selected = true;
              }
              select.appendChild(optElement);
            });
          }
          
          if (!readOnly) {
            select.addEventListener('focus', () => {
              select.style.border = '1px solid #0000ff';
              select.style.background = 'rgba(255, 255, 255, 0.9)';
            });
            
            select.addEventListener('blur', () => {
              select.style.border = '1px solid transparent';
              select.style.background = 'transparent';
            });
            
            select.addEventListener('change', () => {
              onChange(field.name, select.value);
            });
          }
          
          element = select;
          break;
          
        default:
          // Fallback for unsupported field types
          const overlay = document.createElement('div');
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          overlay.title = `Unsupported field type: ${field.type}`;
          element = overlay;
          break;
      }
      
      fieldContainer.appendChild(element);
      container.appendChild(fieldContainer);
    });
  }
  
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
      
      // Prepare minimal metadata
      const metaValues = {
        date: new Date().toISOString().split('T')[0],
        time_start: "21:30",
        time_end: "22:00",
      };
      
      // Prepare payload with form data
      const payload = {
        ...metaValues,
        status,
        creator_id: mode === "create" ? userId : initialData?.creator_id,
        receiver_id: mode === "create" ? partnerId : initialData?.receiver_id,
        form_data: {
          fields: formValues,
          metadata: {
            matt_notes: initialData?.form_data?.metadata?.matt_notes || "",
            mina_notes: initialData?.form_data?.metadata?.mina_notes || "",
          }
        }
      };
      
      // Make API request
      let res;
      if (mode === "create") {
        res = await apiRequest("POST", "/api/tps-reports", payload);
      } else {
        res = await apiRequest("PUT", `/api/tps-reports/${reportId}`, payload);
      }
      
      if (res.ok) {
        // Show success message
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
  const handleDownloadPdf = () => {
    if (!pdfBytes) return;
    
    try {
      // Create a blob from the PDF data
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link to download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `tps_report_${reportId || 'new'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Could not download the PDF",
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
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-t-blue-500 border-b-blue-700 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading PDF form...</p>
            </div>
          </div>
        ) : (
          <>
            {/* PDF Interactive View */}
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
                disabled={!pdfBytes || isSubmitting}
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
          </>
        )}
      </div>
    </div>
  );
}