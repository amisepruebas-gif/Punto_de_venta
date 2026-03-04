package notificar_actualizar;


import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import descarga_init.descarga;

public class notificarCambioAjustesA_PaseDeLista {
    static public void actualizar(String id_subir, Context context) throws JSONException {
        long tiempoActual = System.currentTimeMillis();
        String huellaArticulos_reset  = Long.toString(tiempoActual, 36);

        JSONArray array_id_dispositivo = new JSONArray();
        for(int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
            String idDispositivo =  jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i);
            JSONObject obj = new JSONObject();
            if(generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo").equals(idDispositivo)){
                obj.put(idDispositivo, true);
            }else obj.put(idDispositivo, false);
            array_id_dispositivo.put(obj);
        }
        String objectString = generales.loadData_sharedPreferences(
                context,
                context.getString(R.string.notificacion_pase_de_lista),
                context.getString(R.string.notificacion_pase_de_lista));
        JSONObject object = new JSONObject();
        if(!objectString.equals("")){
            object = new JSONObject(objectString);
        }
        object.put(id_subir, array_id_dispositivo);
        object.put("huella",  huellaArticulos_reset );


        generales.saveData_sharedPreferences(context, context.getString(R.string.notificacion_update), context.getString(R.string.notificacion_update), object.toString());

        descarga.unaVezNotificacionAjustes = false;
        fire.documenRef("datos/" +   context.getString(R.string.notificacion_update)).
                set(new Gson().fromJson(
                        object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {

                    }
                });
    }
}
