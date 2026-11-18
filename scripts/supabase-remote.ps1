# =============================================================================
# supabase-remote.ps1 — ejecuta SQL en el proyecto Supabase vinculado
# =============================================================================
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\supabase-remote.ps1 -SqlFile ruta\consulta.sql
#   powershell -ExecutionPolicy Bypass -File scripts\supabase-remote.ps1 -Sql "select 1"
#
# Usa la Management API (POST /v1/projects/{ref}/database/query) con el token
# que guarda el CLI de Supabase en el Credential Manager de Windows
# ("Supabase CLI:supabase"). NUNCA imprime el token: solo resultados.
#
# El SQL se envía tal cual (el endpoint acepta lotes multi-sentencia, como el
# editor SQL del dashboard). Imprime la respuesta JSON o el error.
# =============================================================================

param(
  [string]$Sql = "",
  [string]$SqlFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $Sql -and -not $SqlFile) { Write-Error "Falta -Sql o -SqlFile"; exit 2 }
if ($SqlFile) {
  if (-not (Test-Path $SqlFile)) { Write-Error "No existe: $SqlFile"; exit 2 }
  $Sql = [System.IO.File]::ReadAllText((Resolve-Path $SqlFile))
}
if (-not $Sql.Trim()) { Write-Error "SQL vacío"; exit 2 }

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SbCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
    [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
    public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
    [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, int type, int reserved, out IntPtr credential);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);
}
'@

$p = [IntPtr]::Zero
if (-not [SbCred]::CredRead("Supabase CLI:supabase", 1, 0, [ref]$p)) {
  Write-Error "No hay token del CLI en el Credential Manager (target: 'Supabase CLI:supabase')."
  exit 3
}
$c = [System.Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][SbCred+CREDENTIAL])
$bytes = New-Object byte[] $c.CredentialBlobSize
[System.Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $bytes, 0, $c.CredentialBlobSize)
[SbCred]::CredFree($p)
$tok = [System.Text.Encoding]::UTF8.GetString($bytes).TrimEnd([char]0).Trim()
if ($tok -notmatch '^sbp_') { $tok = [System.Text.Encoding]::Unicode.GetString($bytes).TrimEnd([char]0).Trim() }
if ($tok -notmatch '^sbp_') { Write-Error "Token ilegible en el Credential Manager."; exit 3 }

$ref = "xpphnsozqnajfxjqvtci"
$body = @{ query = $Sql } | ConvertTo-Json -Compress

try {
  $q = Invoke-RestMethod `
    -Uri "https://api.supabase.com/v1/projects/$ref/database/query" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $tok" } `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120
  $q | ConvertTo-Json -Depth 12
  exit 0
} catch {
  $msg = $_.Exception.Message
  $detail = ""
  try { $detail = $_.ErrorDetails.Message } catch {}
  Write-Output "SQL_ERR: $msg"
  if ($detail) { Write-Output "DETAIL: $detail" }
  exit 1
}
