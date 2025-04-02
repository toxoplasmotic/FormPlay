import * as pdfjsLib from 'pdfjs-dist';
import { PdfFormField } from '@shared/schema';

// Set the worker source path to use the simple fake worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// Enhanced form field interface with more properties
interface FormField {
  name: string;
  type: string;
  value: string | boolean | string[];
  exportValue?: string;
  options?: string[];
  rect?: { left: number, top: number, right: number, bottom: number };
  pageNumber?: number;
  defaultValue?: string | boolean;
  isRequired?: boolean;
  maxLength?: number;
}

// PDF document with form annotation capabilities
let currentPdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
let currentPdfFields: FormField[] = [];
let currentPdfBytes: Uint8Array | null = null;

export async function loadPdfForm(url: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    // Store the current PDF for later use
    currentPdfBytes = pdfBytes;
    
    // Clear the previous document if it exists
    if (currentPdfDocument) {
      currentPdfDocument.destroy();
      currentPdfDocument = null;
    }
    
    // Load the document
    currentPdfDocument = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    
    // Extract and store form fields
    currentPdfFields = await extractFormFields(currentPdfDocument);
    
    return pdfBytes;
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw new Error('Failed to load PDF');
  }
}

async function extractFormFields(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<FormField[]> {
  const formFields: FormField[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const annotations = await page.getAnnotations();

    annotations
      .filter((annotation: any) => annotation.subtype === 'Widget')
      .forEach((annotation: any) => {
        const field: FormField = {
          name: annotation.fieldName || 'unnamed',
          type: annotation.fieldType || 'unknown',
          value: annotation.buttonValue || annotation.fieldValue || '',
          pageNumber: i,
          defaultValue: annotation.defaultValue || '',
          isRequired: annotation.required || false
        };

        // Extract field rectangle for positioning
        if (annotation.rect) {
          field.rect = {
            left: annotation.rect[0],
            top: annotation.rect[1],
            right: annotation.rect[2],
            bottom: annotation.rect[3]
          };
        }

        // Extract options for choice fields
        if (annotation.options) {
          field.options = annotation.options.map((opt: any) => opt.displayValue || opt.exportValue);
        }

        // Extract export value for checkboxes and radio buttons
        if (annotation.exportValue) {
          field.exportValue = annotation.exportValue;
        }
        
        // Extract max length for text fields
        if (annotation.maxLen) {
          field.maxLength = annotation.maxLen;
        }

        formFields.push(field);
      });
  }

  return formFields;
}

export async function renderPdfToCanvas(
  pdfBytes: Uint8Array,
  canvasElement: HTMLCanvasElement,
  pageNumber: number = 1,
  scale: number = 1.5
): Promise<void> {
  try {
    // If we're rendering a new PDF, load it first
    if (!currentPdfDocument || currentPdfBytes !== pdfBytes) {
      if (currentPdfDocument) {
        currentPdfDocument.destroy();
      }
      currentPdfDocument = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      currentPdfBytes = pdfBytes;
      currentPdfFields = await extractFormFields(currentPdfDocument);
    }
    
    // Get the page
    const page = await currentPdfDocument.getPage(pageNumber);

    // Set up the canvas with the right size
    const viewport = page.getViewport({ scale });
    canvasElement.height = viewport.height;
    canvasElement.width = viewport.width;

    // Render the page
    const renderContext = {
      canvasContext: canvasElement.getContext('2d')!,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  } catch (error) {
    console.error('Error rendering PDF:', error);
    throw new Error('Failed to render PDF');
  }
}

export async function getFormFields(): Promise<FormField[]> {
  if (!currentPdfFields.length) {
    throw new Error('No PDF loaded or no form fields found');
  }
  
  return currentPdfFields;
}

export function convertToPdfFormFields(formData: any): PdfFormField[] {
  if (!currentPdfFields.length) {
    return [];
  }
  
  // Convert the form data to PDF form fields
  return currentPdfFields.map(field => {
    // Find the value in the provided form data, or use the default/current value
    const value = formData[field.name] !== undefined 
      ? formData[field.name] 
      : field.value;
      
    return {
      name: field.name,
      type: field.type,
      value: value
    };
  });
}

export function createFieldsFromPdfFormData(pdfFields: PdfFormField[]): Record<string, any> {
  // Convert the PDF form fields to a simple key-value object
  const result: Record<string, any> = {};
  
  pdfFields.forEach(field => {
    result[field.name] = field.value;
  });
  
  return result;
}

export async function createFilledPdf(formData: Record<string, any>): Promise<Uint8Array> {
  if (!currentPdfDocument || !currentPdfBytes) {
    throw new Error('No PDF document loaded');
  }
  
  // In a real implementation, this would use a PDF manipulation library
  // to fill in the form fields with the provided data.
  
  // For this demo, we'll just return the current PDF bytes
  // In a production app, you would use a library like pdf-lib to fill the form
  console.log('Creating filled PDF with form data:', formData);
  return currentPdfBytes;
}

export function savePdfToFile(pdfBytes: Uint8Array, fileName: string): void {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Create PDF interactive form elements overlaid on canvas
export function createInteractiveFormElements(
  containerElement: HTMLElement,
  canvasElement: HTMLCanvasElement,
  formFields: FormField[],
  values: Record<string, any>,
  onChange: (fieldName: string, value: any) => void,
  readOnly: boolean = false
): void {
  // Clear any previous form elements
  while (containerElement.firstChild) {
    containerElement.removeChild(containerElement.firstChild);
  }
  
  // Position the container over the canvas
  containerElement.style.position = 'absolute';
  containerElement.style.left = canvasElement.offsetLeft + 'px';
  containerElement.style.top = canvasElement.offsetTop + 'px';
  containerElement.style.width = canvasElement.width + 'px';
  containerElement.style.height = canvasElement.height + 'px';
  
  // Get the current page number and scale from the canvas
  const pageNumber = 1; // Default to first page
  const scale = canvasElement.width / 595; // Approximate scale based on canvas width
  
  // Filter fields for the current page
  const pageFields = formFields.filter(field => field.pageNumber === pageNumber);
  
  // Create overlay form elements for each field
  pageFields.forEach(field => {
    if (!field.rect) return;
    
    // Create a container for the form element
    const fieldContainer = document.createElement('div');
    fieldContainer.style.position = 'absolute';
    
    // Scale and position the field
    const left = field.rect.left * scale;
    const top = canvasElement.height - field.rect.top * scale;
    const width = (field.rect.right - field.rect.left) * scale;
    const height = (field.rect.top - field.rect.bottom) * scale;
    
    fieldContainer.style.left = left + 'px';
    fieldContainer.style.top = top - height + 'px';
    fieldContainer.style.width = width + 'px';
    fieldContainer.style.height = height + 'px';
    
    // Create the appropriate form element based on field type
    let formElement: HTMLElement;
    
    const currentValue = values[field.name] || field.value || '';
    
    switch (field.type) {
      case 'text':
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = currentValue as string;
        textInput.disabled = readOnly;
        textInput.style.width = '100%';
        textInput.style.height = '100%';
        textInput.style.border = '1px solid transparent';
        textInput.style.background = 'transparent';
        textInput.style.fontFamily = 'Arial';
        textInput.style.fontSize = Math.min(height * 0.8, 16) + 'px';
        
        if (!readOnly) {
          textInput.addEventListener('focus', () => {
            textInput.style.border = '1px solid #0000ff';
            textInput.style.background = 'rgba(255, 255, 255, 0.9)';
          });
          
          textInput.addEventListener('blur', () => {
            textInput.style.border = '1px solid transparent';
            textInput.style.background = 'transparent';
            onChange(field.name, textInput.value);
          });
          
          textInput.addEventListener('input', () => {
            onChange(field.name, textInput.value);
          });
        }
        
        formElement = textInput;
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
            onChange(field.name, checkbox.checked ? (field.exportValue || true) : false);
          });
        }
        
        formElement = checkbox;
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
        if (field.options) {
          field.options.forEach(option => {
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
        
        formElement = select;
        break;
        
      case 'button':
        const button = document.createElement('button');
        button.textContent = field.value as string || field.name;
        button.disabled = readOnly;
        button.style.width = '100%';
        button.style.height = '100%';
        
        if (!readOnly) {
          button.addEventListener('click', () => {
            onChange(field.name, true);
          });
        }
        
        formElement = button;
        break;
        
      default:
        // For unsupported field types, create a simple overlay
        const overlay = document.createElement('div');
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        overlay.title = `Unsupported field type: ${field.type}`;
        formElement = overlay;
        break;
    }
    
    fieldContainer.appendChild(formElement);
    containerElement.appendChild(fieldContainer);
  });
}
