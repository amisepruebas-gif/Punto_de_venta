package pase_de_lista;



import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;


import com.example.nodo_1.generales;

import descarga_init.descarga;

public class actualizarArticulo_paseDeLista {

    static public void actualizaArticulos(String id_subir, Context context, int index) throws JSONException {
        long tiempoActual = System.currentTimeMillis();
        String huella = Long.toString(tiempoActual, 36);

        JSONArray array_id_dispositivo = new JSONArray();
        for(int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
            String idDispositivo =  jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i);
            JSONObject obj = new JSONObject();
            if(generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo").equals(idDispositivo)){
                obj.put(idDispositivo, true);
            }else obj.put(idDispositivo, false);
            array_id_dispositivo.put(obj);
        }
        if (jsonDatos.has(context.getString(R.string.articulos_ac))){
            jsonDatos.getJSONObject(context.getString(R.string.articulos_ac)).put(id_subir, array_id_dispositivo);
            jsonDatos.getJSONObject(context.getString(R.string.articulos_ac)).put("huella", huella);
        }else {
            JSONObject obj = new JSONObject();
            obj.put(id_subir, array_id_dispositivo);
            obj.put("huella", huella);
            jsonDatos.put(context.getString(R.string.articulos_ac), obj);
        }
        if (index == 0){
            descarga.unavezArt = false;
            descarga.huellaArticulos_reset = huella;
            fire.documenRef("datos/" + context.getString(R.string.articulos_ac)).
                    set(new Gson().fromJson(
                            jsonDatos.getJSONObject(context.getString(R.string.articulos_ac)).toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                        @Override
                        public void onSuccess(Void unused) {
                            generales.actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
                        }
                    });
        }
    }
}
