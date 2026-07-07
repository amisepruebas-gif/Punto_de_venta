package push;

import android.content.Context;
import android.util.Log;

import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.HashMap;
import java.util.Map;

public class FcmTokenManager {

    private static final String TAG = "FcmTokenManager";

    public static void inicializar(Context context) {
        suscribirATopic();
        obtenerYGuardarToken(context);
    }

    private static void suscribirATopic() {
        String negocioId = fire.getNegocioId();
        if (negocioId == null || negocioId.isEmpty()) return;

        String topic = "negocio_" + negocioId;
        FirebaseMessaging.getInstance().subscribeToTopic(topic)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Suscrito al topic: " + topic);
                    } else {
                        Log.e(TAG, "Error suscribiendo al topic: " + topic, task.getException());
                    }
                });
    }

    private static void obtenerYGuardarToken(Context context) {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.e(TAG, "Error obteniendo token FCM", task.getException());
                        return;
                    }
                    String token = task.getResult();
                    Log.d(TAG, "Token FCM: " + token);
                    guardarTokenEnFirestore(context, token);
                });
    }

    public static void guardarTokenEnFirestore(Context context, String token) {
        String deviceId = generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo");
        if (deviceId.isEmpty()) return;

        Map<String, Object> data = new HashMap<>();
        data.put("fcmToken", token);
        data.put("tipoApp", "nodo");
        data.put("ultimaActualizacion", System.currentTimeMillis());

        fire.documenRef("dispositivos/" + deviceId)
                .update(data)
                .addOnSuccessListener(v -> Log.d(TAG, "Token FCM guardado para: " + deviceId))
                .addOnFailureListener(e -> {
                    fire.documenRef("dispositivos/" + deviceId)
                            .set(data)
                            .addOnFailureListener(e2 -> Log.e(TAG, "Error guardando token", e2));
                });
    }
}
