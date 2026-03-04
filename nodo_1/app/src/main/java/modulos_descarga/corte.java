package modulos_descarga;


import static com.example.nodo_1.fire.db;
import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static com.example.nodo_1.principal.objectFechasCorte;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
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
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;

public class corte {
    Context context;
    String nameArray, direccion;

    public corte(Context context){
        this.context = context;
    }


    String huellallegada = "";
    boolean statuHuellaIgual = false;

    public void escucharMensajeEnDatos(JSONObject object){

        // huella - > millis()
        try {
            direccion = context.getString(R.string.corte_1);
            nameArray = "registro";
            String keyName = context.getString(R.string.huella_corte_1);

            String huellaLocal = loadData_sharedPreferences(context, keyName, keyName);
            huellallegada = object.getString(context.getString(R.string.huella_corte_1));


            String ultimaFechaRegistrada = formatearFechaDesdeID(huellallegada);
            String año_registrado = ultimaFechaRegistrada.split("-")[0];
            String mes_registrado = ultimaFechaRegistrada.split("-")[1];
            String dia_registrado = ultimaFechaRegistrada.split("-")[2];
            if (dia_registrado.charAt(0) == '0')dia_registrado = dia_registrado.substring(1);
            if (mes_registrado.charAt(0) == '0')mes_registrado = mes_registrado.substring(1);

            jsonCorteHistorial = getJsonGuardado("jsonCorteHistorial");

            if(huellaLocal.equals("")||jsonCorteHistorial==null){
                if(jsonCorteHistorial == null){
                    // Si el equipo es nuevo debería preguntar si hay más de 1 día para descargar
                    jsonCorteHistorial = new JSONObject();
                    descargar_fechasMensaje(direccion,  true);
                } else {
                    // Hay un problema
                    toast("PROBLEMA AL RECIBIR");
                }
            } else {
                boolean mismoDia = false;
                if(!huellaLocal.equals(huellallegada)){
                    statuHuellaIgual = false;
                    if (jsonCorteHistorial.has(año_registrado)){
                        if (jsonCorteHistorial.getJSONObject(año_registrado).has(mes_registrado)){
                            if (jsonCorteHistorial.getJSONObject(año_registrado).getJSONObject(mes_registrado).has(dia_registrado)){}
                            else mismoDia = true;
                        }else mismoDia = true;
                    }else mismoDia = true;

                    if(!mismoDia){
                        getMensajeDiaEntero(año_registrado, mes_registrado, dia_registrado,  "");
                    }
                    else{
                        descargar_fechasMensaje(direccion,  false);
                    }
                }else {
                    statuHuellaIgual = true;
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }


    public void descargar_fechasMensaje(String direccion,  boolean todosLosMensajes){
        JSONObject json = new JSONObject();
        db().collection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
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
                        objectFechasCorte = new JSONObject(json.toString());
                        actualizarDatosGuardados("objectFechasCorte", objectFechasCorte.toString(), context);

                        String fechainicioString;
                        if(!todosLosMensajes) {
                            fechainicioString = obtenerFechaMasReciente(jsonCorteHistorial);
                        } else {
                            fechainicioString = fecha.encontrarFechaMasAntigua(objectFechasCorte);
                        }

                        JSONArray arrayFechasFaltantes = obtenerFechasDesde(objectFechasCorte, fechainicioString);

                        if (arrayFechasFaltantes.length() == 1){
                            String hastaDonde = "";
                            String fechaUltimoMensaje = arrayFechasFaltantes.getString(arrayFechasFaltantes.length()-1);
                            String año = fechaUltimoMensaje.split("-")[0];
                            String mes = fechaUltimoMensaje.split("-")[1];
                            String dia = fechaUltimoMensaje.split("-")[2];

                            if (jsonCorteHistorial.has(año)){
                                if (jsonCorteHistorial.getJSONObject(año).has(mes)){
                                    if (jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).has(dia)){}
                                    else hastaDonde = "dia";
                                }else hastaDonde = "mes";
                            }else hastaDonde = "año";

                            getMensajeDiaEntero(año, mes, dia,  hastaDonde);
                        }


                        if(arrayFechasFaltantes.length() > 1){
                            List<Task<DocumentSnapshot>> allTasks = new ArrayList<>();

                            for (int x = 0; x < arrayFechasFaltantes.length(); x++) {

                                String fecha = arrayFechasFaltantes.getString(x);

                                String año = fecha.split("-")[0];
                                String mes = fecha.split("-")[1];
                                String dia = fecha.split("-")[2];

                                Task<DocumentSnapshot> task = fire.documenRef(direccion +"/" + año + "/" + mes + "/" + dia).get();
                                allTasks.add(task);
                                // Procesa cada tarea individualmente si es necesario
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
                                                    if (jsonCorteHistorial.has(año)) {
                                                        if (jsonCorteHistorial.getJSONObject(año).has(mes)) {
                                                            jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).put(dia, object.getJSONArray(nameArray));
                                                        } else {
                                                            objDia.put(dia, object.getJSONArray(nameArray));
                                                            jsonCorteHistorial.getJSONObject(año).put(mes, objDia);
                                                        }
                                                    } else {
                                                        objDia.put(dia, object.getJSONArray(nameArray));
                                                        objMes.put(mes, objDia);
                                                        jsonCorteHistorial.put(año, objMes);
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
                                        // Todas las tareas han finalizado correctamente
                                        onAllTasksCompleted();
                                    } else {
                                        // Maneja errores si alguna tarea falló
                                        Log.e("Firestore", "Error al completar las tareas", task.getException());
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
        jsonCorteHistorial = ordenarJSONObjectPorFecha(jsonCorteHistorial);
        actualizarDatosGuardados("jsonCorteHistorial", jsonCorteHistorial.toString(), context);
        generales.saveData_sharedPreferences(
                context,
                context.getString(R.string.huella_corte_1),
                context.getString(R.string.huella_corte_1), huellallegada);

        String fechas = obtenerFechaMasReciente(jsonCorteHistorial);

        String año = fechas.split("-")[0];
        String mes = fechas.split("-")[1];
        String dia = fechas.split("-")[2];
        Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mensajes_ac");
        intent.putExtra("datos", context.getString(R.string.corte_1));
        try {
            intent.putExtra("extra_data",
                    jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).
                            getJSONObject( jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).length()-1).toString());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent);
    }


    private void getMensajeDiaEntero(String año, String mes, String dia, String hastaDonde){
        fire.documenRef(direccion + "/" + año + "/" + mes + "/" + dia).get().addOnCompleteListener(new OnCompleteListener<DocumentSnapshot>() {
            @Override
            public void onComplete(@NonNull Task<DocumentSnapshot> task) {
                if (task.isSuccessful()) {
                    DocumentSnapshot document = task.getResult();
                    if (document.exists()) {
                        try {
                            JSONObject object = mapToJSON(Objects.requireNonNull(document.getData()));

                            if(hastaDonde.equals("")) {
                                jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).put(dia, object.getJSONArray(nameArray));
                            } else {
                                if(hastaDonde.equals("año")){
                                    JSONObject obj_dia = new JSONObject();
                                    obj_dia.put(dia, object.getJSONArray(direccion));
                                    JSONObject obj_mes = new JSONObject();
                                    obj_mes.put(mes, obj_dia);
                                    jsonCorteHistorial.put(año, obj_mes);
                                } else if (hastaDonde.equals("mes")) {
                                    JSONObject obj_dia = new JSONObject();
                                    obj_dia.put(dia, object.getJSONArray(direccion));
                                    jsonCorteHistorial.getJSONObject(año).put(mes, obj_dia);
                                } else {
                                    jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).put(dia, object.getJSONArray(direccion));
                                }
                            }
                            actualizarDatosGuardados("jsonCorteHistorial", jsonCorteHistorial.toString(), context);
                            generales.saveData_sharedPreferences(
                                    context,
                                    context.getString(R.string.huella_corte_1),
                                    context.getString(R.string.huella_corte_1), huellallegada);

                            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mensajes_ac");
                            intent.putExtra("datos", "mensaje");
                            intent.putExtra("extra_data",
                                    jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).
                                            getJSONObject( jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).length()-1).toString());
                            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    } else {
                        // Manejar el caso en que el documento no existe
                    }
                } else {
                    // Manejar el error en la tarea
                }
            }
        });

    }

    public static String formatearFechaDesdeID(String id) {
        // Verifica que la cadena tenga al menos 8 caracteres para la fecha
        if (id == null || id.length() < 8) {
            System.err.println("ID inválido: la cadena es nula o demasiado corta.");
            return null;
        }

        try {
            // Extrae las partes de la fecha
            String anioStr = id.substring(0, 4);
            String mesStr = id.substring(4, 6);
            String diaStr = id.substring(6, 8);

            // Convierte mes y día a enteros para eliminar ceros a la izquierda
            int anio = Integer.parseInt(anioStr);
            int mes = Integer.parseInt(mesStr);
            int dia = Integer.parseInt(diaStr);

            // Formatea la fecha
            return String.format("%d-%d-%d", anio, mes, dia);
        } catch (NumberFormatException | IndexOutOfBoundsException e) {
            System.err.println("Error al formatear la fecha desde el ID: " + e.getMessage());
            return null;
        }
    }

    private JSONObject getJsonGuardado(String name){
        File file = new File(context.getFilesDir(), name);
        try (FileReader fileReader = new FileReader(file);
             BufferedReader bufferedReader = new BufferedReader(fileReader)) {
            StringBuilder stringBuilder = new StringBuilder();
            String line = bufferedReader.readLine();
            while (line != null){
                stringBuilder.append(line).append("\n");
                line = bufferedReader.readLine();
            }
            String response = stringBuilder.toString();

            return new JSONObject(response);
        } catch (IOException | JSONException e) {
            e.printStackTrace();
            return null;
        }
    }

    public JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj_ = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof Map) {
                Map<String, Object> subMap = (Map<String, Object>) value;
                obj_.put(key, mapToJSON(subMap));
            } else if (value instanceof List) {
                obj_.put(key, listToJSONArray((List<Object>) value));
            }
            else {
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
            }
            else if(obj instanceof List) {
                arr.put(listToJSONArray((List<Object>) obj));
            }
            else {
                arr.put(obj);
            }
        }
        return arr;
    }


    public static JSONArray obtenerFechasDesde(JSONObject jsnx, String fechaInicialStr) {
        JSONArray fechasArray = new JSONArray();
        TreeSet<Date> fechasSet = new TreeSet<>();

        // Parsear la fecha inicial y añadir un día
        Date fechaInicial;
        try {
            String[] fechaParts = fechaInicialStr.split("-");
            int añoInicial = Integer.parseInt(fechaParts[0]);
            int mesInicial = Integer.parseInt(fechaParts[1]) - 1; // Los meses en Calendar van de 0 a 11
            int diaInicial = Integer.parseInt(fechaParts[2]);

            Calendar calInicial = Calendar.getInstance();
            calInicial.set(añoInicial, mesInicial, diaInicial, 0, 0, 0);
            calInicial.set(Calendar.MILLISECOND, 0);

            // Añadir un día a la fecha inicial
            calInicial.add(Calendar.DAY_OF_MONTH, 1);
            fechaInicial = calInicial.getTime();
        } catch (Exception e) {
            e.printStackTrace();
            return fechasArray; // Retorna vacío si la fecha inicial es inválida
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
                    int mes = Integer.parseInt(monthKey) - 1; // Los meses en Calendar van de 0 a 11
                    JSONObject objDias = objMeses.getJSONObject(monthKey);

                    Iterator<String> dayKeys = objDias.keys();
                    while (dayKeys.hasNext()) {
                        String dayKey = dayKeys.next();
                        int dia = Integer.parseInt(dayKey);

                        Calendar calActual = Calendar.getInstance();
                        calActual.set(año, mes, dia, 0, 0, 0);
                        calActual.set(Calendar.MILLISECOND, 0);
                        Date fechaActual = calActual.getTime();

                        // Si la fecha actual es mayor o igual a la fecha inicial, la añadimos al conjunto
                        if (!fechaActual.before(fechaInicial)) {
                            fechasSet.add(fechaActual);
                        }
                    }
                }
            }

            // Convertir el conjunto de fechas en un JSONArray de Strings
            for (Date fecha : fechasSet) {
                Calendar cal = Calendar.getInstance();
                cal.setTime(fecha);
                int año = cal.get(Calendar.YEAR);
                int mes = cal.get(Calendar.MONTH) + 1; // Ajuste porque los meses van de 0 a 11
                int dia = cal.get(Calendar.DAY_OF_MONTH);
                String fechaStr = año + "-" + mes + "-" + dia;
                fechasArray.put(fechaStr);
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
            // Utilizar TreeMap para ordenar las claves numéricamente
            TreeMap<Integer, Object> mapaOrdenado = new TreeMap<>();

            Iterator<String> claves = obj.keys();
            while (claves.hasNext()) {
                String clave = claves.next();
                int claveNum = Integer.parseInt(clave);
                Object valor = obj.get(clave);
                mapaOrdenado.put(claveNum, valor);
            }

            // Construir el nuevo JSONObject ordenado
            for (Map.Entry<Integer, Object> entrada : mapaOrdenado.entrySet()) {
                String clave = String.valueOf(entrada.getKey());
                Object valor = entrada.getValue();

                if (valor instanceof JSONObject) {
                    // Recursivamente ordenar el siguiente nivel
                    valor = ordenarNivel((JSONObject) valor);
                }
                resultado.put(clave, valor);
            }

        } catch (JSONException e) {
            e.printStackTrace();
        } catch (NumberFormatException e) {
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
                    int mes = Integer.parseInt(monthKey) - 1; // Los meses en Calendar van de 0 a 11
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
                int añoMaximo = calMaxima.get(Calendar.YEAR);
                int mesMaximo = calMaxima.get(Calendar.MONTH) + 1; // Ajuste porque los meses van de 0 a 11
                int diaMaximo = calMaxima.get(Calendar.DAY_OF_MONTH);
                return añoMaximo + "-" + mesMaximo + "-" + diaMaximo;
            } else {
                return null; // No hay fechas en el JSONObject
            }

        } catch (JSONException e) {
            e.printStackTrace();
            return null;
        }
    }

    private void toast(String s){
        generales.toast(s, context);
    }
}
