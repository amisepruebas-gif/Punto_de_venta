package com.example.nodo_1;

import android.app.DatePickerDialog;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.firestore.DocumentSnapshot;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

import static com.example.nodo_1.generales.actualizarDatosGuardados;

public class DescargaManualActivity extends AppCompatActivity implements View.OnClickListener {

    TextView txtStatus;
    int fechaDesdeAño, fechaDesdeMes, fechaDesdeDia;
    int fechaHastaAño, fechaHastaMes, fechaHastaDia;
    boolean desdeSeleccionado = false, hastaSeleccionado = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_descarga_manual);
        txtStatus = findViewById(R.id.txtStatus);
    }

    @Override
    public void onClick(View view) {
        int id = view.getId();
        if (id == R.id.butRegresar) {
            finish();
        } else if (id == R.id.butDescargarVentas) {
            mostrarPopFechas("Descargar Ventas", "ventas_n", "registro");
        } else if (id == R.id.butDescargarMensajes) {
            mostrarPopFechas("Descargar Mensajes", "mensajes_n", "mensajes");
        } else if (id == R.id.butDescargarDatos) {
            descargarDatosCompleto();
        }
    }

    private void mostrarPopFechas(String titulo, String coleccion, String arrayName) {
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        View popupView = inflater.inflate(R.layout.pop_descarga_fechas, null);

        final PopupWindow popupWindow = new PopupWindow(popupView,
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT, true);
        popupWindow.showAtLocation(findViewById(android.R.id.content), Gravity.CENTER, 0, 0);

        TextView txtTitulo = popupView.findViewById(R.id.txtTitulo);
        txtTitulo.setText(titulo);

        Button butDescargarTodo = popupView.findViewById(R.id.butDescargarTodo);
        Button butFechaDesde = popupView.findViewById(R.id.butFechaDesde);
        Button butFechaHasta = popupView.findViewById(R.id.butFechaHasta);
        Button butDescargarRango = popupView.findViewById(R.id.butDescargarRango);
        Button butCancelar = popupView.findViewById(R.id.butCancelar);

        desdeSeleccionado = false;
        hastaSeleccionado = false;

        butDescargarTodo.setOnClickListener(v -> {
            popupWindow.dismiss();
            descargarTodo(coleccion, arrayName);
        });

        butFechaDesde.setOnClickListener(v -> {
            Calendar cal = Calendar.getInstance();
            new DatePickerDialog(this, (dp, year, month, day) -> {
                fechaDesdeAño = year;
                fechaDesdeMes = month + 1;
                fechaDesdeDia = day;
                desdeSeleccionado = true;
                butFechaDesde.setText(day + "/" + (month + 1) + "/" + year);
                if (!hastaSeleccionado) {
                    fechaHastaAño = year;
                    fechaHastaMes = month + 1;
                    fechaHastaDia = day;
                    hastaSeleccionado = true;
                    butFechaHasta.setText(day + "/" + (month + 1) + "/" + year);
                }
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show();
        });

        butFechaHasta.setOnClickListener(v -> {
            Calendar cal = Calendar.getInstance();
            new DatePickerDialog(this, (dp, year, month, day) -> {
                fechaHastaAño = year;
                fechaHastaMes = month + 1;
                fechaHastaDia = day;
                hastaSeleccionado = true;
                butFechaHasta.setText(day + "/" + (month + 1) + "/" + year);
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show();
        });

        butDescargarRango.setOnClickListener(v -> {
            if (!desdeSeleccionado || !hastaSeleccionado) {
                Toast.makeText(this, "Selecciona ambas fechas", Toast.LENGTH_SHORT).show();
                return;
            }
            popupWindow.dismiss();
            descargarRango(coleccion, arrayName,
                    fechaDesdeAño, fechaDesdeMes, fechaDesdeDia,
                    fechaHastaAño, fechaHastaMes, fechaHastaDia);
        });

        butCancelar.setOnClickListener(v -> popupWindow.dismiss());
    }

    private void descargarTodo(String coleccion, String arrayName) {
        txtStatus.setText("Descargando todo de " + coleccion + "...");

        fire.colRef(coleccion).get().addOnSuccessListener(documentSnapshots -> {
            if (documentSnapshots.isEmpty()) {
                txtStatus.setText("No se encontraron datos en " + coleccion);
                return;
            }
            JSONObject fechasObj = new JSONObject();
            for (DocumentSnapshot doc : documentSnapshots) {
                try {
                    fechasObj.put(doc.getId(), mapToJSON(doc.getData()));
                } catch (JSONException e) { e.printStackTrace(); }
            }

            String objectFechasName = coleccion.equals("ventas_n") ? "objectFechasVenta" : "objectFechasMensaje";
            actualizarDatosGuardados(objectFechasName, fechasObj.toString(), this);
            if (coleccion.equals("ventas_n")) {
                principal.objectFechasVenta = fechasObj;
            } else {
                principal.objectFechasMensaje = fechasObj;
            }

            descargarTodasLasFechas(coleccion, arrayName, fechasObj);
        }).addOnFailureListener(e -> txtStatus.setText("Error: " + e.getMessage()));
    }

    private void descargarTodasLasFechas(String coleccion, String arrayName, JSONObject fechasObj) {
        JSONObject resultado = new JSONObject();
        List<Task<DocumentSnapshot>> allTasks = new ArrayList<>();
        HashMap<String, HashMap<String, HashMap<String, String>>> conteoPorAnio = new HashMap<>();

        try {
            java.util.Iterator<String> years = fechasObj.keys();
            while (years.hasNext()) {
                String year = years.next();
                JSONObject meses = fechasObj.getJSONObject(year);
                java.util.Iterator<String> months = meses.keys();
                while (months.hasNext()) {
                    String month = months.next();
                    JSONObject dias = meses.getJSONObject(month);
                    java.util.Iterator<String> days = dias.keys();
                    while (days.hasNext()) {
                        String day = days.next();
                        String path = coleccion + "/" + year + "/" + month + "/" + day;
                        Task<DocumentSnapshot> task = fire.documenRef(path).get();
                        allTasks.add(task);

                        final String y = year, m = month, d = day;
                        task.addOnCompleteListener(t -> {
                            if (t.isSuccessful() && t.getResult().exists()) {
                                try {
                                    JSONObject data = mapToJSON(Objects.requireNonNull(t.getResult().getData()));
                                    int count = 0;
                                    synchronized (resultado) {
                                        if (!resultado.has(y)) resultado.put(y, new JSONObject());
                                        if (!resultado.getJSONObject(y).has(m))
                                            resultado.getJSONObject(y).put(m, new JSONObject());
                                        if (arrayName.equals("registro")) {
                                            JSONObject wrap = new JSONObject();
                                            JSONArray arr = data.getJSONArray("registro");
                                            wrap.put("registro", arr);
                                            resultado.getJSONObject(y).getJSONObject(m).put(d, wrap);
                                            count = arr.length();
                                        } else {
                                            JSONArray arr = data.getJSONArray(arrayName);
                                            resultado.getJSONObject(y).getJSONObject(m).put(d, arr);
                                            count = arr.length();
                                        }
                                    }
                                    synchronized (conteoPorAnio) {
                                        conteoPorAnio.computeIfAbsent(y, k -> new HashMap<>())
                                                .computeIfAbsent(m, k -> new HashMap<>())
                                                .put(d, String.valueOf(count));
                                    }
                                } catch (JSONException e) { e.printStackTrace(); }
                            }
                            int done = (int) allTasks.stream().filter(Task::isComplete).count();
                            runOnUiThread(() -> txtStatus.setText("Descargando " + done + " de " + allTasks.size() + "..."));
                        });
                    }
                }
            }
        } catch (JSONException e) { e.printStackTrace(); }

        Tasks.whenAll(allTasks).addOnCompleteListener(task -> {
            String jsonName = coleccion.equals("ventas_n") ? "jsonVenta" : "jsonMensajes_n";
            if (coleccion.equals("ventas_n")) {
                principal.jsonVenta = resultado;
            } else {
                principal.jsonMensajes_n = resultado;
            }
            actualizarDatosGuardados(jsonName, resultado.toString(), this);

            actualizarDocumentosAnio(coleccion, conteoPorAnio);

            txtStatus.setText("Descarga completa: " + coleccion + " (" + allTasks.size() + " dias)");
        });
    }

    private void descargarRango(String coleccion, String arrayName,
                                int desdeAño, int desdeMes, int desdeDia,
                                int hastaAño, int hastaMes, int hastaDia) {
        txtStatus.setText("Descargando rango de " + coleccion + "...");

        Calendar desde = Calendar.getInstance();
        desde.set(desdeAño, desdeMes - 1, desdeDia, 0, 0, 0);
        Calendar hasta = Calendar.getInstance();
        hasta.set(hastaAño, hastaMes - 1, hastaDia, 0, 0, 0);

        List<int[]> fechas = new ArrayList<>();
        Calendar current = (Calendar) desde.clone();
        while (!current.after(hasta)) {
            fechas.add(new int[]{
                    current.get(Calendar.YEAR),
                    current.get(Calendar.MONTH) + 1,
                    current.get(Calendar.DAY_OF_MONTH)
            });
            current.add(Calendar.DAY_OF_MONTH, 1);
        }

        if (fechas.isEmpty()) {
            txtStatus.setText("Rango invalido");
            return;
        }

        String jsonName = coleccion.equals("ventas_n") ? "jsonVenta" : "jsonMensajes_n";
        JSONObject existente = coleccion.equals("ventas_n") ? principal.jsonVenta : principal.jsonMensajes_n;
        if (existente == null) existente = new JSONObject();
        final JSONObject resultado = existente;

        List<Task<DocumentSnapshot>> allTasks = new ArrayList<>();
        HashMap<String, HashMap<String, HashMap<String, String>>> conteoPorAnio = new HashMap<>();
        final int totalDias = fechas.size();

        for (int[] f : fechas) {
            String y = String.valueOf(f[0]);
            String m = String.valueOf(f[1]);
            String d = String.valueOf(f[2]);
            String path = coleccion + "/" + y + "/" + m + "/" + d;

            Task<DocumentSnapshot> task = fire.documenRef(path).get();
            allTasks.add(task);
            task.addOnCompleteListener(t -> {
                if (t.isSuccessful() && t.getResult().exists()) {
                    try {
                        JSONObject data = mapToJSON(Objects.requireNonNull(t.getResult().getData()));
                        int count = 0;
                        synchronized (resultado) {
                            if (!resultado.has(y)) resultado.put(y, new JSONObject());
                            if (!resultado.getJSONObject(y).has(m))
                                resultado.getJSONObject(y).put(m, new JSONObject());
                            if (arrayName.equals("registro")) {
                                JSONObject wrap = new JSONObject();
                                JSONArray arr = data.getJSONArray("registro");
                                wrap.put("registro", arr);
                                resultado.getJSONObject(y).getJSONObject(m).put(d, wrap);
                                count = arr.length();
                            } else {
                                JSONArray arr = data.getJSONArray(arrayName);
                                resultado.getJSONObject(y).getJSONObject(m).put(d, arr);
                                count = arr.length();
                            }
                        }
                        synchronized (conteoPorAnio) {
                            conteoPorAnio.computeIfAbsent(y, k -> new HashMap<>())
                                    .computeIfAbsent(m, k -> new HashMap<>())
                                    .put(d, String.valueOf(count));
                        }
                    } catch (JSONException e) { e.printStackTrace(); }
                }
                int done = (int) allTasks.stream().filter(Task::isComplete).count();
                runOnUiThread(() -> txtStatus.setText("Descargando " + done + " de " + totalDias + "..."));
            });
        }

        Tasks.whenAll(allTasks).addOnCompleteListener(task -> {
            if (coleccion.equals("ventas_n")) {
                principal.jsonVenta = resultado;
            } else {
                principal.jsonMensajes_n = resultado;
            }
            actualizarDatosGuardados(jsonName, resultado.toString(), this);

            // Actualizar documentos de año en Firestore
            actualizarDocumentosAnio(coleccion, conteoPorAnio);

            // Actualizar objectFechas local
            String objectFechasName = coleccion.equals("ventas_n") ? "objectFechasVenta" : "objectFechasMensaje";
            JSONObject objectFechas = coleccion.equals("ventas_n") ? principal.objectFechasVenta : principal.objectFechasMensaje;
            if (objectFechas == null) objectFechas = new JSONObject();
            try {
                for (Map.Entry<String, HashMap<String, HashMap<String, String>>> yearEntry : conteoPorAnio.entrySet()) {
                    String yr = yearEntry.getKey();
                    if (!objectFechas.has(yr)) objectFechas.put(yr, new JSONObject());
                    JSONObject mesesObj = objectFechas.getJSONObject(yr);
                    for (Map.Entry<String, HashMap<String, String>> monthEntry : yearEntry.getValue().entrySet()) {
                        String mo = monthEntry.getKey();
                        if (!mesesObj.has(mo)) mesesObj.put(mo, new JSONObject());
                        JSONObject diasObj = mesesObj.getJSONObject(mo);
                        for (Map.Entry<String, String> dayEntry : monthEntry.getValue().entrySet()) {
                            diasObj.put(dayEntry.getKey(), dayEntry.getValue());
                        }
                    }
                }
            } catch (JSONException e) { e.printStackTrace(); }
            if (coleccion.equals("ventas_n")) {
                principal.objectFechasVenta = objectFechas;
            } else {
                principal.objectFechasMensaje = objectFechas;
            }
            actualizarDatosGuardados(objectFechasName, objectFechas.toString(), this);

            int descargados = 0;
            for (Task<DocumentSnapshot> t : allTasks) {
                if (t.isSuccessful() && t.getResult().exists()) descargados++;
            }
            txtStatus.setText("Descarga completa: " + descargados + " de " + totalDias + " dias encontrados");
        });
    }

    private void actualizarDocumentosAnio(String coleccion, HashMap<String, HashMap<String, HashMap<String, String>>> conteoPorAnio) {
        for (Map.Entry<String, HashMap<String, HashMap<String, String>>> yearEntry : conteoPorAnio.entrySet()) {
            String year = yearEntry.getKey();
            HashMap<String, Object> yearData = new HashMap<>();
            for (Map.Entry<String, HashMap<String, String>> monthEntry : yearEntry.getValue().entrySet()) {
                yearData.put(monthEntry.getKey(), new HashMap<>(monthEntry.getValue()));
            }
            fire.documenRef(coleccion + "/" + year).set(yearData, com.google.firebase.firestore.SetOptions.merge());
        }
    }

    private void descargarDatosCompleto() {
        txtStatus.setText("Descargando datos...");
        fire.colRef("datos").get().addOnSuccessListener(documentSnapshots -> {
            if (documentSnapshots.isEmpty()) {
                txtStatus.setText("No se encontraron datos");
                return;
            }
            JSONObject json = new JSONObject();
            for (DocumentSnapshot doc : documentSnapshots) {
                try {
                    json.put(doc.getId(), mapToJSON(doc.getData()));
                } catch (JSONException e) { e.printStackTrace(); }
            }
            principal.jsonDatos = json;
            actualizarDatosGuardados("jsonDatos", json.toString(), this);
            txtStatus.setText("Datos descargados correctamente");
        }).addOnFailureListener(e -> txtStatus.setText("Error: " + e.getMessage()));
    }

    public static JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof Map) {
                obj.put(entry.getKey(), mapToJSON((Map<String, Object>) value));
            } else if (value instanceof List) {
                obj.put(entry.getKey(), listToJSONArray((List<Object>) value));
            } else {
                obj.put(entry.getKey(), value);
            }
        }
        return obj;
    }

    private static JSONArray listToJSONArray(List<Object> list) throws JSONException {
        JSONArray arr = new JSONArray();
        for (Object obj : list) {
            if (obj instanceof Map) {
                arr.put(mapToJSON((Map<String, Object>) obj));
            } else if (obj instanceof List) {
                arr.put(listToJSONArray((List<Object>) obj));
            } else {
                arr.put(obj);
            }
        }
        return arr;
    }
}
