import { RefObject, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useToast } from '../context/ToastContext';

interface ScreenshotOptions {
  scale?: number;
  backgroundColor?: string;
  filename?: string;
  prepare?: (element: HTMLElement) => void;
}

export function useScreenshot() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { showToast } = useToast();
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  /**
   * Captures a screenshot of the specified element and downloads it
   */
  const takeScreenshot = async (
    elementRef: RefObject<HTMLElement>,
    options: ScreenshotOptions = {}
  ): Promise<boolean> => {
    const {
      scale = 2,
      backgroundColor = '#ffffff',
      filename = `screenshot-${new Date().toISOString().slice(0, 10)}.png`,
      prepare,
    } = options;

    if (!elementRef.current) return false;
    
    // Screenshots might not work properly offline in some browsers
    // but we'll still try while warning the user
    if (!isOnline) {
      showToast('You are offline. The screenshot might not save correctly in some browsers.', 'info');
    }

    try {
      // 1. Capture the original element
      const originalCanvas = await html2canvas(elementRef.current, {
        scale,
        backgroundColor,
        scrollY: -window.scrollY,
        useCORS: true,
        onclone: (_document, element) => {
          // Apply any custom preparation function
          if (prepare) {
            prepare(element);
          }
        },
        removeContainer: true,
        logging: false,
      });

      // 2. Prepare watermark details
      const watermarkText = '0.0 inda.alan.ooo';
      const fontSize = 16; // pixels - Increased size
      const verticalPadding = 8; // pixels top/bottom inside watermark area - Increased padding
      const watermarkHeight = fontSize + (verticalPadding * 2);

      // 3. Create the final canvas (taller)
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = originalCanvas.width;
      finalCanvas.height = originalCanvas.height + watermarkHeight;
      const finalCtx = finalCanvas.getContext('2d');

      if (!finalCtx) {
        console.error('Could not get 2D context for final canvas.');
        return false;
      }

      // 4. Draw original content onto final canvas
      // Ensure the original canvas background is drawn if it's transparent
      finalCtx.fillStyle = backgroundColor || '#ffffff';
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height); // Fill background first
      finalCtx.drawImage(originalCanvas, 0, 0);

      // 5. Draw watermark background (footer area)
      finalCtx.fillStyle = '#000000'; // Black background
      finalCtx.fillRect(0, originalCanvas.height, finalCanvas.width, watermarkHeight);

      // 6. Draw watermark text
      finalCtx.fillStyle = '#FFFFFF'; // White text
      finalCtx.font = `${fontSize}px Arial`;
      finalCtx.textAlign = 'center';
      finalCtx.textBaseline = 'middle'; // Align vertically in the middle of the footer area
      finalCtx.fillText(watermarkText, finalCanvas.width / 2, originalCanvas.height + watermarkHeight / 2);

      // 7. Convert final canvas to blob and trigger download
      return new Promise<boolean>((resolve) => {
        finalCanvas.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create blob from final canvas.');
            resolve(false);
            return;
          }
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          
          // Cleanup
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          resolve(true);
        }, 'image/png');
      });
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return false;
    }
  };

  return { takeScreenshot };
}
