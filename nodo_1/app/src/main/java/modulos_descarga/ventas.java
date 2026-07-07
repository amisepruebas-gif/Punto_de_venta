package modulos_descarga;

import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.principal.jsonVenta;
import static com.example.nodo_1.principal.objectFechasVenta;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.example.nodo_1.R;
import com.example.nodo_1.fecha;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.QuerySnapshot;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;

public class ventas {

    Context context;

    public ventas(Context context){
        this.context = context;
    }

    String huellallegada = "";
    boolean statuHuellaIgual = false;
    private final String CHANNEL_ID = "mi_canal_notificacion";

    public void escucharVentaEnDatos(JSONObject object){

        // huella -> millis()
        try {
            String direccion = context.getString(R.string.ventas_n);
            String keyName = context.getString(R.string.huella_venta);

            String huellaLocal = loadData_sharedPreferences(context, keyName, keyName);
            huellallegada = object.getString(context.getString(R.string.huella_venta));

            String ultimaFechaRegistrada = formatearFechaDesdeID(huellallegada);
            String año_registrado = ultimaFechaRegistrada.split("-")[0];
            String mes_registrado = ultimaFechaRegistrada.split("-")[1];
            String dia_registrado = ultimaFechaRegistrada.split("-")[2];
            if (dia_registrado.charAt(0) == '0') dia_registrado = dia_registrado.substring(1);
            if (mes_registrado.charAt(0) == '0') mes_registrado = mes_registrado.substring(1);

            jsonVenta = getJsonGuardado("jsonVenta");

            if(huellaLocal.equals("") || jsonVenta == null){
                if(jsonVenta == null){
                    jsonVenta = new JSONObject();
                    descargar_fechasVenta(direccion, true);
                } else {
                    toast("PROBLEMA AL RECIBIR VENTA");
                }
            } else {
                boolean mismoDia = false;
                if(!huellaLocal.equals(huellallegada)){
                    statuHuellaIgual = false;
                    if (jsonVenta.has(año_registrado)){
                        if (jsonVenta.getJSONObject(año_registrado).has(mes_registrado)){
                            if (jsonVenta.getJSONObject(año_registrado).getJSONObject(mes_registrado).has(dia_registrado)){}
                            else mismoDia = true;
                        }else mismoDia = true;
                    }else mismoDia = true;

                    if(!mismoDia){
                        getVentaDiaEntero(año_registrado, mes_registrado, dia_registrado, "");
                    } else {
                        descargar_fechasVenta(direccion, false);
                    }
                }else {
                    statuHuellaIgual = true;
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public void descargar_fechasVenta(String direccion, boolean todasLasVentas){
        JSONObject json = new JSONObject();
        fire.colRef(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    try {
                        objectFechasVenta = new JSONObject(json.toString());
                        actualizarDatosGuardados("objectFechasVenta", objectFechasVenta.toString(), context);

                        String fechainicioString;
                        if(!todasLasVentas) {
                            fechainicioString = obtenerFechaMasReciente(jsonVenta);
                        } else {
                            // Limitar primera descarga a ultimos 30 dias
                            String fechaAntigua = fecha.encontrarFechaMasAntigua(objectFechasVenta);
                            String fechaLimite = obtenerFechaHace30Dias();
                            if (fechaAntigua != null && fechaLimite != null) {
                                if (esFechaAnterior(fechaAntigua, fechaLimite)) {
                                    fechainicioString = fechaLimite;
                                } else {
                                    fechainicioString = fechaAntigua;
                                }
                            } else {
                                fechainicioString = fechaAntigua;
                            }
                        }

                        JSONArray arrayFechasFaltantes = obtenerFechasDesde(objectFechasVenta, fechainicioString);

                        if (arrayFechasFaltantes.length() == 1){
                            String hastaDonde = "";
                            String fechaUltimaVenta = arrayFechasFaltantes.getString(arrayFechasFaltantes.length()-1);
                            String año = fechaUltimaVenta.split("-")[0];
                            String mes = fechaUltimaVenta.split("-")[1];
                            String dia = fechaUltimaVenta.split("-")[2];

                            if (jsonVenta.has(año)){
                                if (jsonVenta.getJSONObject(año).has(mes)){
                                    if (jsonVenta.getJSONObject(año).getJSONObject(mes).has(dia)){}
                                    else hastaDonde = "dia";
                                }else hastaDonde = "mes";
                            }else hastaDonde = "año";

                            getVentaDiaEntero(año, mes, dia, hastaDonde);
                        }

                        if(arrayFechasFaltantes.length() > 1){
                            List<Task<DocumentSnapshot>> allTasks = new ArrayList<>();

                            for (int x = 0; x < arrayFechasFaltantes.length(); x++) {
                                String fechaStr = arrayFechasFaltantes.getString(x);
                                String año = fechaStr.split("-")[0];
                                String mes = fechaStr.split("-")[1];
                                String dia = fechaStr.split("-")[2];

                                Task<DocumentSnapshot> task = fire.documenRef("ventas_n/" + año + "/" + mes + "/" + dia).get();
                                allTasks.add(task);
                                task.addOnCompleteListener(new OnCompleteListener<DocumentSnapshot>() {
                                    @Override
                                    public void onComplete(@NonNull Task<DocumentSnapshot> task) {
                                        if (task.isSuccessful()) {
                                            DocumentSnapshot document = task.getResult();
                                            if (document.exists()) {
                                                try {
                                                    JSONObject object = mapToJSON(Objects.requireNonNull(document.getData()));
                                                    JSONObject objMes = new JSONObject();
                                                    JSONObject objDia = new JSONObject();
                                                    JSONObject jsn_array = new JSONObject();
                                                    jsn_array.put("registro", object.getJSONArray("registro"));
                                                    if(jsonVenta.length() == 0){
                                                        objDia.put(dia, jsn_array);
                                                        objMes.put(mes, objDia);
                                                        jsonVenta.put(año, objMes);
                                                    } else {
                                                        if (jsonVenta.has(año)) {
                                                            if (jsonVenta.getJSONObject(año).has(mes)) {
                                                                jsonVenta.getJSONObject(año).getJSONObject(mes).put(dia, jsn_array);
                                                            } else {
                                                                objDia.put(dia, jsn_array);
                                                                jsonVenta.getJSONObject(año).put(mes, objDia);
                                                            }
                                                        } else {
                                                            objDia.put(dia, jsn_array);
                                                            objMes.put(mes, objDia);
                                                            jsonVenta.put(año, objMes);
                                                        }
                                                    }
                                                } catch (JSONException e) {
                                                    throw new RuntimeException(e);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                            Tasks.whenAll(allTasks).addOnCompleteListener(new OnCompleteListener<Void>() {
                                @Override
                                public void onComplete(@NonNull Task<Void> task) {
                                    if (task.isSuccessful()) {
                                        onAllTasksCompleted();
                                    } else {
                                        Log.e("Firestore", "Error al completar las tareas de ventas", task.getException());
                                    }
                                }
                            });
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        });
    }

    private void onAllTasksCompleted() {
        jsonVenta = ordenarJSONObjectPorFecha(jsonVenta);
        actualizarDatosGuardados("jsonVenta", jsonVenta.toString(), context);
        generales.saveData_sharedPreferences(
                context,
                context.getString(R.string.huella_venta),
                context.getString(R.string.huella_venta), huellallegada);

        String fechas = obtenerFechaMasReciente(jsonVenta);
        if (fechas == null) return;

        String año = fechas.split("-")[0];
        String mes = fechas.split("-")[1];
        String dia = fechas.split("-")[2];
        Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_venta_ac");
        intent.putExtra("datos", "ultima_venta");
        intent.putExtra("fecha", fechas);
        try {
            intent.putExtra("extra_data",
                    jsonVenta.getJSONObject(año).getJSONObject(mes).getJSONObject(dia).toString());
        } catch (JSONException e) {
            // ignore
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent);
        notificacion();
    }

    private void notificacion(){
        if(!statuHuellaIgual){
            sendVentaNotification(context, "NUEVA VENTA");
        }
    }

    private void getVentaDiaEntero(String año, String mes, String dia, String hastaDonde){
        fire.documenRef("ventas_n/" + año + "/" + mes + "/" + dia).get().addOnCompleteListener(new OnCompleteListener<DocumentSnapshot>() {
            @Override
            public void onComplete(@NonNull Task<DocumentSnapshot> task) {
                if (task.isSuccessful()) {
                    DocumentSnapshot document = task.getResult();
                    if (document.exists()) {
                        try {
                            JSONObject object = mapToJSON(Objects.requireNonNull(document.getData()));
                            JSONObject jsn_array = new JSONObject();
                            jsn_array.put("registro", object.getJSONArray("registro"));

                            if(hastaDonde.equals("")) {
                                jsonVenta.getJSONObject(año).getJSONObject(mes).put(dia, jsn_array);
                            } else {
                                if(hastaDonde.equals("año")){
                                    JSONObject obj_dia = new JSONObject();
                                    obj_dia.put(dia, jsn_array);
                                    JSONObject obj_mes = new JSONObject();
                                    obj_mes.put(mes, obj_dia);
                                    jsonVenta.put(año, obj_mes);
                                } else if (hastaDonde.equals("mes")) {
                                    JSONObject obj_dia = new JSONObject();
                                    obj_dia.put(dia, jsn_array);
                                    jsonVenta.getJSONObject(año).put(mes, obj_dia);
                                } else {
                                    jsonVenta.getJSONObject(año).getJSONObject(mes).put(dia, jsn_array);
                                }
                            }
                            onAllTasksCompleted();
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
            }
        });
    }

    // Limitar descarga inicial a 30 dias
    private String obtenerFechaHace30Dias() {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_MONTH, -30);
        int año = cal.get(Calendar.YEAR);
        int mes = cal.get(Calendar.MONTH) + 1;
        int dia = cal.get(Calendar.DAY_OF_MONTH);
        return año + "-" + mes + "-" + dia;
    }

    private boolean esFechaAnterior(String fecha1, String fecha2) {
        try {
            String[] p1 = fecha1.split("-");
            String[] p2 = fecha2.split("-");
            Calendar c1 = Calendar.getInstance();
            c1.set(Integer.parseInt(p1[0]), Integer.parseInt(p1[1]) - 1, Integer.parseInt(p1[2]), 0, 0, 0);
            Calendar c2 = Calendar.getInstance();
            c2.set(Integer.parseInt(p2[0]), Integer.parseInt(p2[1]) - 1, Integer.parseInt(p2[2]), 0, 0, 0);
            return c1.before(c2);
        } catch (Exception e) {
            return false;
        }
    }

    public static String formatearFechaDesdeID(String id) {
        if (id == null || id.length() < 8) {
            return null;
        }
        try {
            String anioStr = id.substring(0, 4);
            String mesStr = id.substring(4, 6);
            String diaStr = id.substring(6, 8);
            int anio = Integer.parseInt(anioStr);
            int mes = Integer.parseInt(mesStr);
            int dia = Integer.parseInt(diaStr);
            return String.format("%d-%d-%d", anio, mes, dia);
        } catch (NumberFormatException | IndexOutOfBoundsException e) {
            return null;
        }
    }

    private JSONObject getJsonGuardado(String name) {
        File file = new File(context.getFilesDir(), name);
        if (!file.exists()) {
            return null;
        }
        BufferedReader bufferedReader = null;
        try {
            FileInputStream fis = context.openFileInput(name);
            InputStreamReader inputStreamReader = new InputStreamReader(fis);
            bufferedReader = new BufferedReader(inputStreamReader);
            StringBuilder stringBuilder = new StringBuilder();
            String line;
            while ((line = bufferedReader.readLine()) != null) {
                stringBuilder.append(line).append("\n");
            }
            String response = stringBuilder.toString();
            return new JSONObject(response);
        } catch (IOException | JSONException e) {
            e.printStackTrace();
            return null;
        } finally {
            if (bufferedReader != null) {
                try { bufferedReader.close(); } catch (IOException e) { }
            }
        }
    }

    public JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj_ = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof Map) {
                obj_.put(key, mapToJSON((Map<String, Object>) value));
            } else if (value instanceof List) {
                obj_.put(key, listToJSONArray((List<Object>) value));
            } else {
                obj_.put(key, value);
            }
        }
        return obj_;
    }

    private JSONArray listToJSONArray(List<Object> list) throws JSONException {
        JSONArray arr = new JSONArray();
        for(Object obj: list) {
            if (obj instanceof Map) {
                arr.put(mapToJSON((Map<String, Object>) obj));
            } else if(obj instanceof List) {
                arr.put(listToJSONArray((List<Object>) obj));
            } else {
                arr.put(obj);
            }
        }
        return arr;
    }

    public static JSONArray obtenerFechasDesde(JSONObject jsnx, String fechaInicialStr) {
        JSONArray fechasArray = new JSONArray();
        TreeSet<Date> fechasSet = new TreeSet<>();

        Date fechaInicial;
        try {
            String[] fechaParts = fechaInicialStr.split("-");
            if (fechaParts.length != 3) return fechasArray;
            int añoInicial = Integer.parseInt(fechaParts[0]);
            int mesInicial = Integer.parseInt(fechaParts[1]) - 1;
            int diaInicial = Integer.parseInt(fechaParts[2]);

            Calendar calInicial = Calendar.getInstance();
            calInicial.set(añoInicial, mesInicial, diaInicial, 0, 0, 0);
            calInicial.set(Calendar.MILLISECOND, 0);
            calInicial.add(Calendar.DAY_OF_MONTH, 1);
            fechaInicial = calInicial.getTime();
        } catch (Exception e) {
            return fechasArray;
        }

        try {
            Iterator<String> yearKeys = jsnx.keys();
            while (yearKeys.hasNext()) {
                String yearKey = yearKeys.next();
                int año = Integer.parseInt(yearKey);
                JSONObject objMeses = jsnx.getJSONObject(yearKey);

                Iterator<String> monthKeys = objMeses.keys();
                while (monthKeys.hasNext()) {
                    String monthKey = monthKeys.next();
                    int mes = Integer.parseInt(monthKey) - 1;
                    JSONObject objDias = objMeses.getJSONObject(monthKey);

                    Iterator<String> dayKeys = objDias.keys();
                    while (dayKeys.hasNext()) {
                        String dayKey = dayKeys.next();
                        int dia = Integer.parseInt(dayKey);

                        Calendar calActual = Calendar.getInstance();
                        calActual.set(año, mes, dia, 0, 0, 0);
                        calActual.set(Calendar.MILLISECOND, 0);
                        Date fechaActual = calActual.getTime();

                        if (!fechaActual.before(fechaInicial)) {
                            fechasSet.add(fechaActual);
                        }
                    }
                }
            }

            for (Date fechaDate : fechasSet) {
                Calendar cal = Calendar.getInstance();
                cal.setTime(fechaDate);
                int año = cal.get(Calendar.YEAR);
                int mes = cal.get(Calendar.MONTH) + 1;
                int dia = cal.get(Calendar.DAY_OF_MONTH);
                fechasArray.put(año + "-" + mes + "-" + dia);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }

        return fechasArray;
    }

    public static JSONObject ordenarJSONObjectPorFecha(JSONObject original) {
        return ordenarNivel(original);
    }

    private static JSONObject ordenarNivel(JSONObject obj) {
        JSONObject resultado = new JSONObject();
        try {
            TreeMap<Integer, Object> mapaOrdenado = new TreeMap<>();
            Iterator<String> claves = obj.keys();
            while (claves.hasNext()) {
                String clave = claves.next();
                int claveNum = Integer.parseInt(clave);
                Object valor = obj.get(clave);
                mapaOrdenado.put(claveNum, valor);
            }
            for (Map.Entry<Integer, Object> entrada : mapaOrdenado.entrySet()) {
                String clave = String.valueOf(entrada.getKey());
                Object valor = entrada.getValue();
                if (valor instanceof JSONObject) {
                    valor = ordenarNivel((JSONObject) valor);
                }
                resultado.put(clave, valor);
            }
        } catch (JSONException | NumberFormatException e) {
            e.printStackTrace();
        }
        return resultado;
    }

    public static String obtenerFechaMasReciente(JSONObject obj3) {
        Date fechaMaxima = null;
        try {
            Iterator<String> yearKeys = obj3.keys();
            while (yearKeys.hasNext()) {
                String yearKey = yearKeys.next();
                int año = Integer.parseInt(yearKey);
                JSONObject objMeses = obj3.getJSONObject(yearKey);

                Iterator<String> monthKeys = objMeses.keys();
                while (monthKeys.hasNext()) {
                    String monthKey = monthKeys.next();
                    int mes = Integer.parseInt(monthKey) - 1;
                    JSONObject objDias = objMeses.getJSONObject(monthKey);

                    Iterator<String> dayKeys = objDias.keys();
                    while (dayKeys.hasNext()) {
                        String dayKey = dayKeys.next();
                        int dia = Integer.parseInt(dayKey);

                        Calendar calActual = Calendar.getInstance();
                        calActual.set(Calendar.YEAR, año);
                        calActual.set(Calendar.MONTH, mes);
                        calActual.set(Calendar.DAY_OF_MONTH, dia);
                        calActual.set(Calendar.HOUR_OF_DAY, 0);
                        calActual.set(Calendar.MINUTE, 0);
                        calActual.set(Calendar.SECOND, 0);
                        calActual.set(Calendar.MILLISECOND, 0);
                        Date fechaActual = calActual.getTime();

                        if (fechaMaxima == null || fechaActual.after(fechaMaxima)) {
                            fechaMaxima = fechaActual;
                        }
                    }
                }
            }
            if (fechaMaxima != null) {
                Calendar calMaxima = Calendar.getInstance();
                calMaxima.setTime(fechaMaxima);
                return calMaxima.get(Calendar.YEAR) + "-" + (calMaxima.get(Calendar.MONTH) + 1) + "-" + calMaxima.get(Calendar.DAY_OF_MONTH);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return null;
    }

    public void sendVentaNotification(Context context, String mensajeVenta) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.icon_persona)
                .setContentTitle("NUEVA VENTA")
                .setContentText(mensajeVenta)
                .setSound(null)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
    }

    private void toast(String s){
        generales.toast(s, context);
    }
}
