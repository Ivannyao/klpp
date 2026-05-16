@echo off
chcp 65001 > nul
echo Сохранение изменений...
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "update"
"C:\Program Files\Git\cmd\git.exe" push origin main
echo Готово!
pause
