; Formula Studio — Windows installer (per-user, no admin rights, no internet).
; Build (Linux or Windows): makensis -DSRC=<path to FormulaStudio-win32-x64> -DOUT=<setup.exe> -DVERSION=1.0.0 -DICON=<icon.ico> tools/installer.nsi
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
RequestExecutionLevel user
ManifestDPIAware true

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define APPNAME "Formula Studio"
!define EXENAME "FormulaStudio.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormulaStudio"

Name "${APPNAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\Formula Studio"
InstallDirRegKey HKCU "Software\FormulaStudio" "InstallDir"
BrandingText "${APPNAME} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=0 "FileDescription" "${APPNAME} Setup"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "CompanyName" "${APPNAME}"
VIAddVersionKey /LANG=0 "LegalCopyright" "${APPNAME}"

!include "MUI2.nsh"
!ifdef ICON
  !define MUI_ICON "${ICON}"
  !define MUI_UNICON "${ICON}"
!endif
!define MUI_ABORTWARNING
!define MUI_LANGDLL_ALLLANGUAGES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "$(RunApp)"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Turkish"
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString RunApp ${LANG_TURKISH} "Formula Studio'yu şimdi başlat"
LangString RunApp ${LANG_RUSSIAN} "Запустить Formula Studio"
LangString RunApp ${LANG_ENGLISH} "Start Formula Studio now"
LangString StillRunning ${LANG_TURKISH} "Formula Studio açık. Lütfen kapatıp Tamam'a basın."
LangString StillRunning ${LANG_RUSSIAN} "Formula Studio запущена. Закройте её и нажмите ОК."
LangString StillRunning ${LANG_ENGLISH} "Formula Studio is running. Please close it and press OK."

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd
Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

Section "Install"
  SetShellVarContext current
  ; the exe may be locked if the app is open: retry until it can be replaced
  retry:
  ClearErrors
  IfFileExists "$INSTDIR\${EXENAME}" 0 +4
    Delete "$INSTDIR\${EXENAME}"
    IfErrors 0 +2
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(StillRunning)" IDOK retry IDCANCEL done
  SetOutPath "$INSTDIR"
  File /r "${SRC}/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\FormulaStudio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" 290000
  done:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\FormulaStudio"
SectionEnd
