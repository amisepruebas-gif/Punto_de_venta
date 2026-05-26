@echo off
chcp 65001 > nul
setlocal

echo ============================================================
echo  Setup IAM — Service Account Token Creator
echo ============================================================
echo.
echo Paso 1: Login con gcloud usando jesuscentenoramirez@gmail.com
echo Se abrira el navegador. Acepta el login.
echo.
pause

gcloud auth login jesuscentenoramirez@gmail.com
if errorlevel 1 (
    echo.
    echo ERROR: Login fallo. Cierra y reintenta.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Paso 2: Asignando rol Service Account Token Creator...
echo ============================================================
echo.

gcloud projects add-iam-policy-binding amisetienda-c7eab ^
    --member="serviceAccount:201997907687-compute@developer.gserviceaccount.com" ^
    --role="roles/iam.serviceAccountTokenCreator"

if errorlevel 1 (
    echo.
    echo ERROR: No se pudo asignar el rol.
    echo Revisa que la cuenta jesuscentenoramirez@gmail.com tenga permisos
    echo de Owner/Editor sobre el proyecto amisetienda-c7eab.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  LISTO
echo ============================================================
echo.
echo Vuelve al navegador y reintenta "Registrar nodo" en el nodo-web.
echo.
pause
