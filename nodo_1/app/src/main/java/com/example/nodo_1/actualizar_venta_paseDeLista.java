package com.example.nodo_1;

import static com.example.nodo_1.generales.generarID;
import static com.example.nodo_1.principal.jsonDatos;
import static descarga_init.descarga.unavezVenta;

import android.content.Context;

import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

public class actualizar_venta_paseDeLista {
    static public void venta(Context context){
        try {
            unavezVenta = false;
            generales.saveData_sharedPreferences(
                    context,
                    context.getString(R.string.huella_venta),
                    context.getString(R.string.huella_venta), principal.huella_venta_registro);
            JSONObject obj = new JSONObject();
            obj.put(context.getString(R.string.huella_venta), principal.huella_venta_registro);
            jsonDatos.put("ventas_ac", obj);

            fire.documenRef("datos/" + "ventas_ac").
                    set(new Gson().fromJson(
                            jsonDatos.getJSONObject("ventas_ac").toString(), HashMap.class));
        }catch (JSONException e){

        }
    }
    static public void corte(Context context){
        try {
            String huella = generarID();
            generales.saveData_sharedPreferences(
                    context,
                    context.getString(R.string.huella_corte_1),
                    context.getString(R.string.huella_corte_1), huella);
            JSONObject obj = new JSONObject();
            obj.put(context.getString(R.string.huella_corte_1), huella);
            jsonDatos.put(context.getString(R.string.corte_1_ac), obj);

            fire.documenRef("datos/" + context.getString(R.string.corte_1_ac)).
                    set(new Gson().fromJson(
                            jsonDatos.getJSONObject(context.getString(R.string.corte_1_ac)).toString(), HashMap.class));
        }catch (JSONException e){

        }
    }
}
