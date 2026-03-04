package pagoTarjeta;

import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.dantsu.escposprinter.connection.DeviceConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;

import async.AsyncBluetoothEscPosPrint;
import async.AsyncEscPosPrinter;

public class uno {
    public static BluetoothConnection selectedDevice_static = null;
    public static String bluetooth_device = null;
    public static final int PERMISSION_BLUETOOTH = 1;
    Activity activity;
    Context context;
    public void printBluetooth(Activity activity, JSONArray jsonArray, JSONObject object, Context context) {
        this.activity = activity;
        this.context  = context;
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.BLUETOOTH}, PERMISSION_BLUETOOTH);
        } else {
            // this.printIt(BluetoothPrintersConnections.selectFirstPaired());
            new AsyncBluetoothEscPosPrint(activity).execute(this.getAsyncEscPosPrinter(selectedDevice_static, jsonArray, object, context));
        }
    }

    public AsyncEscPosPrinter getAsyncEscPosPrinter(
            DeviceConnection printerConnection,
            JSONArray jsonArray,
            JSONObject object_datos,
            Context context) {
        AsyncEscPosPrinter printer = new AsyncEscPosPrinter(printerConnection, 203, 48f, 32);

        String s = "";
        int descInt = 0;
        String mayoreo = "mayoreo", mayoreoAply = mayoreo+"Aply";

        for(int x = 0; x < jsonArray.length(); x++){
            try {
                JSONObject object = jsonArray.getJSONObject(x);
                String descProducto = "";

                String cant = object.getString("cantidad");
                for(int i = 0; i < (11 - cant.length()); i++) {cant = cant + " ";}

                descProducto = object.getString("descripcion");

                String desc = "";
                if(!object.has("numeroAp")){
                    desc = object.getString("nombrePublico");
                }else desc = object.getString("nombreAP");

                if(desc.length() > 12)desc = desc.substring(0, 12) + ".. ";
                else desc = desc + " ";

                s = s + "[L]"+ cant + desc +
                        descProducto
                        +"\n" +
                        "             " + "$ "+ object.getString("precio") + ".00" +"[R]"+//cantidad
                        "$ " +
                        String.valueOf(
                                Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(object.getString("precio"))) +
                        "" + ".00\n" +
                        "[C]\n";

                for(int i = 0; i < (11 - cant.length()); i++) {cant = cant + " ";}


                if(descProducto.length() > 10)descProducto = descProducto.substring(0, 10);


                if(!object.has("numeroAp") && !object.has("no_registrado")){

                    String id_art = object.getString("id");

                    if(object.has(mayoreoAply)){
                        String mayoreoString = String.valueOf(Integer.parseInt(jsonArticulos.getJSONObject(id_art).getString(mayoreo)));
                        s = s + "[L]"+ cant + "MAYOREO"
                                +"\n" +
                                "             " + "$ "+ mayoreoString + ".00" +"[R]"+
                                "$ "+ String.valueOf(
                                Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(mayoreoString)
                        ) + "" + ".00\n" +
                                "[C]\n";
                    } else  if(jsonArticulos.getJSONObject(id_art).has("descuento")){
                        String descuento = String.valueOf(
                                Integer.parseInt(object.getString("precio")) - Integer.parseInt(jsonArticulos.getJSONObject(id_art).getString("descuento")));
                        descInt = descInt + Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(descuento);
                        s = s + "[L]"+ cant + "DESCUENTO"
                                +"\n" +
                                "             " + "-$ "+ descuento + ".00" +"[R]"+
                                "-$ "+ String.valueOf(
                                Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(descuento)
                        ) + "" + ".00\n" +
                                "[C]\n";
                    }

                }else {
                    if(object_datos.has("abono")){

                    }else {

                    }
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        String tipodepago = "EFECTIVO";
        String comision  = "";
        String total     = "";


        try {
            total                       = object_datos.getString("montoCobro");
            String grantotal            = "";
            String pago                 = object_datos.getString("montoPago");
            String cambio               = String.valueOf(Integer.parseInt(pago) - Integer.parseInt(total));
            String datos_intermedios    = "";

            String nameTienda = "NOMBRE NEGOCIO",direccion = "DIRECCION";
            String ms1 = "Encuentranos en:", ms2 = "EJEMPLO 1", ms3 = "EJEMPLO 2", ms4 = "VUELVA PRONTO";


            if(jsonDatos.length() > 0){
                JSONObject datos = returnString(context.getString(R.string.datosTicket));
                if (datos != null){
                    try {
                        for (int i = 0; i < datos.names().length(); i++){
                            if(datos.has(context.getString(R.string.ticket_1)))nameTienda   = datos.getString(context.getString(R.string.ticket_1));
                            if(datos.has(context.getString(R.string.ticket_2)))direccion    = datos.getString(context.getString(R.string.ticket_2));
                            if(datos.has(context.getString(R.string.ticket_3)))ms1          = datos.getString(context.getString(R.string.ticket_3));
                            if(datos.has(context.getString(R.string.ticket_4)))ms2          = datos.getString(context.getString(R.string.ticket_4));
                            if(datos.has(context.getString(R.string.ticket_5)))ms3          = datos.getString(context.getString(R.string.ticket_5));
                            if(datos.has(context.getString(R.string.ticket_6)))ms4          = datos.getString(context.getString(R.string.ticket_6));
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    };
                }
            }

            datos_intermedios = comision +
                    "[R]TOTAL  :[R]" + "$" + total + ".00"+"\n"+
                    grantotal +
                    "[R]PAGO   :[R]" + "$" + pago + ".00"+"\n"+
                    "[R]CAMBIO :[R]" + "$" + cambio + ".00"+"\n";

            String textogeneralUno =
                    //"[C]<img>" + PrinterTextParserImg.bitmapToHexadecimalString(printer, this.activity.getResources().getDrawableForDensity(R.drawable.amisetpeq, DisplayMetrics.DENSITY_MEDIUM)) + "</img>\n" +
                    "[L]\n" +
                            "[C]" + nameTienda + "\n" +
                            "[L]\n" +
                            "[C]" + direccion + "\n" +
                            "[C]" + DateFormat.getDateTimeInstance().format(new Date()) + "\n" +
                            "[L]\n" +
                            "[C]TIPO DE PAGO: " + tipodepago +  "[C]" +"\n" + "[L]\n" +
                            "[C]CANT   DESC.    P/U      IMPORTE\n" +
                            "[C]\n" +
                            s +
                            "[L]\n";

            String textogeneralDos =
                    "[L]\n" +
                            "[C]"+ ms1        +"\n" +
                            "[C]"+ ms2 +  "     \n" +
                            "[C]"+ ms3 +"   " +"\n" +
                            "[C]\n" +
                            "[C]"+ ms4+"\n" +  "[C]\n" +  "[C]\n" +  "[C]\n";



            String result =
                    textogeneralUno
                            +
                            datos_intermedios
                            +
                            textogeneralDos;
            return printer.setTextToPrint(result);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private JSONObject returnString(String string){
        JSONObject s = new JSONObject();
        if(!loadData_sharedPreferences(context, string, string).equals("")){
            try {
                s = new JSONObject(loadData_sharedPreferences(context, string, string));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            s = null;
        }
        return  s;
    }
}
