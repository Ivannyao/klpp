@echo off
chcp 65001 > nul
echo Скачивание изменений от друга...
"C:\Program Files\Git\cmd\git.exe" pull origin main
echo Готово!
pause
