package com.example.nodo_1;

import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.getAnñoMesDiaHora;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonMensajes_n;
import static com.example.nodo_1.principal.objectFechasMensaje;
import static descarga_init.descarga.unavezMensaje;

import android.content.Context;

import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.TimeZone;

public class mandarPorMensaje {
    public void mandarMensaje(String enTurno,String mensaje, Context context){
        Calendar c = Calendar.getInstance();
        String año = "20" + getAnñoMesDiaHora("año");
        String mes = generales.quitarCero(getAnñoMesDiaHora("mes"));
        String dia = generales.quitarCero(getAnñoMesDiaHora("dia"));

        JSONObject objDatosMensaje = new JSONObject();
        try {
            /**  DATOS BASE  **/
            objDatosMensaje.put("corte"     ,"");
            objDatosMensaje.put("hora"      ,getTiempo());
            objDatosMensaje.put("id"        ,generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo"));
            objDatosMensaje.put("usuario"   ,enTurno);
            objDatosMensaje.put("texto"     ,mensaje);

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }


        String fechaNoExiste = "";
        JSONObject objectDia = new JSONObject();
        JSONObject objectMes = new JSONObject();

        if(jsonMensajes_n.length()>0){
            if(jsonMensajes_n.has(String.valueOf(c.get(Calendar.YEAR)))){
                try {
                    if(jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).has(String.valueOf(c.get(Calendar.MONTH) +1 ))){
                        if (jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).
                                getJSONObject(String.valueOf(c.get(Calendar.MONTH) +1 )).has(String.valueOf(c.get(Calendar.DAY_OF_MONTH)))){

                        }else fechaNoExiste = "dia";
                    }else fechaNoExiste = "mes";
                } catch (JSONException e_) {
                    throw new RuntimeException(e_);
                }
            }else fechaNoExiste = "año";

            if(!fechaNoExiste.equals("")){
                //JSONObject objectMensaje = new JSONObject();
                switch (fechaNoExiste){
                    case "año":
                        try {
                            objDatosMensaje.put("inicioAño"     , año);
                            objDatosMensaje.put("inicioDeMes"   , mes);
                            objDatosMensaje.put("nuevoDia"      , dia);
                            //objectMensaje.put("1", objDatosMensaje);

                            JSONArray array = new JSONArray();
                            array.put(objDatosMensaje);
                            objectDia.put(dia, array);
                            objectMes.put(mes, objectDia);

                            jsonMensajes_n.put( año, objectMes);

                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);
                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(
                                            object.toString(), HashMap.class));


                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        break;
                    case "mes":
                        try {
                            objDatosMensaje.put("inicioDeMes"   ,mes);
                            objDatosMensaje.put("nuevoDia"      ,dia);

                            //objectMensaje.put("1", objDatosMensaje);
                            JSONArray array = new JSONArray();
                            array.put(objDatosMensaje);
                            objectDia.put(dia, array);
                            jsonMensajes_n.getJSONObject(año).put(mes, objectDia);

                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);
                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(
                                            object.toString(), HashMap.class));


                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        break;
                    case "dia":
                        try {
                            objDatosMensaje.put("nuevoDia"      , dia);

                            //objectMensaje.put("1", objDatosMensaje);

                            JSONArray array = new JSONArray();

                            array.put(objDatosMensaje);

                            jsonMensajes_n.
                                    getJSONObject(año).
                                    getJSONObject(mes).
                                    put(dia, array);

                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);

                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(
                                            object.toString(), HashMap.class));



                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        break;
                }

            }else {
                try {
                    jsonMensajes_n.
                            getJSONObject(año).
                            getJSONObject(mes).
                            getJSONArray(dia).put(objDatosMensaje);

                    JSONObject object = new JSONObject();
                    object.put("mensajes", jsonMensajes_n.
                            getJSONObject(año).
                            getJSONObject(mes).
                            getJSONArray(dia));
                    fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                            set(new Gson().fromJson(
                                    object.toString(), HashMap.class));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }else {
            try {
                objDatosMensaje.put("nuevoDia"      , dia);
                JSONArray array = new JSONArray();
                array.put(objDatosMensaje);
                objectDia.put(dia, array);
                objectMes.put(mes, objectDia);

                jsonMensajes_n.put(año, objectMes);

                JSONObject object = new JSONObject();
                object.put("mensajes", array);
                fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                        set(new Gson().fromJson(
                                object.toString(), HashMap.class));
            } catch (JSONException e) {
                e.printStackTrace();
            }

        }
        try{
            if(objectFechasMensaje.length() > 0){
                if (objectFechasMensaje.has(año)){
                    if (objectFechasMensaje.getJSONObject(año).has(mes)){
                        if(objectFechasMensaje.getJSONObject(año).getJSONObject(mes).has(dia)){
                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia,
                                    String.valueOf(Integer.parseInt(
                                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).getString(dia)
                                    ) + 1));
                        }else {
                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia,"1");
                        }

                    }else {
                        JSONObject object = new JSONObject();
                        object.put(dia, "1");
                        objectFechasMensaje.getJSONObject(año).put(mes, object);
                    }
                }else {
                    JSONObject object = new JSONObject();
                    object.put(dia, "1");
                    JSONObject objMes = new JSONObject();
                    objMes.put(mes, object);
                    objectFechasMensaje.put(año, objMes);
                }

            }else {
                JSONObject object = new JSONObject();
                object.put(dia, "1");
                JSONObject objMes = new JSONObject();
                objMes.put(mes, object);
                objectFechasMensaje.put(año, objMes);
            }
            //objectFechasMensaje

            fire.documenRef("mensajes_n/" + año).
                    set(new Gson().fromJson(
                            objectFechasMensaje.getJSONObject(año).toString(), HashMap.class));

            actualizarDatosGuardados("objectFechasMensaje"    , objectFechasMensaje.toString()  , context);


            principal.huellaMensaje_generada = editar_articulos.generarID();

            unavezMensaje = false;

            actualizar_venta_mensaje_paseDeLista.mensaje(context);


        }catch (JSONException e){
            throw new RuntimeException();
        }

        generales.actualizarDatosGuardados("jsonMensajes_n", jsonMensajes_n.toString(),context);
        generales.actualizarDatosGuardados("jsonDatos",      jsonDatos.toString(),context);
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
}
