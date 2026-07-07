package com.example.nodo_1;



import static com.example.nodo_1.editar_articulos.actualizarSiglas;
import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.gms.tasks.OnSuccessListener;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;
import com.google.gson.Gson;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicInteger;

import adapter.adapIngresoMercancia;
import barcodeCamara.MyCaptureActivity;
import pase_de_lista.actualizarArticulo_paseDeLista;

public class ingresoMercancia extends AppCompatActivity  implements View.OnClickListener {


    adapter.adapIngresoMercancia adapIngresoMercancia;
    RecyclerView recycler;
    @NonNull
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.ingreso_mercancia);
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(getResources().getColor(R.color.blanco)); // Asegurate de que el color este definido en tus recursos.

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                insetsController.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }


        recycler = (RecyclerView)findViewById(R.id.recyclerIngresoMercanciaReg_1);
        generales.recyclerVertical(recycler, getApplicationContext());
        adapIngresoMercancia = new adapIngresoMercancia(getApplicationContext(), this);
        recycler.setAdapter(adapIngresoMercancia);

    }


    int cantTotalRegIng = 0;
    @Override
    public void onClick(View view) {
        if(R.id.button27_agregarigm == view.getId()){
            try {
                JSONArray array = adapIngresoMercancia.registroCompleto();
                if(array.getJSONObject(array.length()-1).has("completo")){
                    adapIngresoMercancia.agregar();
                    recycler.scrollToPosition(adapIngresoMercancia.getItemCount()-1);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        } else if (R.id.butFinalizarAgregarMErcancia == view.getId()) {
            if(adapIngresoMercancia.getItemCount() > 0){
                JSONArray array = null;
                try {
                    array = new JSONArray(adapIngresoMercancia.registroCompleto().toString());
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                try {
                    if (!array.getJSONObject(array.length()-1).has("completo")){
                        int intBorrar = array.length()-1;
                        array.remove(intBorrar);
                        if (array.length()==0)return;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                cantTotalRegIng = array.length();
                for (int i = 0; i < array.length(); i++){
                    try {
                        JSONObject obj = array.getJSONObject(i);
                        String id = obj.getString("id");
                        obj.put("fecha", getTiempo());
                        obj.remove("completo");

                        byte[] imgBytes = adapIngresoMercancia.getImageBytes(i);
                        if (imgBytes != null) {
                            String path = "media/articulos/" + id + ".webp";
                            StorageReference ref = FirebaseStorage.getInstance().getReference(path);
                            ref.putBytes(imgBytes).addOnSuccessListener(taskSnapshot ->
                                ref.getDownloadUrl().addOnSuccessListener(uri -> {
                                    try { obj.put("imagenUrl", uri.toString()); } catch (JSONException ex) {}
                                    subirArticulo(obj, id);
                                })
                            ).addOnFailureListener(e -> subirArticulo(obj, id));
                        } else {
                            subirArticulo(obj, id);
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
                banderaAtualizarAutocompleteID = true;
            }
        }
    }

    int indexPhotoBarcode = 0;
    public void photoBarcode(int index){
        indexPhotoBarcode = index;
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES);
        integrator.setPrompt("Escanea un codigo de barras");
        integrator.setCameraId(0);  // Usa la camara trasera
        integrator.setBeepEnabled(true);
        integrator.setCaptureActivity(MyCaptureActivity.class); // Usa tu actividad personalizada
        integrator.setOrientationLocked(true); // Bloquea la orientacion
        integrator.initiateScan();

    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == adapter.adapIngresoMercancia.REQUEST_PICK_IMAGE_ARTICULO && resultCode == RESULT_OK && data != null) {
            adapIngresoMercancia.onImageResult(data.getData());
            return;
        }

        // Procesa el resultado del escaneo
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                toast("CANCELADO");
            } else {
                // Codigo escaneado
                String codigoEscaneado = result.getContents();
                adapIngresoMercancia.actualizarLiga_photoScanner(indexPhotoBarcode, codigoEscaneado);
            }
        }
    }
    private void subirArticulo(JSONObject obj, String id) {
        documenRef("articulos_n/" + id).
                set(new Gson().fromJson(obj.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener() {
                    @Override
                    public void onSuccess(Object o) {
                        cantTotalRegIng--;
                        try {
                            jsonArticulos.put(id, obj);
                            generales.actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), getApplicationContext());

                            actualizarArticulo_paseDeLista.actualizaArticulos(id, getApplicationContext(), cantTotalRegIng);
                            if(cantTotalRegIng==0){
                                actualizarSiglas(getApplicationContext());
                                adapIngresoMercancia.reset();
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                });
    }

    boolean banderaAtualizarAutocompleteID = false;

    private void toast (String s){
        generales.toast(s, getApplicationContext());
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
}
