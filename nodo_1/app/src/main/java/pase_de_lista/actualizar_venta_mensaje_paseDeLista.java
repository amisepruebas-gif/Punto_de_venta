package pase_de_lista;



import static com.example.nodo_1.principal.huellaMensaje_generada;
import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;


import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import com.example.nodo_1.generales;

import descarga_init.descarga;

public class actualizar_venta_mensaje_paseDeLista {

    static public void mensaje(Context context){
        try {
            descarga.unavezMensaje = false;
            generales.saveData_sharedPreferences(
                    context,
                    context.getString(R.string.huella_mensaje),
                    context.getString(R.string.huella_mensaje),  huellaMensaje_generada);
            JSONObject obj = new JSONObject();
            obj.put(context.getString(R.string.huella_mensaje),  huellaMensaje_generada);
            jsonDatos.put(context.getString(R.string.mensajes_ac), obj);


            fire.documenRef("datos/" + "mensajes_ac").
                    set(new Gson().fromJson(
                            jsonDatos.getJSONObject("mensajes_ac").toString(), HashMap.class)).
                    addOnSuccessListener(new OnSuccessListener<Void>() {
                        @Override
                        public void onSuccess(Void unused) {
                            JSONObject object = new JSONObject();
                            try {
                                object.put(context.getString(R.string.huella_mensaje), huellaMensaje_generada);
                                //escuchar_mensaje(object, context);
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    });



        }catch (JSONException e){

        }
    }

}
