package venta;

import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.objectFechasCorte;

import android.content.Context;

import androidx.annotation.NonNull;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

public class actualizarFechas {
    public void init(String añoActual, String mesActual, String diaActual, JSONObject objectFechas, String proviene, Context context){
        try {
            if (objectFechas.has(añoActual)){
                if (objectFechas.getJSONObject(añoActual).has(mesActual)){
                    JSONObject object = objectFechas.getJSONObject(añoActual).getJSONObject(mesActual);
                    String str = "";
                    for (int i = 0; i < object.names().length(); i++){
                        if(diaActual.equals(object.names().getString(i))){
                            str = String.valueOf(
                                    Integer.parseInt(object.getString(object.names().getString(i))) + 1);
                        }
                    }
                    if (str.equals("")){
                        objectFechas.getJSONObject(añoActual).getJSONObject(mesActual).put(diaActual, "1");
                    }else {
                        objectFechas.getJSONObject(añoActual).getJSONObject(mesActual).put(diaActual, str);
                    }
                }else {
                    JSONObject object = new JSONObject();
                    object.put(diaActual,"1");
                    objectFechas.getJSONObject(añoActual).put(mesActual, object);
                }
            }else {
                JSONObject object = new JSONObject();
                object.put(diaActual,"1");
                JSONObject objMes = new JSONObject();
                objMes.put(mesActual, object);
                objectFechas.put(añoActual, objMes);
            }
            String direccion = "";
            if(proviene.equals("jsonVenta")) {
                direccion = context.getString(R.string.ventas_n);
            } else if (proviene.equals("jsonCorteHistorial")) {
                direccion = context.getString(R.string.corte_1);
            }
            fire.documenRef(direccion + "/" + añoActual).
                    set(new Gson().fromJson(
                            objectFechas.getJSONObject(añoActual).toString(), HashMap.class)).addOnCompleteListener(new OnCompleteListener<Void>() {
                        @Override
                        public void onComplete(@NonNull Task<Void> task) {
                            objectFechasCorte = objectFechas;
                            actualizarDatosGuardados("objectFechasCorte"    , objectFechasCorte.toString()  , context);
                        }
                    });
        }catch (JSONException e){
            toast("error actualizar fechas", context);
        }
    }
}
