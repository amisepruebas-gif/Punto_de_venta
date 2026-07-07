package com.example.nodo_1;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;

import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;

import com.airbnb.lottie.LottieAnimationView;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class registro_dispositivo extends AppCompatActivity {
    private LocationManager locationManager;
    LottieAnimationView animation_load_1;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.registro_dispositivo);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        animation_load_1   = findViewById(R.id.animation_load);

        Button but_guardar  = (Button) findViewById(R.id.butGuardarNameDisp_id);

        EditText nombredisp     = (EditText) findViewById(R.id.editTextText4);
        EditText nomSucursa     = (EditText) findViewById(R.id.editTextText6);
        EditText nomPerIngr     = (EditText) findViewById(R.id.editTextText7);
        but_guardar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String nomDispositivo="";
                String nomsucursal="";
                String nomPersonaIngreso="";
                if (nombredisp.length() > 0)nomDispositivo   =nombredisp.getText().toString();
                else nomDispositivo="null";
                if (nomSucursa.length() > 0)nomsucursal      =nomSucursa.getText().toString();
                else nomsucursal="null";
                if (nomPerIngr.length() > 0)nomPersonaIngreso=nomPerIngr.getText().toString();
                else nomPersonaIngreso="null";

                animation_load_1.playAnimation();
                String uuid = UUID.randomUUID().toString();

                uuid = uuid.replaceAll("-", "").substring(0, 9);
                JSONObject object = new JSONObject();
                JSONObject jsn = new JSONObject();
                try {
                    object.put("nombre_dispositivo"             , nomDispositivo);
                    object.put("nombre_Sucursal"                , nomsucursal);
                    object.put("nombre_PersonaQueIngreso"       , nomPersonaIngreso);
                    String modelomarca                                = getDeviceModelAndBrand();
                    object.put("marca dispotitivo"              , modelomarca.split("%")[0]);
                    object.put("modelo dispotitivo"             , modelomarca.split("%")[1]);
                    object.put("fechaRegistro"                  , DateFormat.getDateTimeInstance().format(new Date()));

                    jsn.put(uuid, object);

                    if(jsonDatos.length() > 0){
                        if(jsonDatos.has("dispositivos_mensaje")){
                            for (int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
                                if(jsonDatos.names().getString(i).equals(uuid)){
                                    i = 0;
                                    uuid = uuid.replaceAll("-", "").substring(0, 9);
                                }
                            }
                        }
                    }
                    object.put("id"                             , uuid);
                    object.put("nodo"                           , uuid);
                    object.put("androidId"                      , DeviceIdentifier.getAndroidId(getApplicationContext()));
                    object.put("tipoApp"                        , "nodo");
                    subir_1(jsn, uuid);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                Intent intent = new Intent(registro_dispositivo.this, principal.class);
                intent.putExtra("registroExitoso", "0");
                setResult(RESULT_OK, intent);
                setEnabled(false);
                finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
            }
        });
    }
    private void subir_1(JSONObject jsn, String finalUuid){
        fire.documenRef("datos/dispositivos_mensaje").
                set(new Gson().fromJson(
                        jsn.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void aVoid) {
                        try {
                            jsonDatos.put("dispositivos_mensaje", jsn);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        DeviceIdentifier.saveLocally(getApplicationContext(), finalUuid);
                        // La escritura en Firestore fue exitosa
                        ejecutar_2segundos();
                    }
                })
                .addOnFailureListener(new OnFailureListener() {
                    @Override
                    public void onFailure(@NonNull Exception e) {
                        toast("CARGANDO",  getApplicationContext());
                    }
                });
    }

    public static String getDeviceModelAndBrand() {
        // Obtiene el modelo del dispositivo
        String model = Build.MODEL;

        // Obtiene la marca del dispositivo
        String brand = Build.BRAND;

        // Retorna el modelo y la marca concatenados
        return brand + "%" + model;
    }

    public static void main(String[] args) {
        // Obtiene y muestra el modelo y la marca del dispositivo
        String deviceInfo = getDeviceModelAndBrand();
        System.out.println("Modelo y Marca del Dispositivo: " + deviceInfo);
    }
    private void ejecutar_2segundos(){
        final Handler handler= new Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                //handler.postDelayed(this,1000);//se ejecutara cada 10 segundose
                fin();
            }
        },1000);//empezara a ejecutarse después de 2 segundos
    }
    public JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj_ = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof Map) {
                Map<String, Object> subMap = (Map<String, Object>) value;
                obj_.put(key, mapToJSON(subMap));
            } else if (value instanceof List) {
                obj_.put(key, listToJSONArray((List) value));
            }
            else {
                obj_.put(key, value);
            }
        }
        return obj_;
    }
    private JSONArray listToJSONArray(List<Object> list) throws JSONException {
        JSONArray arr = new JSONArray();

        for(Object obj: list) {
            if (obj instanceof Map) {
                arr.put(mapToJSON((Map) obj));
            }
            else if(obj instanceof List) {
                arr.put(listToJSONArray((List) obj));
            }
            else {
                arr.put(obj);
            }
        }
        return arr;
    }
    private void fin(){
        animation_load_1.pauseAnimation();
        Intent intent = new Intent(registro_dispositivo.this, principal.class);
        intent.putExtra("registroExitoso", "1");
        setResult(RESULT_OK, intent);
        finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
    }
}
