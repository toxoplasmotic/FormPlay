import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
const pdfjsWorkerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

interface FormField {
  name: string;
  type: string;
  value: string | boolean;
  exportValue?: string;
  options?: string[];
}

export async function loadPdfForm(url: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw new Error('Failed to load PDF');
  }
}

export async function renderPdfToCanvas(
  pdfBytes: Uint8Array,
  canvasElement: HTMLCanvasElement,
  pageNumber: number = 1
): Promise<void> {
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const page = await pdfDoc.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 1.5 });
    canvasElement.height = viewport.height;
    canvasElement.width = viewport.width;

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

export async function getFormFields(pdfBytes: Uint8Array): Promise<FormField[]> {
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
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
          };

          if (annotation.options) {
            field.options = annotation.options.map((opt: any) => opt.displayValue || opt.exportValue);
          }

          if (annotation.exportValue) {
            field.exportValue = annotation.exportValue;
          }

          formFields.push(field);
        });
    }

    return formFields;
  } catch (error) {
    console.error('Error getting form fields:', error);
    throw new Error('Failed to extract form fields');
  }
}

export function createFilledPdf(formData: any): Promise<Uint8Array> {
  // In a real implementation, this would use a PDF manipulation library
  // to fill in the form fields with the provided data.
  
  // For this demo, we'll just use a mock implementation
  return Promise.resolve(new Uint8Array([0]));
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
