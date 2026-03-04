package com.example.nodo_1;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;

public class fecha {
    private int año;
    private int mes;
    private int dia;

    public fecha(int año, int mes, int dia) {
        this.año = año;
        this.mes = mes;
        this.dia = dia;
    }

    public int getAño() {
        return año;
    }

    public int getMes() {
        return mes;
    }

    public int getDia() {
        return dia;
    }

    @Override
    public String toString() {
        return String.format("%d-%02d-%02d", año, mes, dia);
    }

    public static String encontrarFechaMasAntigua(JSONObject datos) throws JSONException {
        Calendar fechaMasAntigua = null;

        // Iterar sobre los años
        Iterator<String> iterAños = datos.keys();
        while (iterAños.hasNext()) {
            String añoStr = iterAños.next();
            int año = Integer.parseInt(añoStr);

            JSONObject meses = datos.getJSONObject(añoStr);

            // Iterar sobre los meses
            Iterator<String> iterMeses = meses.keys();
            while (iterMeses.hasNext()) {
                String mesStr = iterMeses.next();
                int mes = Integer.parseInt(mesStr);

                JSONObject dias = meses.getJSONObject(mesStr);

                // Iterar sobre los días
                Iterator<String> iterDias = dias.keys();
                while (iterDias.hasNext()) {
                    String diaStr = iterDias.next();
                    int dia = Integer.parseInt(diaStr);

                    // Crear una instancia de Calendar para la fecha actual
                    Calendar fechaActual = Calendar.getInstance();
                    fechaActual.set(año, mes - 1, dia); // Los meses en Calendar son 0-based

                    // Comparar para encontrar la fecha más antigua
                    if (fechaMasAntigua == null || fechaActual.before(fechaMasAntigua)) {
                        fechaMasAntigua = (Calendar) fechaActual.clone();
                    }
                }
            }
        }

        if (fechaMasAntigua != null) {
            // Formatear la fecha sin ceros a la izquierda en mes y día
            int año = fechaMasAntigua.get(Calendar.YEAR);
            int mes = fechaMasAntigua.get(Calendar.MONTH) + 1; // Ajuste porque los meses son 0-based
            int dia = fechaMasAntigua.get(Calendar.DAY_OF_MONTH);
            return String.format("%d-%d-%d", año, mes, dia);
        } else {
            return ""; // No se encontraron fechas
        }
    }

    public static String obtenerFechaMasReciente_en_JSONventa(JSONObject jsnAño) {
        Calendar fechaMasReciente = null;

        try {
            // Iterar sobre los años
            Iterator<String> iterAños = jsnAño.keys();
            while (iterAños.hasNext()) {
                String añoStr = iterAños.next();
                int año = Integer.parseInt(añoStr);

                JSONObject jsnMes = jsnAño.getJSONObject(añoStr);
                Iterator<String> iterMeses = jsnMes.keys();
                while (iterMeses.hasNext()) {
                    String mesStr = iterMeses.next();
                    int mes = Integer.parseInt(mesStr);

                    JSONObject jsnDia = jsnMes.getJSONObject(mesStr);
                    Iterator<String> iterDias = jsnDia.keys();
                    while (iterDias.hasNext()) {
                        String diaStr = iterDias.next();
                        int dia = Integer.parseInt(diaStr);

                        // Crear el objeto Calendar
                        Calendar fechaActual = Calendar.getInstance();
                        try {
                            fechaActual.setLenient(false); // Para validar fechas inválidas
                            fechaActual.set(Calendar.YEAR, año);
                            fechaActual.set(Calendar.MONTH, mes - 1); // Calendar.MONTH es 0-based
                            fechaActual.set(Calendar.DAY_OF_MONTH, dia);
                            fechaActual.getTime(); // Esto lanzará una excepción si la fecha es inválida
                        } catch (Exception e) {
                            // Fecha inválida, continuar con la siguiente

                            continue;
                        }

                        // Comparar y actualizar la fecha más reciente
                        if (fechaMasReciente == null || fechaActual.after(fechaMasReciente)) {
                            fechaMasReciente = fechaActual;
                        }
                    }
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
            return null;
        }

        // Devolver la fecha más reciente en el formato requerido
        if (fechaMasReciente != null) {
            int año = fechaMasReciente.get(Calendar.YEAR);
            int mes = fechaMasReciente.get(Calendar.MONTH) + 1; // Calendar.MONTH es 0-based
            int dia = fechaMasReciente.get(Calendar.DAY_OF_MONTH);
            return año + "-" + mes + "-" + dia;
        } else {
            return null; // No se encontraron fechas
        }
    }
    public static boolean masdeundia(String fecha1Str, String fecha2Str){
        // Convertimos las cadenas de fecha (los primeros 14 caracteres)
        boolean estado = false;
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMddHHmmss");
        try {
            Date fecha1 = dateFormat.parse(fecha1Str.substring(0, 14));
            Date fecha2 = dateFormat.parse(fecha2Str.substring(0, 14));

            // Calculamos la diferencia en milisegundos
            long diferenciaMillis = Math.abs(fecha2.getTime() - fecha1.getTime());

            // Convertimos la diferencia a días
            long diferenciaDias = TimeUnit.MILLISECONDS.toDays(diferenciaMillis);

            // Verificamos si la diferencia es mayor a 1 día
            if (diferenciaDias > 1) {
                estado = true;
            } else {
                estado = false;
            }

        } catch (ParseException e) {
            e.printStackTrace();
        }
        return  estado;
    }
}
