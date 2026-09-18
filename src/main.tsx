import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRoutes } from './routes'

import { Toaster } from 'sonner';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';
import { UpdateNotifier } from './components/UpdateNotifier';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmDialogProvider>
      <AppRoutes />
      <Toaster position="top-right" richColors closeButton />
      <UpdateNotifier />
    </ConfirmDialogProvider>
  </StrictMode>,
)
