package com.example.nodo_1;

import static com.example.nodo_1.principal.jsonDatos;

import android.app.DatePickerDialog;
import android.content.Intent;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

import de.hdodenhof.circleimageview.CircleImageView;

public class datos_equipo_de_trabajo extends AppCompatActivity implements DatePickerDialog.OnDateSetListener, View.OnClickListener {

    TextView textView_diasFaltantes, nombre;
    TextInputEditText nota;
    EditText editTlefono;
    int index;
    CircleImageView circleImageView;

    // Utilizar Calendar en lugar de LocalDate
    Calendar fechaSeleccionada = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.info_equipo_de_trabajo);
        initPantalla();

        textView_diasFaltantes  = findViewById(R.id.textView_diasFaltantes);
        nota                    = findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo);
        circleImageView         = findViewById(R.id.circleImageView_eq_trabajo);
        nombre                  = findViewById(R.id.info_equipo_nombre_textView);
        editTlefono             = findViewById(R.id.editTlefono);


        // Configurar listeners
        Button but_fechaIngreso = findViewById(R.id.but_fechaIngreso);
        Button butGuardar = findViewById(R.id.butGuardar_info_equipo_trabajo);
        but_fechaIngreso.setOnClickListener(this);
        butGuardar.setOnClickListener(this);

        Intent intent = getIntent();

        if (intent != null){
            if(intent.hasExtra("index")){
                index = intent.getIntExtra("index", 0);
                String idUsuario  = intent.getStringExtra("idUsuario");
                JSONObject object = new JSONObject();
                try {
                    object = new JSONObject(intent.getStringExtra("jsn"));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                if(jsonDatos.length() > 0){
                    if(jsonDatos.has(getString(R.string.equipoDeTrabajo))){
                        try {
                            if(jsonDatos.getJSONObject(getString(R.string.equipoDeTrabajo)).has(idUsuario)){
                                object = jsonDatos.getJSONObject(getString(R.string.equipoDeTrabajo)).getJSONObject(idUsuario);
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
                try {
                    Drawable drawable;
                    if(object.has("fechaTexto")) {
                        Calendar seleccionada = parsearFechaConSimpleDateFormat(object.getString("huellaFecha"));
                        fechaSeleccionada = seleccionada;
                        diasQueHanPasado(true);
                        nombre                .setText(object.getString("nombre"));
                        ((Button)findViewById(R.id.but_fechaIngreso)).setText(object.getString("fechaIngreso"));
                        int idDrawable = getResources().getIdentifier(object.getString("icono"), "drawable", getPackageName());
                        if (idDrawable != 0) {
                            drawable = getResources().getDrawable(idDrawable, getTheme());
                            circleImageView.setImageDrawable(drawable);
                        }
                    }
                    if(object.has("nota"))nota.setText(object.getString("nota"));
                    if(object.has("telefono"))editTlefono.setText(object.getString("telefono"));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }
    public Calendar parsearFechaConSimpleDateFormat(String fechaString) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        try {
            Date date = sdf.parse(fechaString);
            if (date != null) {
                Calendar calendario = Calendar.getInstance();
                calendario.setTime(date);
                // Opcional: Resetear hora, minutos, segundos y milisegundos
                calendario.set(Calendar.HOUR_OF_DAY, 0);
                calendario.set(Calendar.MINUTE, 0);
                calendario.set(Calendar.SECOND, 0);
                calendario.set(Calendar.MILLISECOND, 0);
                return calendario;
            }
        } catch (ParseException e) {
            e.printStackTrace();
        }
        return null; // Retornar null si el parseo falla
    }
    @Override
    public void onClick(View view) {
        if(R.id.but_fechaIngreso == view.getId()){
            mostrarDatePickerDialog();
        } else if (R.id.butGuardar_info_equipo_trabajo == view.getId()) {
            if(!textView_diasFaltantes.getText().toString().equals("0 días") || nota.length() > 0){
                Intent intent = new Intent(this, equipo_de_trabajo.class);
                intent.putExtra("index", index);
                JSONObject objectDatos = new JSONObject();
                try {
                    if(!textView_diasFaltantes.getText().toString().equals("0 días")){
                        // Formatear fechaSeleccionada a String
                        String fechaString = obtenerFechaFormateada(fechaSeleccionada);
                        objectDatos.put("huellaFecha",   fechaString);
                        objectDatos.put("fechaTexto",    textView_diasFaltantes.getText().toString());
                        objectDatos.put("fechaIngreso",  ((Button)findViewById(R.id.but_fechaIngreso)).getText().toString());
                    }
                    if (nota.length() > 0){
                        objectDatos.put("nota", nota.getText().toString());
                    }
                    if(editTlefono.length() > 0){
                        objectDatos.put("telefono", editTlefono.getText().toString());
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                intent.putExtra("jsn", objectDatos.toString());
                setResult(RESULT_OK, intent);
                finish();
            }
        }
    }

    private void mostrarDatePickerDialog() {
        // Obtiene la fecha actual
        final Calendar calendario = Calendar.getInstance();
        int anio = calendario.get(Calendar.YEAR);
        int mes = calendario.get(Calendar.MONTH);
        int dia = calendario.get(Calendar.DAY_OF_MONTH);

        // Crea una instancia de DatePickerDialog y la muestra
        DatePickerDialog datePickerDialog = new DatePickerDialog(
                this,
                this, // El listener es la propia actividad que implementa OnDateSetListener
                anio, mes, dia);
        datePickerDialog.show();
    }

    @Override
    public void onDateSet(DatePicker view, int anio, int mes, int diaDelMes) {
        // Ajuste del mes (recordar que enero es 0)
        int mesCorregido = mes; // Calendar.MONTH es 0-based, no es necesario corregir

        // Configurar fechaSeleccionada
        Calendar seleccionada = Calendar.getInstance();
        seleccionada.set(anio, mesCorregido, diaDelMes, 0, 0, 0);
        seleccionada.set(Calendar.MILLISECOND, 0);
        fechaSeleccionada = seleccionada;
        diasQueHanPasado(false);
    }
    private void diasQueHanPasado(boolean estado){
        // Obtener fecha actual
        Calendar fechaActual = Calendar.getInstance();
        fechaActual.set(Calendar.HOUR_OF_DAY, 0);
        fechaActual.set(Calendar.MINUTE, 0);
        fechaActual.set(Calendar.SECOND, 0);
        fechaActual.set(Calendar.MILLISECOND, 0);

        if (fechaSeleccionada.after(fechaActual)) {
            // Fecha seleccionada es futura
            int[] dif = calcularDiferencia(fechaActual, fechaSeleccionada);
            String mensaje = construirMensaje("Faltan: ", dif);
            textView_diasFaltantes.setText(mensaje);
            if(!estado)((Button)findViewById(R.id.but_fechaIngreso)).setText(obtenerFechaActualFormateada(fechaSeleccionada));
        } else if (fechaSeleccionada.before(fechaActual)) {
            // Fecha seleccionada es pasada
            int[] dif = calcularDiferencia(fechaSeleccionada, fechaActual);
            String mensaje = construirMensaje("Han pasado: ", dif);
            textView_diasFaltantes.setText(mensaje);
            if(!estado)((Button)findViewById(R.id.but_fechaIngreso)).setText(obtenerFechaActualFormateada(fechaSeleccionada));
        } else {
            // Fecha seleccionada es hoy
            textView_diasFaltantes.setText("Hoy es la fecha seleccionada");
            if(!estado)((Button)findViewById(R.id.but_fechaIngreso)).setText(obtenerFechaActualFormateada(fechaSeleccionada));
        }
    }

    /**
     * Calcula la diferencia en años, meses y días entre dos fechas.
     *
     * @param inicio Fecha de inicio.
     * @param fin    Fecha de fin.
     * @return Array con [años, meses, días].
     */
    private int[] calcularDiferencia(Calendar inicio, Calendar fin) {
        int anos = fin.get(Calendar.YEAR) - inicio.get(Calendar.YEAR);
        int meses = fin.get(Calendar.MONTH) - inicio.get(Calendar.MONTH);
        int dias = fin.get(Calendar.DAY_OF_MONTH) - inicio.get(Calendar.DAY_OF_MONTH);

        if (dias < 0) {
            meses--;
            // Obtener el último día del mes anterior
            Calendar temp = (Calendar) fin.clone();
            temp.add(Calendar.MONTH, -1);
            dias += temp.getActualMaximum(Calendar.DAY_OF_MONTH);
        }

        if (meses < 0) {
            anos--;
            meses += 12;
        }

        return new int[]{anos, meses, dias};
    }

    /**
     * Construye el mensaje de diferencia en años, meses y días.
     *
     * @param prefijo Prefijo del mensaje ("Faltan: " o "Han pasado: ").
     * @param dif      Array con [años, meses, días].
     * @return Mensaje formateado.
     */
    private String construirMensaje(String prefijo, int[] dif) {
        int anos = dif[0];
        int meses = dif[1];
        int dias = dif[2];

        StringBuilder resultado = new StringBuilder(prefijo);

        if (anos > 0) {
            resultado.append(anos).append(anos == 1 ? " año " : " años ");
        }

        if (meses > 0) {
            resultado.append(meses).append(meses == 1 ? " mes " : " meses ");
        }

        if (dias > 0) {
            resultado.append(dias).append(dias == 1 ? " día" : " días");
        }

        return resultado.toString().trim();
    }

    /**
     * Formatea la fecha seleccionada a un String legible.
     *
     * @param fecha Calendar de la fecha seleccionada.
     * @return Fecha formateada.
     */
    public String obtenerFechaActualFormateada(Calendar fecha) {
        // Define el formato deseado
        SimpleDateFormat formatoFecha = new SimpleDateFormat("EEEE dd 'de' MMMM 'de' yyyy", new Locale("es", "ES"));

        // Formatea la fecha
        String fechaFormateada = formatoFecha.format(fecha.getTime());

        // Capitaliza la primera letra de cada palabra
        String fechaCapitalizada = capitalizarPrimeraLetra(fechaFormateada);

        return fechaCapitalizada;
    }

    /**
     * Capitaliza la primera letra de cada palabra en una cadena.
     *
     * @param texto El texto a capitalizar.
     * @return El texto con la primera letra de cada palabra en mayúscula.
     */
    private String capitalizarPrimeraLetra(String texto) {
        if (texto == null || texto.isEmpty()) {
            return texto;
        }

        String[] palabras = texto.split(" ");
        StringBuilder resultado = new StringBuilder();

        for (String palabra : palabras) {
            if (palabra.length() > 0) {
                resultado.append(palabra.substring(0, 1).toUpperCase())
                        .append(palabra.substring(1))
                        .append(" ");
            } else {
                resultado.append(palabra).append(" ");
            }
        }

        // Eliminar el espacio al final y retornar
        return resultado.toString().trim();
    }

    /**
     * Formatea una fecha Calendar a un String en formato "yyyy-MM-dd".
     *
     * @param fecha Calendar de la fecha a formatear.
     * @return Fecha formateada.
     */
    private String obtenerFechaFormateada(Calendar fecha) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        return sdf.format(fecha.getTime());
    }

    private void initPantalla(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(getResources().getColor(R.color.morado));

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
}
