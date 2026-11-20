# AMISE Impresora (Windows)

Programa que recibe las órdenes de impresión de etiquetas de AMISE (teléfono que arma lotes, admin y caja) y las imprime en una impresora de etiquetas conectada por USB a esta PC.

## Cómo se ejecuta
1. Se instala una vez con `AMISE-Impresora-Setup-x.y.z.exe`. Windows puede avisar "Windows protegió su PC": toca **Más información → Ejecutar de todas formas** (el instalador no tiene firma digital).
2. Queda como icono junto al reloj y **arranca solo** al prender la PC. Cerrar la ventana solo la esconde; "Salir" en el icono lo detiene.
3. Primera vez:
   - En admin → Accesos → Impresoras se crea una y se copia su **código de vinculación** (empieza con `AMISE1.`).
   - Se pega en el programa y se toca **Vincular**.
   - Se elige la impresora de Windows (o **Preparar impresora USB…**, que crea "Etiquetas AMISE" con el driver genérico de Windows).
   - Se toca **Imprimir prueba**.
4. Desde ahí imprime cada orden en cuanto llega. "Pausar" deja las órdenes esperando en la cola.
5. Si cambian el cable de la impresora a **otro puerto USB**, Windows le da otro puerto (por ejemplo USB006) y "Etiquetas AMISE" se queda en el de antes, donde ya no hay nada: no imprime aunque esté prendida. El programa lo detecta al conectar o quitar el cable, cada 5 minutos y cuando una orden no sale:
   - Avisa junto al reloj y en su ventana, con el botón **Usar USB006** (Windows pide permiso de administrador).
   - La orden que no salió dice qué pasó y qué hacer; ya arreglado, se pide otra vez con **Reimprimir**.
   - Al quitar el cable, Windows pone la impresora en **"Usar impresora sin conexión"** y cambiarla de puerto no lo quita: así guarda las órdenes y no las manda. **Usar USB006** también se lo quita. Si se queda así (conectada pero "sin conexión"), el programa lo dice y trae **Ponerla en línea**.

## Cómo funciona
- Comandos TSPL en texto (etiqueta 29 × 14 mm), los mismos de la app Android "codigos". Están en `shared/src/tspl.ts`.
- `raw-print.exe` (fuente en `ayudante/RawPrint.cs`) los manda tal cual por la cola de Windows (RAW). Se compila con el `csc.exe` que trae Windows.
- La cola vive en Firestore (`impresiones_web_new_version`). Al tomar una orden de etiquetas de lote, el programa aparta los números con el mismo contador del PDF de admin. Las reglas revisan que cuadren.
- El código de vinculación se guarda cifrado con DPAPI (`safeStorage`). La sesión es un usuario con permisos limitados (rol `enlace`, tipo `imprimir`), nunca una llave de servicio.
- La bitácora queda en `%APPDATA%\AMISE Impresora\registro.log`.

## Desarrollo
```bash
npm install
npm run build        # dist/ (main, preload, ventana y raw-print.exe)
npm test             # pruebas puras
npm run typecheck
npm start            # abre el programa contra PRODUCCIÓN
npx electron . --emuladores --a-archivo=C:\ruta\salida   # pruebas: emuladores y comandos a archivo
npm run dist         # instalador en dist/instalador/
```
Con `--a-archivo`, la variable `AMISE_IMPRESORA_PUERTOS_PRUEBA=C:\ruta\puertos.json` pone puertos USB de mentira (la misma forma que da el script de puertos). Así se prueba el cambio de puerto sin tocar Windows. En ese modo, "Preparar" solo cambia ese archivo.
Los iconos se generan con `node scripts/icono.mjs` (ya están en `recursos/`).
