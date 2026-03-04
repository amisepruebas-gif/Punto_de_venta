package modulos_carga;

import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static descarga_init.descarga.unavezVenta;

import android.content.Context;

import androidx.annotation.NonNull;

import com.example.nodo_1.R;
import com.example.nodo_1.actualizar_venta_paseDeLista;
import com.example.nodo_1.fire;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import notificar_actualizar.notificarCambioAjustesA_PaseDeLista;

public class subir_documento_sobre_fechas {

    public String init(JSONObject objectCarga,JSONObject doc_a_subir, String añoActual, String mesActual, String diaActual, Context context, String proviene){
        try {
            String direccion = "", nameArray = "registro";
            if(proviene.equals("jsonVenta")) {
                direccion = context.getString(R.string.ventas_n);
            } else if (proviene.equals("jsonCorteHistorial")) {
                direccion = context.getString(R.string.corte_1);
            }

            String numeroDeVenta = "";
            JSONObject registros = new JSONObject();
            String date = "";
            if (objectCarga.length() > 0){
                if(objectCarga.has(añoActual)){
                    if (objectCarga.getJSONObject(añoActual).has(mesActual)){
                        if(objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).has(diaActual)){
                            date = "igual";
                        }else date = "dia";
                    }else date = "mes";
                }else date = "año";
            }


            if(objectCarga.length() == 0 || date.isEmpty() || date.equals("año")){
                JSONObject mesJSN = new JSONObject();
                JSONObject diaJSN = new JSONObject();

                JSONArray array = new JSONArray();
                array.put(doc_a_subir);
                registros.put(nameArray,array);


                diaJSN.put(diaActual, registros);
                mesJSN.put(mesActual, diaJSN);
                objectCarga.put(añoActual,mesJSN);
                numeroDeVenta =
                        String.valueOf(objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).getJSONObject(diaActual).getJSONArray(nameArray).length() - 1);

                fire.documenRef(direccion + "/" + añoActual + "/" + mesActual + "/" + diaActual).
                        set(new Gson().fromJson(
                                registros.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                            @Override
                            public void onSuccess(Void aVoid) {
                                operacionEjecutada(proviene, context, objectCarga);
                            }
                        })
                        .addOnFailureListener(new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                            }
                        });
            }else if (date.equals("igual")){
                objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).getJSONObject(diaActual).getJSONArray(nameArray).put(doc_a_subir);

                numeroDeVenta =
                        String.valueOf(objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).getJSONObject(diaActual).getJSONArray(nameArray).length() - 1);
                JSONArray array =  objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).getJSONObject(diaActual).getJSONArray(nameArray);

                registros.put(nameArray, array);

                fire.documenRef(direccion + "/" + añoActual + "/" + mesActual + "/" + diaActual).
                        update(new Gson().fromJson(
                                registros.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                            @Override
                            public void onSuccess(Void aVoid) {
                                operacionEjecutada(proviene, context, objectCarga);
                            }
                        })
                        .addOnFailureListener(new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                            }
                        });
            }else {
                if(date.equals("mes")){
                    JSONObject diaJSN = new JSONObject();
                    JSONArray array = new JSONArray();
                    array.put(doc_a_subir);
                    registros.put(nameArray,array);
                    diaJSN.put(diaActual, registros);
                    objectCarga.getJSONObject(añoActual).put(mesActual, diaJSN);

                }else {
                    JSONArray array = new JSONArray();
                    array.put(doc_a_subir);
                    registros.put(nameArray,array);
                    objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).put(diaActual, registros);
                }

                numeroDeVenta =
                        String.valueOf(objectCarga.getJSONObject(añoActual).getJSONObject(mesActual).getJSONObject(diaActual).getJSONArray(nameArray).length() - 1);

                fire.documenRef(direccion + "/" + añoActual + "/" + mesActual + "/" + diaActual).
                        set(new Gson().fromJson(
                                registros.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                            @Override
                            public void onSuccess(Void aVoid) {
                                operacionEjecutada(proviene, context, objectCarga);
                            }
                        })
                        .addOnFailureListener(new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                            }
                        });
            }
            return numeroDeVenta;
        }catch (JSONException e){
            return null;
        }

    }
    private void operacionEjecutada(String proviene, Context context, JSONObject jsonCarga){
        if(proviene.equals("jsonVenta")) {
            unavezVenta = false;
            actualizar_venta_paseDeLista.venta(context);
        } else if (proviene.equals("jsonCorteHistorial")) {
            actualizar_venta_paseDeLista.corte(context);
            try {
                jsonCorteHistorial = new JSONObject(jsonCarga.toString());
                actualizarDatosGuardados("jsonCorteHistorial", jsonCorteHistorial.toString(), context);
                notificarCambioAjustesA_PaseDeLista.actualizar("jsonCorteHistorial", context);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
