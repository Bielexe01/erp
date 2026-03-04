!macro customInit
  ; Close running app processes to prevent installer blocking dialog.
  nsExec::ExecToLog 'cmd /C taskkill /F /IM ERP.exe >nul 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM electron.exe >nul 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM Update.exe >nul 2>&1'
!macroend

