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
      const canvas = await html2canvas(elementRef.current, {
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

      // Convert canvas to blob and trigger download
      return new Promise<boolean>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
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
