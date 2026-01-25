# Create startup shortcuts for ITSM-System servers
$StartupPath = [Environment]::GetFolderPath('Startup')
$WshShell = New-Object -ComObject WScript.Shell

# Development Server Shortcut
$DevShortcut = $WshShell.CreateShortcut("$StartupPath\ITSM-DevServer.lnk")
$DevShortcut.TargetPath = "Z:\ITSM-System\scripts\start-dev-server.bat"
$DevShortcut.WorkingDirectory = "Z:\ITSM-System"
$DevShortcut.WindowStyle = 7  # Minimized
$DevShortcut.Description = "ITSM-System Development Server (Port 5443)"
$DevShortcut.Save()
Write-Host "Created: $StartupPath\ITSM-DevServer.lnk"

# Production Server Shortcut
$ProdShortcut = $WshShell.CreateShortcut("$StartupPath\ITSM-ProdServer.lnk")
$ProdShortcut.TargetPath = "Z:\ITSM-System\scripts\start-prod-server.bat"
$ProdShortcut.WorkingDirectory = "Z:\ITSM-System"
$ProdShortcut.WindowStyle = 7  # Minimized
$ProdShortcut.Description = "ITSM-System Production Server (Port 6443)"
$ProdShortcut.Save()
Write-Host "Created: $StartupPath\ITSM-ProdServer.lnk"

Write-Host "`nStartup shortcuts created successfully!"
Write-Host "Location: $StartupPath"
