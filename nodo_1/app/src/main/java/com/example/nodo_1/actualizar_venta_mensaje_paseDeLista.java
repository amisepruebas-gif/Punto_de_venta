package com.example.nodo_1;

import static com.example.nodo_1.principal.jsonDatos;
import static descarga_init.descarga.unavezMensaje;

import android.content.Context;

import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

public class actualizar_venta_mensaje_paseDeLista {

    static public void mensaje(Context context){
        try {
            unavezMensaje = false;

            generales.saveData_sharedPreferences(
                    context,
                    context.getString(R.string.huella_mensaje),
                    context.getString(R.string.huella_mensaje),    principal.huellaMensaje_generada);
            JSONObject obj = new JSONObject();
            obj.put(context.getString(R.string.huella_mensaje),    principal.huellaMensaje_generada);
            jsonDatos.put("mensajes_ac", obj);

            fire.documenRef("datos/" + "mensajes_ac").
                    set(new Gson().fromJson(
                            jsonDatos.getJSONObject("mensajes_ac").toString(), HashMap.class));
        }catch (JSONException e){

        }
    }

}
