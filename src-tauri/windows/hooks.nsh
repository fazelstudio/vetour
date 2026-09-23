!macro NSIS_HOOK_POSTINSTALL
  ; Register .obsipano file icon
  WriteRegStr HKCR ".obsipano" "" "obsipanofile"
  WriteRegStr HKCR "obsipanofile" "" "Obsipano Project"
  WriteRegStr HKCR "obsipanofile\DefaultIcon" "" "$INSTDIR\obsipano-file.ico"
  WriteRegStr HKCR "obsipanofile\shell\open\command" "" '"$INSTDIR\${MAINEXECUTABLE}" "%1"'
  
  ; Refresh shell icons to apply file association icon immediately
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  MessageBox MB_YESNO|MB_ICONQUESTION "Delete all saved projects and app settings?" /SD IDNO IDYES setDelete
  StrCpy $R0 "keep"
  Goto done
  setDelete:
    StrCpy $R0 "delete"
  done:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove .obsipano file association
  DeleteRegKey HKCR ".obsipano"
  DeleteRegKey HKCR "obsipanofile"

  ; Refresh shell icons
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

  ; Delete user data if user chose yes
  StrCmp $R0 "delete" "" skipData
    RMDir /r "$APPDATA\${APP_HOME}"
    RMDir /r "$LOCALAPPDATA\${APP_HOME}"
  skipData:
!macroend
