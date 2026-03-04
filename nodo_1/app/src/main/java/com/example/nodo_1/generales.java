package com.example.nodo_1;

import static android.content.Context.MODE_PRIVATE;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonMensajes_n;

import static pagoTarjeta.uno.selectedDevice_static;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Random;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicInteger;

public class generales {

    public static void recyclerVertical(RecyclerView recyclerView, Context context){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
    }
    public static void recyclerHorizontal(RecyclerView recyclerView, Context context){
        LinearLayoutManager layoutManager = new LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false);
        recyclerView.setLayoutManager(layoutManager);
    }
    public static void recyclerHorizontal_2(RecyclerView recyclerView, Context context){
        //recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false));
    }
    public static void toast(String mensaje, Context context) {
        Toast toast = Toast.makeText(context, mensaje, Toast.LENGTH_LONG);
        toast.setGravity(Gravity.CENTER_HORIZONTAL, 0, 0);
        toast.show();
    }
    public static ArrayList<String> init_getArrayList_AutocompleteCodigo(){
        ArrayList<String> array_list = new ArrayList<>();
        for(int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                String liga = "null";
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    liga = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla");
                }
                array_list.add(jsonArticulos.names().getString(i) + " "
                        + jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("nombre") + " "
                        + jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("referencia") + " "
                        + liga
                );
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        return array_list;
    }
    public static String formatearFecha(String fechaInput) {
        if (fechaInput == null || fechaInput.isEmpty()) {
            return null;
        }

        try {
            // Definir el formato de entrada
            SimpleDateFormat formatoEntrada = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());

            // Parsear la fecha de entrada
            Date fecha = formatoEntrada.parse(fechaInput);

            // Definir el formato de salida
            SimpleDateFormat formatoSalida = new SimpleDateFormat("EEEE d 'de' MMMM 'del' yyyy", new Locale("es", "ES"));

            // Formatear la fecha de salida
            String fechaFormateada = formatoSalida.format(fecha);

            // Capitalizar la primera letra de cada palabra
            fechaFormateada = capitalizarPrimeraLetraDeCadaPalabra(fechaFormateada);

            return fechaFormateada;
        } catch (ParseException e) {
            e.printStackTrace();
            return null;
        }
    }
    /**
     * Capitaliza la primera letra de cada palabra en una cadena.
     *
     * @param str La cadena de entrada.
     * @return La cadena con la primera letra de cada palabra en mayúsculas.
     */
    private static String capitalizarPrimeraLetraDeCadaPalabra(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }

        String[] palabras = str.toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();

        for (String palabra : palabras) {
            if (palabra.length() > 0) {
                sb.append(Character.toUpperCase(palabra.charAt(0)))
                        .append(palabra.substring(1))
                        .append(" ");
            }
        }

        return sb.toString().trim();
    }
    public static String diasIngEsp(int dia){
        String s = "";
        switch (dia) {
            case Calendar.MONDAY:
                s = "Lunes";
                break;
            case Calendar.TUESDAY:
                s = "Martes";
                break;
            case Calendar.WEDNESDAY:
                s = "Miércoles";
                break;
            case Calendar.THURSDAY:
                s = "Jueves";
                break;
            case Calendar.FRIDAY:
                s = "Viernes";
                break;
            case Calendar.SATURDAY:
                s = "Sábado";
                break;
            case Calendar.SUNDAY:
                s = "Domingo";
                break;
        }
        return  s;
    }
    public static void toastNaranja(String string, Context context, View layout, int durationInMillis) {
        durationInMillis = durationInMillis * 1000;
        final Toast toast = new Toast(context);
        toast.setGravity(Gravity.CENTER, 0, 0);
        toast.setDuration(Toast.LENGTH_SHORT);
        toast.setView(layout);

        TextView textView = layout.findViewById(R.id.toast_naranja_textView);
        textView.setText(string);

        // Muestra el Toast una vez
        toast.show();

        // Crea un Handler para contar el tiempo y cancelar el Toast después de un período específico
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                toast.cancel();
            }
        }, durationInMillis); // durationInMillis es la duración en milisegundos que deseas que el Toast sea mostrado
    }
    public static void intent(Class class_, Context context, String key, String bundle){
        Intent intent = new Intent(context,class_).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(key,bundle);
        context.startActivity(intent);
    }

    public static void saveData_sharedPreferences(Context context, String name, String key, String value) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(name, MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(key, value);
        editor.apply(); // Aplica los cambios de manera asíncrona
    }

    // Método para obtener un valor de SharedPreferences
    public static String loadData_sharedPreferences(Context context, String key, String name) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(name, MODE_PRIVATE);
        // Si no se encuentra la clave, se devuelve un valor predeterminado en este caso ""
        return sharedPreferences.getString(key, "");
    }

    // Método para eliminar un valor de SharedPreferences
    public static void removeData_sharedPreferences(Context context, String key, String name) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(name, MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.remove(key);
        editor.apply(); // Aplica los cambios de manera asíncrona
    }
    public static String getAnñoMesDiaHora(String get){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        //                                2020-08-20 16:40:34
        if(get.equals("año")){return (dateTime.split(" ")[0]).split("-")[0].substring(2);}
        else if (get.equals("mes")){return (dateTime.split(" ")[0]).split("-")[1];}
        else if (get.equals("dia")){return (dateTime.split(" ")[0]).split("-")[2];}
        else if (get.equals("hora")){return (dateTime.split(" ")[1]);}
        return "null";
    }
    public static String quitarCero(String s){
        if(s.charAt(0) == '0')s = Character.toString(s.charAt(1));
        return s;
    }
    public static int[] acomodarIndicesJsonNames(JSONObject object){
        int[] acomodar = new int[object.names().length()];
        for (int l = 0; l < acomodar.length; l++){
            try {
                acomodar[l] = Integer.parseInt(object.names().getString(l));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        Arrays.sort(acomodar);
        return acomodar;
    }

    public static String generateUniqueID(JSONArray jsonArray) {
        if (jsonArray == null || jsonArray.length() == 0) {
            return generateRandomID();
        }

        String id;
        do {
            id = generateRandomID(); // Genera un ID aleatorio
        } while (isIDExists(id, jsonArray)); // Sigue generando hasta que no exista en el JSONArray
        return id;
    }
    private static String generateRandomID() {
        Random random = new Random();
        int randomID = random.nextInt(900000000) + 100000000; // Genera un número entre 100000000 y 999999999
        return String.valueOf(randomID);
    }
    private static boolean isIDExists(String id, JSONArray jsonArray) {
        for (int i = 0; i < jsonArray.length(); i++) {
            try {
                JSONObject jsonObject = jsonArray.getJSONObject(i);
                if (jsonObject.has("id") && jsonObject.getString("id").equals(id)) {
                    return true; // El ID ya existe en el JSONArray
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        return false; // El ID no existe en el JSONArray
    }
    public JSONObject verIndices(Context context){
        JSONObject obj_año  = new JSONObject();

        for (int i = 0; i < jsonMensajes_n.names().length()  ; i++){
            try {
                int[] año = acomodarIndices(jsonMensajes_n);

                JSONObject objMes = jsonMensajes_n.getJSONObject(String.valueOf(año[i]));

                int[] mes = acomodarIndices(objMes);

                for (int x = 0; x < objMes.names().length() ; x++){
                    JSONObject objDia = objMes.getJSONObject(String.valueOf(mes[x]));

                    int[] dia = acomodarIndices(objDia);

                    for (int z = 0; z < objDia.names().length(); z++){
                        JSONObject objMensaje = objDia.getJSONObject(String.valueOf(dia[z]));

                        int[] mensaje = acomodarIndices(objMensaje);

                        for (int y = 0; y < objMensaje.names().length(); y++){


                        }

                    }

                }

            } catch (JSONException e) {
                generales.toast("error", context);
                throw new RuntimeException(e);
            }
        }
        try {
            generales.toast(obj_año.getJSONArray("2024").getString(1), context);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        return obj_año;
    }
    private int[] acomodarIndices(JSONObject object){
        int[] acomodar = new int[object.names().length()];
        for (int l = 0; l < acomodar.length; l++){
            try {
                acomodar[l] = Integer.parseInt(object.names().getString(l));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        Arrays.sort(acomodar);
        return acomodar;
    }
    public static void actualizarDatosGuardados(String nameJson, String userString, Context context){
        File file = new File(context.getFilesDir(),nameJson);
        FileWriter fileWriter = null;
        try {
            fileWriter = new FileWriter(file);
            BufferedWriter bufferedWriter = new BufferedWriter(fileWriter);
            bufferedWriter.write(userString);
            bufferedWriter.close();
            // toast("datos guardados");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    private static final AtomicInteger contador = new AtomicInteger(0);
    private static final int MAX_CONTADOR = 9999;
    public static String generarID() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmssSSS");
        String timestamp = sdf.format(new Date());
        int valorContador = contador.getAndIncrement();

        if (valorContador > MAX_CONTADOR) {
            contador.set(0);
            valorContador = 0;
        }

        String id = timestamp + String.format("%04d", valorContador);
        return id;
    }
    public static void initPantalla_barra_azulDatoSegmento_texto_blanco(Window window, Context context){
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(context.getResources().getColor(R.color.azulDatosSegmento)); // Asegúrate de que el color esté definido en tus recursos.

        // Asegurarse de que los íconos de la barra de estado sean blancos
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Para Android 11 y superior
            WindowInsetsController insetsController = window.getInsetsController();

            if (insetsController != null) {
                // Quitar la apariencia de "barra de estado clara" para tener íconos blancos
                insetsController.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Para Android 6.0 a Android 10
            View decor = window.getDecorView();
            // Quitar el flag de barra de estado clara para tener íconos blancos
            decor.setSystemUiVisibility(0);
        }
    }
    public static void initPantalla_barra_morada_texto_blanco(Window window, Context context){
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(context.getResources().getColor(R.color.morado));

        // Asegurarse de que los íconos de la barra de estado sean blancos
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Para Android 11 y superior
            WindowInsetsController insetsController = window.getInsetsController();

            if (insetsController != null) {
                // Quitar la apariencia de "barra de estado clara" para tener íconos blancos
                insetsController.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Para Android 6.0 a Android 10
            View decor = window.getDecorView();
            // Quitar el flag de barra de estado clara para tener íconos blancos
            decor.setSystemUiVisibility(0);
        }
    }
    public static void initPantalla_barra_blanca_texto_negro(Window window, Context context){
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(context.getResources().getColor(R.color.blanco)); // Asegúrate de que el color esté definido en tus recursos.

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                insetsController.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    public void browseBluetoothDevice(Context context) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Si no tienes permisos, deten el flujo y pídelo antes de llamar a esta función.
            return;
        }

        final BluetoothConnection[] bluetoothDevicesList = (new BluetoothPrintersConnections()).getList();

        if (bluetoothDevicesList == null || bluetoothDevicesList.length == 0) {
            // Muestra un mensaje o un Toast indicando que no se encontraron dispositivos
            Toast.makeText(context, "No se encontraron dispositivos Bluetooth", Toast.LENGTH_SHORT).show();
            return;
        }

        final String[] items = new String[bluetoothDevicesList.length];
        for (int i = 0; i < bluetoothDevicesList.length; i++) {
            items[i] = bluetoothDevicesList[i].getDevice().getName();
        }

        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        builder.setTitle("Selección de impresora Bluetooth")
                .setSingleChoiceItems(items, -1, null)
                .setPositiveButton("Aceptar", (dialog, which) -> {
                    AlertDialog alert = (AlertDialog) dialog;
                    int selectedPosition = alert.getListView().getCheckedItemPosition();
                    if (selectedPosition >= 0) {
                        // Selecciona el dispositivo elegido
                        selectedDevice_static = bluetoothDevicesList[selectedPosition];
                        saveSelectedDevice(selectedDevice_static, context);
                    }
                })
                .setNegativeButton("Cancelar", (dialog, which) -> dialog.dismiss());

        AlertDialog dialog = builder.create();
        dialog.setCanceledOnTouchOutside(false);
        dialog.show();
    }
    public void saveSelectedDevice(BluetoothConnection selectedDevice, Context context) {
        if (selectedDevice == null || selectedDevice.getDevice() == null) return;
        String macAddress = selectedDevice.getDevice().getAddress();
        SharedPreferences prefs = context.getSharedPreferences("MyAppSettings", MODE_PRIVATE);
        prefs.edit()
                .putString("SelectedPrinterMAC", macAddress)
                .apply();
    }
}
