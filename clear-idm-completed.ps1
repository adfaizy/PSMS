Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Idm32 {
  public const uint LVM_GETITEMCOUNT = 0x1004;
  public const uint LVM_GETITEMTEXTW = 0x1073;
  public const uint LVM_SETITEMSTATE = 0x102B;
  public const uint LVIS_SELECTED = 0x0002;
  public const uint LVIF_TEXT = 0x0001;
  public const uint PROCESS_ALL = 0x38;
  public const uint MEM_COMMIT = 0x1000;
  public const uint MEM_RELEASE = 0x8000;
  public const uint PAGE_READWRITE = 0x04;
  public const int SW_RESTORE = 9;
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct LVITEM {
    public uint mask; public int iItem; public int iSubItem;
    public uint state; public uint stateMask;
    public IntPtr pszText; public int cchTextMax;
    public int iImage; public IntPtr lParam; public int iIndent;
    public int iGroupId; public uint cColumns; public IntPtr puColumns; public IntPtr piColFmt; public int iGroup;
  }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hWnd, EnumChildProc cb, IntPtr l);
  public delegate bool EnumChildProc(IntPtr hWnd, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, uint p);
  [DllImport("kernel32.dll")] public static extern IntPtr VirtualAllocEx(IntPtr h, IntPtr a, uint s, uint t, uint pr);
  [DllImport("kernel32.dll")] public static extern bool VirtualFreeEx(IntPtr h, IntPtr a, uint s, uint t);
  [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, int s, out int r);
  [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] b, int s, out int w);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetFocus(IntPtr hWnd);
  public static IntPtr FindClass(IntPtr parent, string cls) {
    IntPtr found = IntPtr.Zero;
    EnumChildProc cb = (h,l) => {
      var sb = new StringBuilder(256);
      GetClassName(h, sb, 256);
      if (sb.ToString() == cls) { found = h; return false; }
      return true;
    };
    EnumChildWindows(parent, cb, IntPtr.Zero);
    return found;
  }
  public static string GetText(IntPtr list, int item, int sub) {
    uint pid; GetWindowThreadProcessId(list, out pid);
    IntPtr hp = OpenProcess(PROCESS_ALL, false, pid);
    IntPtr rText = VirtualAllocEx(hp, IntPtr.Zero, 512, MEM_COMMIT, PAGE_READWRITE);
    IntPtr rItem = VirtualAllocEx(hp, IntPtr.Zero, (uint)Marshal.SizeOf(typeof(LVITEM)), MEM_COMMIT, PAGE_READWRITE);
    LVITEM lvi = new LVITEM();
    lvi.mask = LVIF_TEXT; lvi.iItem = item; lvi.iSubItem = sub; lvi.pszText = rText; lvi.cchTextMax = 256;
    int sz = Marshal.SizeOf(lvi);
    IntPtr local = Marshal.AllocHGlobal(sz); Marshal.StructureToPtr(lvi, local, false);
    byte[] bytes = new byte[sz]; Marshal.Copy(local, bytes, 0, sz); Marshal.FreeHGlobal(local);
    int w; WriteProcessMemory(hp, rItem, bytes, sz, out w);
    SendMessage(list, LVM_GETITEMTEXTW, (IntPtr)item, rItem);
    byte[] buf = new byte[512]; int r; ReadProcessMemory(hp, rText, buf, 512, out r);
    VirtualFreeEx(hp, rText, 0, MEM_RELEASE); VirtualFreeEx(hp, rItem, 0, MEM_RELEASE); CloseHandle(hp);
    return Encoding.Unicode.GetString(buf).TrimEnd('\0');
  }
  public static void Select(IntPtr list, int item, bool on) {
    uint pid; GetWindowThreadProcessId(list, out pid);
    IntPtr hp = OpenProcess(PROCESS_ALL, false, pid);
    IntPtr rItem = VirtualAllocEx(hp, IntPtr.Zero, (uint)Marshal.SizeOf(typeof(LVITEM)), MEM_COMMIT, PAGE_READWRITE);
    LVITEM lvi = new LVITEM(); lvi.stateMask = LVIS_SELECTED; lvi.state = on ? LVIS_SELECTED : 0u;
    int sz = Marshal.SizeOf(lvi); IntPtr local = Marshal.AllocHGlobal(sz); Marshal.StructureToPtr(lvi, local, false);
    byte[] bytes = new byte[sz]; Marshal.Copy(local, bytes, 0, sz); Marshal.FreeHGlobal(local);
    int w; WriteProcessMemory(hp, rItem, bytes, sz, out w);
    SendMessage(list, LVM_SETITEMSTATE, (IntPtr)item, rItem);
    VirtualFreeEx(hp, rItem, 0, MEM_RELEASE); CloseHandle(hp);
  }
}
"@

$proc = Get-Process IDMan -ErrorAction Stop
$hwnd = $proc.MainWindowHandle
[Idm32]::ShowWindow($hwnd, 9) | Out-Null
[Idm32]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 400

$list = [Idm32]::FindClass($hwnd, 'SysListView32')
$count = [Idm32]::SendMessage($list, [Idm32]::LVM_GETITEMCOUNT, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32()
Write-Output "Items=$count List=$list Is32Bit=$([IntPtr]::Size -eq 4)"

$completed = New-Object System.Collections.Generic.List[int]
for ($i = 0; $i -lt $count; $i++) {
  $cols = @()
  for ($c = 0; $c -le 5; $c++) { $cols += [Idm32]::GetText($list, $i, $c) }
  Write-Output ("[$i] " + ($cols -join ' | '))
  if ($cols -contains 'Complete') { $completed.Add($i) }
}

Write-Output ("COMPLETED_COUNT=" + $completed.Count)
Write-Output ("COMPLETED_IDX=" + ($completed -join ','))

if ($completed.Count -eq 0) {
  Write-Output 'No completed items found (or text read failed).'
  exit 2
}

for ($i = 0; $i -lt $count; $i++) { [Idm32]::Select($list, $i, $false) }
foreach ($i in $completed) { [Idm32]::Select($list, $i, $true) }

[Idm32]::SetForegroundWindow($hwnd) | Out-Null
[Idm32]::SetFocus($list) | Out-Null
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('{DELETE}')
Start-Sleep -Milliseconds 900
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('y')
Start-Sleep -Milliseconds 600

$newCount = [Idm32]::SendMessage($list, [Idm32]::LVM_GETITEMCOUNT, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32()
Write-Output "ItemsAfter=$newCount"
