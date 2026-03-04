package pase_de_lista;


import static com.example.nodo_1.fire.documenRef;

import android.content.Context;

import com.example.nodo_1.R;
import com.example.nodo_1.editar_articulos;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import com.example.nodo_1.generales;

public class notificarCambioAjustesA_PaseDeLista {

    static public void actualizar(String id_subir, String status,Context context) throws JSONException {
        long tiempoActual = System.currentTimeMillis();
        descarga_init.descarga.huellaArticulos_reset  = Long.toString(tiempoActual, 36);

        JSONObject object_obj = new JSONObject();

        String objectString_nuevo = generales.loadData_sharedPreferences(
                context,
                context.getString(R.string.notificacion_lista),
                context.getString(R.string.notificacion_lista));

        if(!objectString_nuevo.equals("")){
            object_obj = new JSONObject(objectString_nuevo);
        }
        JSONObject object1 = new JSONObject();
        object1.put("emisor", generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo"));
        object1.put("huella", editar_articulos.generarID());
        object1.put("valor", status);

        object_obj.put(id_subir, object1);
        JSONObject finalObject_obj = object_obj;
        documenRef("datos/" +   context.getString(R.string.notificacion_lista_url)).
                set(new Gson().fromJson(
                        object_obj.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {
                        generales.saveData_sharedPreferences(
                                context,
                                context.getString(R.string.notificacion_lista),
                                context.getString(R.string.notificacion_lista), finalObject_obj.toString());
                    }
                });
    }
}
