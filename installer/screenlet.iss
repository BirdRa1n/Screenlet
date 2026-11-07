; Instalador do Screenlet para Windows (Inno Setup 6).
; Gerado por scripts/package-win.ps1, que passa:
;   /DAppVersion=2.0.0  /DSourceDir=<pasta do windeployqt>  /DOutputDir=<saída>
;
; Substitui a versão Electron (electron-builder/NSIS):
;  - instala por usuário na mesma pasta (%LOCALAPPDATA%\Programs\Screenlet), com
;    Screenlet.exe na raiz, para atalhos fixados e o "iniciar com o Windows"
;    antigos continuarem válidos;
;  - antes de copiar, desinstala em silêncio a versão Electron (HKCU ou HKLM) e
;    espera ela terminar;
;  - os dados (Documentos\Screenlet e %APPDATA%\Screenlet) são os mesmos e não
;    são tocados.
; O electron-updater da versão antiga baixa este instalador pelo latest.yml da
; release e o executa com "--updated", que o Inno ignora.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\build\dist\win\Screenlet"
#endif
#ifndef OutputDir
  #define OutputDir "..\build\dist"
#endif

[Setup]
AppId={{6F1C2B7E-5A2D-4C8B-9E31-7D0B5C4A9F21}
AppName=Screenlet
AppVersion={#AppVersion}
AppVerName=Screenlet {#AppVersion}
AppPublisher=Screenlet
AppPublisherURL=https://github.com/BirdRa1n/Screenlet
AppSupportURL=https://github.com/BirdRa1n/Screenlet/issues
AppUpdatesURL=https://github.com/BirdRa1n/Screenlet/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\Screenlet
DefaultGroupName=Screenlet
DisableProgramGroupPage=yes
; Por usuário, como o electron-builder fazia: sem UAC e mesma pasta.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=Screenlet-Setup-{#AppVersion}
SetupIconFile=..\resources\icon.ico
UninstallDisplayIcon={app}\Screenlet.exe
UninstallDisplayName=Screenlet
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; Restos da versão Electron que o desinstalador dela não apagou.
Type: filesandordirs; Name: "{app}\resources"
Type: filesandordirs; Name: "{app}\locales"
Type: files; Name: "{app}\Uninstall Screenlet.exe"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Screenlet"; Filename: "{app}\Screenlet.exe"
Name: "{autodesktop}\Screenlet"; Filename: "{app}\Screenlet.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Screenlet.exe"; Description: "{cm:LaunchProgram,Screenlet}"; Flags: nowait postinstall skipifsilent

[Code]
const
  UninstKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall';
  RunKey = 'Software\Microsoft\Windows\CurrentVersion\Run';
  GpuPrefKey = 'Software\Microsoft\DirectX\UserGpuPreferences';
  ElectronUninstaller = 'Uninstall Screenlet.exe';

// Entrada de desinstalação da versão Electron (electron-builder grava
// DisplayName "Screenlet <versão>" e o "Uninstall Screenlet.exe").
function FindElectron(RootKey: Integer; var SubKey, Cmd, InstDir: String): Boolean;
var
  Names: TArrayOfString;
  I: Integer;
  Name, Un, Quiet: String;
begin
  Result := False;
  if not RegGetSubkeyNames(RootKey, UninstKey, Names) then
    Exit;
  for I := 0 to GetArrayLength(Names) - 1 do
  begin
    SubKey := UninstKey + '\' + Names[I];
    if RegQueryStringValue(RootKey, SubKey, 'DisplayName', Name) and (Pos('Screenlet', Name) = 1)
      and RegQueryStringValue(RootKey, SubKey, 'UninstallString', Un) and (Pos(ElectronUninstaller, Un) > 0) then
    begin
      if not RegQueryStringValue(RootKey, SubKey, 'QuietUninstallString', Quiet) or (Quiet = '') then
        Quiet := Un + ' /S';
      Cmd := Quiet;
      InstDir := '';
      RegQueryStringValue(RootKey, SubKey, 'InstallLocation', InstDir);
      Result := True;
      Exit;
    end;
  end;
end;

// "C:\x\Uninstall Screenlet.exe" /currentuser /S → exe + parâmetros.
procedure SplitCommand(const Cmd: String; var Exe, Params: String);
var
  P: Integer;
  S: String;
begin
  S := Trim(Cmd);
  if (Length(S) > 0) and (S[1] = '"') then
  begin
    Delete(S, 1, 1);
    P := Pos('"', S);
    Exe := Copy(S, 1, P - 1);
    Params := Trim(Copy(S, P + 1, Length(S)));
  end
  else
  begin
    P := Pos(' /', S);
    if P > 0 then
    begin
      Exe := Copy(S, 1, P - 1);
      Params := Trim(Copy(S, P + 1, Length(S)));
    end
    else
    begin
      Exe := S;
      Params := '';
    end;
  end;
end;

function RemoveElectron(RootKey: Integer): String;
var
  SubKey, Cmd, InstDir, Exe, Params: String;
  Code, Waited: Integer;
begin
  Result := '';
  if not FindElectron(RootKey, SubKey, Cmd, InstDir) then
    Exit;
  SplitCommand(Cmd, Exe, Params);
  // O electron-builder nem sempre grava InstallLocation.
  if InstDir = '' then
    InstDir := ExtractFileDir(Exe);
  Log('Removendo a versão Electron: ' + Exe + ' ' + Params);
  // ShellExec respeita o manifesto: a desinstalação "para todos os usuários"
  // pede o UAC sozinha.
  if not ShellExec('', Exe, Params, '', SW_HIDE, ewWaitUntilTerminated, Code) then
  begin
    Result := 'Não foi possível remover a versão anterior do Screenlet (' + SysErrorMessage(Code) + '). Desinstale-a pelo Painel de Controle e tente de novo.';
    Exit;
  end;
  // O desinstalador NSIS se copia para a pasta temporária e volta na hora:
  // espera a entrada sumir para não disputar a pasta com ele.
  Waited := 0;
  while (RegKeyExists(RootKey, SubKey) or ((InstDir <> '') and FileExists(AddBackslash(InstDir) + ElectronUninstaller)))
    and (Waited < 120000) do
  begin
    Sleep(500);
    Waited := Waited + 500;
  end;
  if RegKeyExists(RootKey, SubKey) then
    Result := 'A versão anterior do Screenlet não terminou de ser removida. Desinstale-a pelo Painel de Controle e tente de novo.';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := RemoveElectron(HKEY_CURRENT_USER);
  if Result = '' then
    Result := RemoveElectron(HKEY_LOCAL_MACHINE);
end;

// O Electron registrava o "iniciar com o Windows" com outro nome; o app novo
// usa "Screenlet". Renomeia para não abrir duas vezes no login.
procedure MigrateLoginItem();
var
  Names: TArrayOfString;
  I: Integer;
  Data, Exe: String;
begin
  Exe := Lowercase(ExpandConstant('{app}\Screenlet.exe'));
  if not RegGetValueNames(HKEY_CURRENT_USER, RunKey, Names) then
    Exit;
  for I := 0 to GetArrayLength(Names) - 1 do
    if (Names[I] <> 'Screenlet') and RegQueryStringValue(HKEY_CURRENT_USER, RunKey, Names[I], Data)
      and (Pos(Exe, Lowercase(Data)) > 0) then
    begin
      RegDeleteValue(HKEY_CURRENT_USER, RunKey, Names[I]);
      RegWriteStringValue(HKEY_CURRENT_USER, RunKey, 'Screenlet', '"' + ExpandConstant('{app}\Screenlet.exe') + '" --hidden');
    end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    MigrateLoginItem();
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteValue(HKEY_CURRENT_USER, RunKey, 'Screenlet');
    RegDeleteValue(HKEY_CURRENT_USER, GpuPrefKey, ExpandConstant('{app}\Screenlet.exe'));
  end;
end;
