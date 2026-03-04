package modulos_descarga;

import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.removeData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;

import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

public class notificacionAjustes {
    private static String ultimaHuella = "";
    public static void notificaciones(JSONObject object, Context context){

        saveData_sharedPreferences(
                context,
                context.getString(R.string.notificacion_pase_de_lista),
                context.getString(R.string.notificacion_pase_de_lista),
                object.toString());

        String huellaCap, ultimahuella_fun;
        try {
            huellaCap = object.getString("huella");
            ultimahuella_fun = ultimaHuella;
            ultimaHuella = huellaCap;
        } catch (JSONException ex) {
            throw new RuntimeException(ex);
        }
        object.remove("huella");
        JSONArray articulosCapArray = new JSONArray();
        JSONArray namesConcluidos = new JSONArray();
        for (int i = 0; i < object.names().length(); i++){
            try {
                JSONArray array = object.getJSONArray(object.names().getString(i));
                boolean estadoTrue = false;
                for (int x = 0; x < array.length(); x++){
                    String idDispositivo = loadData_sharedPreferences(context, "id_mensaje", "dispositivo");
                    if(array.getJSONObject(x).names().getString(0).equals(idDispositivo)){
                        if(!array.getJSONObject(x).getBoolean(idDispositivo)){
                            articulosCapArray.put(object.names().getString(i));
                            object.getJSONArray(object.names().getString(i)).
                                    getJSONObject(x).put(array.getJSONObject(x).names().getString(0), true);

                            if (!huellaCap.equals(ultimahuella_fun)){
                                intentet(object.names().getString(i), context);
                            }

                        }
                    }else{
                        if(!array.getJSONObject(x).getBoolean(array.getJSONObject(x).names().getString(0))){
                            estadoTrue = true;
                        }
                    }
                }
                if(!estadoTrue){
                    namesConcluidos.put(object.names().getString(i));
                }
            } catch (JSONException ex) {
                throw new RuntimeException(ex);
            }
        }
        if (articulosCapArray.length() > 0){
            if(namesConcluidos.length() == object.names().length()){
                fire.documenRef("datos/" + context.getString(R.string.notificacion_update)).delete().addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {
                        if (!loadData_sharedPreferences(context,
                                context.getString(R.string.notificacion_pase_de_lista),
                                context.getString(R.string.notificacion_pase_de_lista)).equals("")){
                            removeData_sharedPreferences(context,
                                    context.getString(R.string.notificacion_pase_de_lista),
                                    context.getString(R.string.notificacion_pase_de_lista));
                        }
                    }
                }).addOnFailureListener(new OnFailureListener() {
                    @Override
                    public void onFailure(@NonNull Exception e) {

                    }
                });
            }else {
                try {
                    if(namesConcluidos.length() > 0){
                        for (int i = 0; i < namesConcluidos.length(); i++){
                            object.remove(namesConcluidos.getString(i));
                        }
                    }
                    object.put("huella", huellaCap);
                    fire.documenRef("datos/" + context.getString(R.string.notificacion_update)).
                            set(new Gson().fromJson(
                                    object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                                @Override
                                public void onSuccess(Void unused) {
                                    saveData_sharedPreferences(
                                            context,
                                            context.getString(R.string.notificacion_pase_de_lista),
                                            context.getString(R.string.notificacion_pase_de_lista),
                                            object.toString());
                                }
                            });
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }else {

        }
    }

    private static void intentet(String s, Context context){
        try {
            String objectString = loadData_sharedPreferences(context, context.getString(R.string.notificacion_update), context.getString(R.string.notificacion_update));
            JSONObject object = new JSONObject();
            if (!objectString.equals("")){
                object = new JSONObject(objectString);
            }
            object.put(s, "");
            saveData_sharedPreferences(context,  context.getString(R.string.notificacion_update),  context.getString(R.string.notificacion_update), object.toString());

            notificacionMasMas(context);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        if(s.equals(context.getString(R.string.mostrarBotonPagoTarjeta))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mostrarBotonPagoTarjeta_notificacion");
            intent.putExtra("datos", context.getString(R.string.mostrarBotonPagoTarjeta));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.mostrarBotonTransferencia))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mostrarBotonTransferencia_notificacion");
            intent.putExtra("datos", context.getString(R.string.mostrarBotonTransferencia));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.val_2x1_mostrar))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_3x2_notificacion");
            intent.putExtra("datos", context.getString(R.string.val_2x1_mostrar));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.dar_ticket))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_dar_ticket_notificacion");
            intent.putExtra("datos",  context.getString(R.string.dar_ticket));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.cobrar_comision))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_cobrar_comision_notificacion");
            intent.putExtra("datos", context.getString(R.string.cobrar_comision));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.statusFacial))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_facial_notificacion");
            intent.putExtra("datos", context.getString(R.string.statusFacial));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.limitarVenta_a_existencia))){

            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_limitarVenta_a_existencia_notificacion");
            intent.putExtra("datos", context.getString(R.string.limitarVenta_a_existencia));  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.mostrarBotonTransferencia))){

        }else if (s.equals("jsonCorteHistorial")){
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_jsonCorteHistorial_notificacion");
            intent.putExtra("datos", "jsonCorteHistorial");  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);
        }

    }
    private static void reproducirSonidoMediaPlayer(Context context) {
      /*
        MediaPlayer mediaPlayer = MediaPlayer.create(context, R.raw.notificacion_2);
        mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                mp.release(); // Liberar recursos una vez que termine la reproducción
            }
        });
        mediaPlayer.start();
       */
    }
    private static void notificacionMasMas(Context context){
  /*
        String cant_share = loadData_sharedPreferences(context, context.getString(R.string.index_notificacion),context.getString(R.string.index_notificacion));

        if(cant_share.equals(""))cant_share = "1";
        else cant_share = String.valueOf(Integer.parseInt(cant_share) + 1);
        saveData_sharedPreferences(context,context.getString(R.string.index_notificacion), context.getString(R.string.index_notificacion), cant_share);
        reproducirSonidoMediaPlayer(context);
   */
    }
    private void toast(String s, Context context){
        generales.toast(s, context);
    }
}