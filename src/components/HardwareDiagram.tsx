import React, { useEffect, useRef } from 'react';
import { EspBellConfig } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

interface HardwareDiagramProps {
  config: EspBellConfig;
}

/**
 * HardwareDiagram Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/hardware.html
 */
export const HardwareDiagram: React.FC<HardwareDiagramProps> = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('hardware');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const binder = bindTemplate(containerRef.current, html, {
          data: {},
          actions: {},
        });

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to load /templates/hardware.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, []);

  return <div ref={containerRef} id="hardware-diagram-container" className="w-full" />;
};
