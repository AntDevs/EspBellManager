import React, { useEffect, useRef } from 'react';
import { AudioTrackInfo, EspBellConfig, SystemStatus } from '../types';
import { loadHtmlTemplate, bindTemplate } from '../utils/templateBinder';

interface DoorbellSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrackInfo;
  config: EspBellConfig;
  systemStatus: SystemStatus;
  isPlaying: boolean;
  onTriggerBellRing: () => void;
  onStopTrack: () => void;
}

/**
 * DoorbellSimulatorModal Controller (Option 2: Pure HTML Template + Data Binding)
 * Zero JSX markup: The DOM structure is loaded dynamically from /public/templates/doorbell-modal.html
 */
export const DoorbellSimulatorModal: React.FC<DoorbellSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  config,
  systemStatus,
  isPlaying,
  onTriggerBellRing,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const binderRef = useRef<{ update: (data: any) => void; destroy: () => void } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (binderRef.current) {
        binderRef.current.destroy();
        binderRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const html = await loadHtmlTemplate('doorbell-modal');
        if (!isMounted || !containerRef.current) return;

        if (binderRef.current) {
          binderRef.current.destroy();
        }

        const dataModel = {
          track: {
            title: currentTrack.title,
            filename: currentTrack.filename,
          },
          power: {
            badge: systemStatus.relayState ? 'GPIO4 LATCH ACTIVE' : 'GPIO4 OPEN',
          },
          config: {
            gainStr: `${Math.round(config.gain_scale * 100)}%`,
          },
        };

        const binder = bindTemplate(containerRef.current, html, {
          data: dataModel,
          actions: {
            closeModal: () => {
              onClose();
            },
            triggerRing: () => {
              onTriggerBellRing();
            },
          },
        });

        binderRef.current = binder;
      } catch (err) {
        console.error('Failed to load /templates/doorbell-modal.html:', err);
      }
    }

    mount();

    return () => {
      isMounted = false;
      if (binderRef.current) {
        binderRef.current.destroy();
      }
    };
  }, [isOpen, config, currentTrack, systemStatus, onClose, onTriggerBellRing]);

  if (!isOpen) return null;

  return <div ref={containerRef} id="doorbell-simulator-modal-container" />;
};
