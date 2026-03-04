package notificaciones;


import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.removeData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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
    private static boolean bol_borrar = false;
    public void notificaciones(JSONObject object, Context context){

        saveData_sharedPreferences(
                context,
                context.getString(R.string.notificacion_pase_de_lista),
                context.getString(R.string.notificacion_pase_de_lista),
                object.toString());
        
        String huellaCap;
        try {
            huellaCap = object.getString("huella");
        } catch (JSONException ex) {
            throw new RuntimeException(ex);
        }
        //String ultimaHuellaShare = loadData_sharedPreferences(context, context.getString(R.string.ultima_huella_notificacion), context.getString(R.string.ultima_huella_notificacion));
        
        if (!ultimaHuella.equals(huellaCap)){
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

                                notificacionMasMas(context);
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
                                                context.getString(R.string.ultima_huella_notificacion),
                                                context.getString(R.string.ultima_huella_notificacion),
                                                huellaCap);
                                        ultimaHuella = huellaCap;
                                    }
                                });
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }else {

            }
        }
        intent_nodo(context, object);
    }
    private static void intent_nodo(Context context, JSONObject object){
        Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_nodo_notificacion");
        intent.putExtra("nodo", object.toString());  // 'data' es el dato actualizado de Firestore
        LocalBroadcastManager.getInstance(context).sendBroadcast(intent);
    }

    private static void reproducirSonidoMediaPlayer(Context context) {
        MediaPlayer mediaPlayer = MediaPlayer.create(context, R.raw.notificacion_2);
        mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                mp.release(); // Liberar recursos una vez que termine la reproducción
            }
        });
        mediaPlayer.start();
    }
    private void notificacionMasMas(Context context){
        String cant_share = loadData_sharedPreferences(context, context.getString(R.string.index_notificacion),context.getString(R.string.index_notificacion));

        if(cant_share.equals(""))cant_share = "1";
        else cant_share = String.valueOf(Integer.parseInt(cant_share) + 1);
        saveData_sharedPreferences(context,context.getString(R.string.index_notificacion), context.getString(R.string.index_notificacion), cant_share);

        //notificacion_general
        reproducirSonidoMediaPlayer(context);
        notificacion_general(context);
    }
    private final String CHANNEL_ID = "mi_canal_notificacion";

    public void notificacion_general(Context context){

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // Usa un icono válido
                .setContentTitle("titulo").
                setSmallIcon(R.drawable.amisetpeq)
                .setContentText("texto")
                .setPriority(NotificationCompat.PRIORITY_HIGH) // Establece prioridad alta
                .setCategory(NotificationCompat.CATEGORY_MESSAGE) // Opcional: categoriza la notificación
                .setAutoCancel(true);  // La notificación se elimina al tocarla

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

        // Mostrar la notificación solo si el permiso está concedido
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                // Permiso no concedido, no mostrar la notificación
                Log.d("MainActivity", "Permiso POST_NOTIFICATIONS no concedido.");
                return;
            }
        }
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
        Log.d("MainActivity", "Notificación mostrada con ID: " + notificationId);
    }
}

