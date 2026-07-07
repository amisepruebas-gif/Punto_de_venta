package com.example.nodo_1;


import static com.example.nodo_1.fire.documenRef;
import com.example.nodo_1.fire;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonSiglas;


import static generales_1.recursos_1.photoBarcode;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicInteger;

import adapter.adapEditarArticulo;
import barcodeCamara.MyCaptureActivity;
import descarga_init.descarga;
import helper.SwipeHelper;

public class editar_articulos extends AppCompatActivity implements View.OnClickListener {


    adapEditarArticulo editarArticulo;
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.editar_articulo);
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

        if(jsonArticulos.length() > 0){

            Intent intent = getIntent();
            RecyclerView recyclerView = (RecyclerView) findViewById(R.id.recyclerEditarArticulos_1);
            generales.recyclerVertical(recyclerView, getApplicationContext());
            editarArticulo = new adapEditarArticulo(getApplicationContext(), this);
            recyclerView.setAdapter(editarArticulo);



            if (intent != null) {
                if(intent.hasExtra("id")){
                    try {
                        editarArticulo.add(new JSONObject(jsonArticulos.getJSONObject(intent.getStringExtra("id")).toString()));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
            llenarAutocomplete();

            editarArticulo.swip(
                    new SwipeHelper(getApplicationContext(), recyclerView) {
                        @Override
                        public void instantiateUnderlayButton(RecyclerView.ViewHolder viewHolder, List<UnderlayButton> underlayButtons) {

                            underlayButtons.add(new UnderlayButton(
                                    "DESCARTAR",
                                    1,
                                    Color.parseColor("#FF3C30"),
                                    new UnderlayButtonClickListener() {
                                        @Override
                                        public void onClick(int pos) {

                                            editarArticulo.remove(pos);

                                            if(estadoSwip_1){
                                                recoverQueue.add(swipedPos);
                                                swipedPos = -1;

                                                while (!recoverQueue.isEmpty()){
                                                    int pos_swip = recoverQueue.poll();
                                                    if (pos_swip > -1) {
                                                        recyclerView.getAdapter().notifyItemChanged(pos_swip);
                                                    }
                                                }
                                            }
                                        }
                                    }
                            ));
                        }
                    }
            );
        }else toast("NO HAY ARTICULOS REGISTRADOS", getApplicationContext());
    }

    @Override
    public void onClick(View view) {
        if(R.id.butGuardarEditarArticulos == view.getId()){
          guardarCambios();
        }
    }
    int indexPhotoBarcode = 0;
    String photoBarcode_proviene = "";
    public void photoBarcode_adapter(int index){
        photoBarcode_proviene = "adapter";
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

        if (requestCode == adapter.adapEditarArticulo.REQUEST_PICK_IMAGE_EDIT && resultCode == RESULT_OK && data != null) {
            editarArticulo.onImageResult(data.getData());
            return;
        }

        // Procesa el resultado del escaneo
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                toast("CANCELADO", getApplicationContext());
            } else {
               if( photoBarcode_proviene.equals("adapter")){
                    // Codigo escaneado
                    String codigoEscaneado = result.getContents();
                    editarArticulo.actualizarLiga_photoScanner(indexPhotoBarcode, codigoEscaneado);
                    // Aqui puedes manejar el codigo escaneado, por ejemplo, almacenarlo o procesarlo
                } else if (photoBarcode_proviene.equals("class")) {
                   String codigoEscaneado = result.getContents();
                   autoCompleteTextView.setText(codigoEscaneado);
                   clic_autocomplete(autoCompleteTextView);
               }
            }
        }
    }
    public void guardarCambios(){
        boolean estadoEnEdicion = false;
        JSONArray array = new JSONArray();
        try {
            array = new JSONArray(editarArticulo.getArray().toString());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        if(editarArticulo.getItemCount() > 0){
            for (int i = 0; i < editarArticulo.getArray().length(); i++){
                try {
                    if(editarArticulo.getArray().getJSONObject(i).has("m")){
                        estadoEnEdicion = true;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }

            if(array.length() > 0){
                if (estadoEnEdicion){
                    toast("HAY UN ARTICULO EN EDICION", getApplicationContext());
                }else {

                    int intTam = array.length(); // Asumiendo que 'intTam' representa el tamano del array

                    // Utilizar AtomicInteger para manejar el conteo de actualizaciones completadas
                    AtomicInteger remainingUpdates = new AtomicInteger(intTam);
                    contModificarArt_ac = intTam;
                    for (int i = 0; i < intTam; i++) {
                        try {
                            JSONObject articuloObj = array.getJSONObject(i);
                            String id = articuloObj.getString("id");

                            byte[] imgBytes = editarArticulo.getImageBytes(i);
                            if (imgBytes != null) {
                                String path = "media/articulos/" + id + ".webp";
                                StorageReference ref = FirebaseStorage.getInstance().getReference(path);
                                ref.putBytes(imgBytes).addOnSuccessListener(taskSnapshot ->
                                    ref.getDownloadUrl().addOnSuccessListener(uri -> {
                                        try { articuloObj.put("imagenUrl", uri.toString()); } catch (JSONException ex) {}
                                        guardarArticuloEnFirestore(articuloObj, id, remainingUpdates);
                                    })
                                ).addOnFailureListener(e -> guardarArticuloEnFirestore(articuloObj, id, remainingUpdates));
                            } else {
                                guardarArticuloEnFirestore(articuloObj, id, remainingUpdates);
                            }

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }else toast("elemtos iguales", getApplicationContext());
        }
    }

    private void guardarArticuloEnFirestore(JSONObject articuloObj, String id, AtomicInteger remainingUpdates) {
        DocumentReference docRef = fire.colRef("articulos_n").document(id);
        docRef.set(new Gson().fromJson(articuloObj.toString(), HashMap.class))
                .addOnSuccessListener(aVoid -> {
                    try {
                        jsonArticulos.put(id, articuloObj);
                        if(articuloObj.has("sigla")){
                            JSONObject object = new JSONObject();
                            object.put("id", id);
                            jsonSiglas.put(articuloObj.getString("sigla"), object);
                        }
                        generales.actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), getApplicationContext());
                        generales.actualizarDatosGuardados("jsonSiglas", jsonSiglas.toString(), getApplicationContext());
                        actualizaArticulos(id);
                        if (remainingUpdates.decrementAndGet() == 0) {
                            editarArticulo.reset();
                            llenarAutocomplete();
                        }
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                })
                .addOnFailureListener(e -> e.printStackTrace());
    }

    int intTam;
    public void selecItem_autoComplete_codigoArt(AutoCompleteTextView autoComplete_codigoArt){
        autoComplete_codigoArt.setSingleLine();
        autoComplete_codigoArt.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    clic_autocomplete(autoComplete_codigoArt);
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoComplete_codigoArt.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int i, long l) {
                clic_autocomplete(autoComplete_codigoArt);
            }
        });
    }
    private void clic_autocomplete(AutoCompleteTextView autoComplete_codigoArt){
        if(autoComplete_codigoArt.length() > 0){
            String cadena = autoComplete_codigoArt.getText().toString();
            if(cadena.contains(" ")){
                cadena = cadena.split(" ")[1];
            }
            if(jsonArticulos.has(cadena)){
                boolean estado = false;
                try {
                    if(editarArticulo.getItemCount() > 0){
                        for (int x = 0; x < editarArticulo.getItemCount(); x++){
                            if (editarArticulo.getArray().getJSONObject(x).getString("id").equals(cadena)){
                                estado = true;
                            }
                        }
                    }
                    if (!estado){
                        editarArticulo.add(new JSONObject(jsonArticulos.getJSONObject(cadena).toString()));
                        autoComplete_codigoArt.setText("");
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }else toast(cadena, getApplicationContext());
        }
    }
    private void actualizaArticulos(String id_subir) throws JSONException {
        long tiempoActual = System.currentTimeMillis();
        String huella = Long.toString(tiempoActual, 36);

        JSONArray array_id_dispositivo = new JSONArray();
        for(int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
            String idDispositivo =  jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i);
            JSONObject obj = new JSONObject();
            if(generales.loadData_sharedPreferences(getApplicationContext(), "id_mensaje", "dispositivo").equals(idDispositivo)){
                obj.put(idDispositivo, true);
            }else obj.put(idDispositivo, false);
            array_id_dispositivo.put(obj);
        }
        if (jsonDatos.has("articulos_ac")){
            jsonDatos.getJSONObject("articulos_ac").put(id_subir, array_id_dispositivo);
            jsonDatos.getJSONObject("articulos_ac").put("huella", huella);
        }else {
            JSONObject obj = new JSONObject();
            obj.put(id_subir, array_id_dispositivo);
            obj.put("huella", huella);
            jsonDatos.put("articulos_ac", obj);
        }
        descarga.unavezArt = false;
        documenRef("datos/" + "articulos_ac").
                set(new Gson().fromJson(
                        jsonDatos.getJSONObject("articulos_ac").toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {
                        descarga.unavezArt = false;
                        contModificarArt_ac--;
                        generales.actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), getApplicationContext());
                        if(contModificarArt_ac == 0){
                            descarga.unavezArt = true;
                        }
                    }
                });
    }
    int contModificarArt_ac = 0;
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
    private static final AtomicInteger contador = new AtomicInteger(0);
    private static final int MAX_CONTADOR = 9999;


    public boolean areJSONObjectsEqual(JSONObject obj1, JSONObject obj2) {
        JsonParser parser = new JsonParser();
        JsonElement jsonElement1 = parser.parse(obj1.toString());
        JsonElement jsonElement2 = parser.parse(obj2.toString());

        return jsonElement1.equals(jsonElement2);
    }
    public static String generarID() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmssSSS");
        String timestamp = sdf.format(new Date());
        int valorContador = contador.getAndIncrement();

        if (valorContador > MAX_CONTADOR) {
            contador.set(0);
            valorContador = 0;
        }

        String id = timestamp + String.format("%04d", valorContador);
        return id;
    }
    AutoCompleteTextView autoCompleteTextView;
    public void llenarAutocomplete(){
        autoCompleteTextView = (AutoCompleteTextView) findViewById(R.id.autoCompleteBusquedaId_editarArticulo);

        ArrayList<String> arrayList = new ArrayList<>();
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            String id = "";
            try {
                id = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("id");
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    id = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla") + " " + id;
                }
                arrayList.add(id);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        autoCompleteTextView.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, arrayList));
        selecItem_autoComplete_codigoArt(autoCompleteTextView);

        autoCompleteTextView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                // Verifica si el clic fue en el drawable de la derecha
                if (event.getRawX() >= (autoCompleteTextView.getRight() - autoCompleteTextView.getCompoundDrawables()[2].getBounds().width())) {
                    photoBarcode_proviene = "class";
                    photoBarcode(editar_articulos.this);
                    return true;
                }
            }
            return false;
        });
    }
    public static void actualizarSiglas(Context context){
        if (jsonArticulos.length() > 0){
            jsonSiglas = new JSONObject();
            for (int i = 0; i < jsonArticulos.names().length(); i++){
                try {
                    if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                        JSONObject object = new JSONObject();
                        object.put("id", jsonArticulos.names().getString(i));
                        jsonSiglas.put(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla"), object);
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            generales.actualizarDatosGuardados("jsonSiglas"   , jsonSiglas.toString(), context);
        }
    }
}
