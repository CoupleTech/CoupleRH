import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function UpdateNotifier() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial version when app loads
    fetch('/version.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        setCurrentVersion(data.version);
      })
      .catch(() => console.warn('Could not fetch initial version'));
  }, []);

  useEffect(() => {
    if (!currentVersion) return;

    const intervalId = setInterval(() => {
      fetch('/version.json?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
          if (data.version && data.version !== currentVersion) {
            // New version detected!
            toast.message('Nova atualização disponível!', {
              description: 'O sistema foi atualizado. Atualize a página para obter as novidades.',
              duration: Infinity,
              action: {
                label: 'Recarregar Agora',
                onClick: () => window.location.reload(),
              },
            });
            // Stop polling once we notified the user
            clearInterval(intervalId);
          }
        })
        .catch(() => {
          // ignore errors (e.g. offline)
        });
    }, 60000); // Check every 60 seconds

    return () => clearInterval(intervalId);
  }, [currentVersion]);

  return null; // This component does not render anything visible
}
