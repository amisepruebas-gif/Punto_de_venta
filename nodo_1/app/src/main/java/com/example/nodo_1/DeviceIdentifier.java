package com.example.nodo_1;

import android.content.Context;
import android.provider.Settings;

import com.google.firebase.firestore.SetOptions;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;

/**
 * Identificador universal de dispositivo.
 *
 * Usa Settings.Secure.ANDROID_ID como huella fisica del dispositivo.
 * Este valor sobrevive reinstalaciones (se mantiene con la misma firma de app).
 *
 * Flujo:
 * 1. Si ya hay ID en SharedPreferences -> lo devuelve (rapido, sin red)
 * 2. Si no, consulta Firestore buscando un dispositivo con el mismo androidId
 * 3. Si lo encuentra -> recupera el ID existente (reinstalacion)
 * 4. Si no lo encuentra -> es un dispositivo nuevo, necesita registro
 */
public class DeviceIdentifier {

    private static final String PREFS_NAME = "dispositivo";
    private static final String KEY_DEVICE_ID = "id_mensaje";
    private static final String KEY_ANDROID_ID = "android_id";

    public interface OnDeviceIdReady {
        void onReady(String deviceId);
        void onNeedsRegistration(String androidId);
        void onError(String error);
    }

    /**
     * Obtiene el ANDROID_ID del dispositivo fisico.
     * Sobrevive reinstalaciones con la misma firma de app.
     */
    public static String getAndroidId(Context context) {
        return Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
    }

    /**
     * Obtiene el ID del dispositivo. Si no existe localmente, intenta recuperarlo de Firestore.
     */
    public static void getOrRecover(Context context, OnDeviceIdReady callback) {
        // Paso 1: Verificar SharedPreferences
        String localId = generales.loadData_sharedPreferences(context, KEY_DEVICE_ID, PREFS_NAME);
        if (!localId.isEmpty()) {
            callback.onReady(localId);
            return;
        }

        // Paso 2: Buscar en Firestore por androidId
        String androidId = getAndroidId(context);
        recoverFromFirestore(context, androidId, callback);
    }

    /**
     * Busca en datos/dispositivos_mensaje un dispositivo con el mismo androidId.
     */
    private static void recoverFromFirestore(Context context, String androidId, OnDeviceIdReady callback) {
        fire.documenRef("datos/dispositivos_mensaje").get()
                .addOnSuccessListener(documentSnapshot -> {
                    if (documentSnapshot.exists() && documentSnapshot.getData() != null) {
                        Map<String, Object> data = documentSnapshot.getData();
                        for (Map.Entry<String, Object> entry : data.entrySet()) {
                            if (entry.getValue() instanceof Map) {
                                Map<String, Object> device = (Map<String, Object>) entry.getValue();
                                Object storedAndroidId = device.get("androidId");
                                if (storedAndroidId != null && storedAndroidId.toString().equals(androidId)) {
                                    // Encontrado - recuperar el ID
                                    String recoveredId = entry.getKey();
                                    generales.saveData_sharedPreferences(context, PREFS_NAME, KEY_DEVICE_ID, recoveredId);
                                    generales.saveData_sharedPreferences(context, PREFS_NAME, KEY_ANDROID_ID, androidId);
                                    callback.onReady(recoveredId);
                                    return;
                                }
                            }
                        }
                    }
                    // No encontrado - necesita registro nuevo
                    callback.onNeedsRegistration(androidId);
                })
                .addOnFailureListener(e -> callback.onError(e.getMessage()));
    }

    /**
     * Genera un nuevo ID de 9 caracteres y lo guarda con el androidId.
     */
    public static String generateNewId() {
        return UUID.randomUUID().toString().replaceAll("-", "").substring(0, 9);
    }

    /**
     * Guarda el ID y androidId en SharedPreferences.
     */
    public static void saveLocally(Context context, String deviceId) {
        String androidId = getAndroidId(context);
        generales.saveData_sharedPreferences(context, PREFS_NAME, KEY_DEVICE_ID, deviceId);
        generales.saveData_sharedPreferences(context, PREFS_NAME, KEY_ANDROID_ID, androidId);
    }

    /**
     * Lee el ID del dispositivo desde SharedPreferences (sincrono, sin red).
     */
    public static String getLocalId(Context context) {
        return generales.loadData_sharedPreferences(context, KEY_DEVICE_ID, PREFS_NAME);
    }
}
