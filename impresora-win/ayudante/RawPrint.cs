// Ayudante del programa "AMISE Impresora": manda un archivo TAL CUAL (RAW) a
// una impresora de Windows, por la cola de impresión. Es lo mismo que hace la
// app Android "codigos" por USB: la impresora de etiquetas interpreta los
// comandos TSPL que vienen en el archivo; Windows no los toca.
//
// Uso:   raw-print.exe "Nombre de la impresora" archivo.prn [nombre del trabajo]
// Sale:  0 y "OK" cuando el trabajo SALIÓ de la cola de Windows (se mandó a
//        la impresora); 1 y "ERROR <código> <texto>" si no.
//
// Windows acepta el trabajo aunque la impresora esté apagada o desconectada y
// lo deja esperando: por eso se espera a que salga de la cola. Si no avanza
// (error, sin papel, fuera de línea o ni empieza) se BORRA de la cola y sale
// "ERROR 9001": así no se queda atorado ni sale doble al "Reimprimir".
// "ERROR 9002": alguien lo canceló en la cola de Windows.
//
// Se compila con el csc.exe que trae Windows (.NET Framework 4), sin instalar
// nada: ver scripts/build.mjs.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

static class RawPrint
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    class DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct SYSTEMTIME
    {
        public short wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOB_INFO_1
    {
        public int JobId;
        public IntPtr pPrinterName;
        public IntPtr pMachineName;
        public IntPtr pUserName;
        public IntPtr pDocument;
        public IntPtr pDatatype;
        public IntPtr pStatus;
        public int Status;
        public int Priority;
        public int Position;
        public int TotalPages;
        public int PagesPrinted;
        public SYSTEMTIME Submitted;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool GetJob(IntPtr hPrinter, int jobId, int level, IntPtr pJob, int cbBuf, out int pcbNeeded);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SetJob(IntPtr hPrinter, int jobId, int level, IntPtr pJob, int command);

    const int JOB_STATUS_PAUSED = 0x1;
    const int JOB_STATUS_ERROR = 0x2;
    const int JOB_STATUS_DELETING = 0x4;
    const int JOB_STATUS_PRINTING = 0x10;
    const int JOB_STATUS_OFFLINE = 0x20;
    const int JOB_STATUS_PAPEROUT = 0x40;
    const int JOB_STATUS_PRINTED = 0x80;
    const int JOB_STATUS_DELETED = 0x100;
    const int JOB_STATUS_BLOCKED_DEVQ = 0x200;
    const int JOB_STATUS_USER_INTERVENTION = 0x400;
    const int JOB_STATUS_COMPLETE = 0x1000;
    const int PROBLEMA = JOB_STATUS_PAUSED | JOB_STATUS_ERROR | JOB_STATUS_OFFLINE | JOB_STATUS_PAPEROUT
        | JOB_STATUS_BLOCKED_DEVQ | JOB_STATUS_USER_INTERVENTION;
    const int JOB_CONTROL_DELETE = 5;

    // Con la impresora prendida un trabajo de etiquetas sale en ~1 s.
    const int SIN_AVANCE_MS = 12000;
    // Lo más que se espera a uno que sí está imprimiendo (300 etiquetas ~1 min).
    const int MAXIMO_MS = 240000;

    static int Falla(string paso)
    {
        int codigo = Marshal.GetLastWin32Error();
        Console.WriteLine("ERROR " + codigo + " " + paso + ": " + new Win32Exception(codigo).Message);
        return 1;
    }

    /** -1 = ya no está en la cola; si no, su Status. */
    static int EstadoTrabajo(IntPtr h, int id)
    {
        int necesita;
        GetJob(h, id, 1, IntPtr.Zero, 0, out necesita);
        if (necesita <= 0) return -1;
        IntPtr buf = Marshal.AllocHGlobal(necesita);
        try
        {
            if (!GetJob(h, id, 1, buf, necesita, out necesita)) return -1;
            JOB_INFO_1 ji = (JOB_INFO_1)Marshal.PtrToStructure(buf, typeof(JOB_INFO_1));
            return ji.Status;
        }
        finally
        {
            Marshal.FreeHGlobal(buf);
        }
    }

    static string TextoEstado(int s)
    {
        string t = "";
        if ((s & JOB_STATUS_PAUSED) != 0) t += " en pausa";
        if ((s & JOB_STATUS_ERROR) != 0) t += " error";
        if ((s & JOB_STATUS_OFFLINE) != 0) t += " fuera de línea";
        if ((s & JOB_STATUS_PAPEROUT) != 0) t += " sin papel";
        if ((s & JOB_STATUS_BLOCKED_DEVQ) != 0) t += " bloqueada";
        if ((s & JOB_STATUS_USER_INTERVENTION) != 0) t += " necesita atención";
        if ((s & JOB_STATUS_PRINTING) != 0) t += " imprimiendo";
        return "estado 0x" + s.ToString("X") + (t.Length > 0 ? " (" + t.Trim() + ")" : " (esperando)");
    }

    /** Espera a que el trabajo salga de la cola. 0 = salió; 1 = no avanzó (borrado). */
    static int EsperarQueSalga(IntPtr h, int id)
    {
        Stopwatch reloj = Stopwatch.StartNew();
        for (;;)
        {
            int s = EstadoTrabajo(h, id);
            if (s == -1 || (s & (JOB_STATUS_PRINTED | JOB_STATUS_COMPLETE)) != 0) return 0;
            if ((s & (JOB_STATUS_DELETING | JOB_STATUS_DELETED)) != 0)
            {
                Console.WriteLine("ERROR 9002 Se canceló en la cola de Windows");
                return 1;
            }
            bool problema = (s & PROBLEMA) != 0;
            bool imprimiendo = (s & JOB_STATUS_PRINTING) != 0;
            long ms = reloj.ElapsedMilliseconds;
            if ((ms >= SIN_AVANCE_MS && (problema || !imprimiendo)) || ms >= MAXIMO_MS)
            {
                bool borrado = SetJob(h, id, 0, IntPtr.Zero, JOB_CONTROL_DELETE);
                Console.WriteLine("ERROR 9001 La impresora no respondió en " + (ms / 1000) + " s, " + TextoEstado(s)
                    + (borrado ? "; se quitó de la cola de Windows" : "; NO se pudo quitar de la cola de Windows"));
                return 1;
            }
            Thread.Sleep(300);
        }
    }

    static int Main(string[] args)
    {
        // El programa lee la salida como UTF-8 (los mensajes de Windows traen acentos).
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        if (args.Length < 2)
        {
            Console.WriteLine("ERROR 0 Uso: raw-print.exe \"impresora\" archivo [nombre]");
            return 1;
        }
        string impresora = args[0];
        byte[] datos;
        try
        {
            datos = File.ReadAllBytes(args[1]);
        }
        catch (Exception e)
        {
            Console.WriteLine("ERROR 0 No se pudo leer el archivo: " + e.Message);
            return 1;
        }
        string nombre = args.Length > 2 ? args[2] : "AMISE etiquetas";

        IntPtr h;
        if (!OpenPrinter(impresora, out h, IntPtr.Zero)) return Falla("OpenPrinter");
        try
        {
            DOCINFO di = new DOCINFO();
            di.pDocName = nombre;
            di.pDataType = "RAW";
            int trabajo = StartDocPrinter(h, 1, di);
            if (trabajo == 0) return Falla("StartDocPrinter");
            bool cerrado = false;
            try
            {
                if (!StartPagePrinter(h)) return Falla("StartPagePrinter");
                int escritos;
                bool ok = WritePrinter(h, datos, datos.Length, out escritos);
                if (!ok) return Falla("WritePrinter");
                EndPagePrinter(h);
                if (escritos != datos.Length)
                {
                    Console.WriteLine("ERROR 0 Solo se mandaron " + escritos + " de " + datos.Length + " bytes");
                    return 1;
                }
                // Hasta aquí Windows solo lo ACEPTÓ. Se cierra el documento y
                // se espera a que de verdad salga hacia la impresora.
                EndDocPrinter(h);
                cerrado = true;
                if (EsperarQueSalga(h, trabajo) != 0) return 1;
            }
            finally
            {
                // Si falló a medias, que no quede un pedazo esperando en la cola.
                if (!cerrado)
                {
                    SetJob(h, trabajo, 0, IntPtr.Zero, JOB_CONTROL_DELETE);
                    EndDocPrinter(h);
                }
            }
        }
        finally
        {
            ClosePrinter(h);
        }
        Console.WriteLine("OK");
        return 0;
    }
}
