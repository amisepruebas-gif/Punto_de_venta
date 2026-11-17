// Ayudante del programa "AMISE Impresora": manda un archivo TAL CUAL (RAW) a
// una impresora de Windows, por la cola de impresión. Es lo mismo que hace la
// app Android "codigos" por USB: la impresora de etiquetas interpreta los
// comandos TSPL que vienen en el archivo; Windows no los toca.
//
// Uso:   raw-print.exe "Nombre de la impresora" archivo.prn [nombre del trabajo]
// Sale:  0 y "OK" si Windows aceptó el trabajo; 1 y "ERROR <código> <texto>".
//
// Se compila con el csc.exe que trae Windows (.NET Framework 4), sin instalar
// nada: ver scripts/build.mjs.
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;

static class RawPrint
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    class DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
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

    static int Falla(string paso)
    {
        int codigo = Marshal.GetLastWin32Error();
        Console.WriteLine("ERROR " + codigo + " " + paso + ": " + new Win32Exception(codigo).Message);
        return 1;
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
            if (StartDocPrinter(h, 1, di) == 0) return Falla("StartDocPrinter");
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
            }
            finally
            {
                EndDocPrinter(h);
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
