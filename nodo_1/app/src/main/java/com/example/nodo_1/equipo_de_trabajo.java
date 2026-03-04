package com.example.nodo_1;

import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.generateUniqueID;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.ImageView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.List;

import adapter.adap_equipo_de_trabajo;
import helper.SwipeHelper;

public class equipo_de_trabajo extends AppCompatActivity implements View.OnClickListener {

    RecyclerView recyclerView;
    adapter.adap_equipo_de_trabajo adapEquipoDeTrabajo;
    EditText editTextNombreIngresado;
    public SlidingUpPanelLayout sliding;
    LottieAnimationView animation_check;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.equipode_trabajo);

        sliding = (SlidingUpPanelLayout) findViewById(R.id.panelState_EquipoTrabajo);

        animation_check = findViewById(R.id.animation_view);
        animation_check.setVisibility(View.GONE);

        ImageView imageViewAunNoHayElementos = (ImageView)findViewById(R.id.imageViewaUnNoHayElementos);
        initPantalla();

        recyclerView = (RecyclerView) findViewById(R.id.recyclerEquipoDeTrabajo_1);
        generales.recyclerVertical(recyclerView, getApplicationContext());
        adapEquipoDeTrabajo = new adap_equipo_de_trabajo(this, imageViewAunNoHayElementos, getApplicationContext(), sliding);
        recyclerView.setAdapter(adapEquipoDeTrabajo);
        editTextNombreIngresado = (EditText) findViewById(R.id.editTextTextNom_ingresado_eqp_trabajo);

        adapEquipoDeTrabajo.swip(
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

                                        adapEquipoDeTrabajo.remove(pos);

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
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (sliding.getPanelState() == SlidingUpPanelLayout.PanelState.EXPANDED) {
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                } else {
                    // Desactivar este callback para que el evento de retroceso sea manejado por el sistema
                    setEnabled(false);
                    // Invocar el evento de retroceso predeterminado
                    finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
                }
            }
        });
    }

    @Override
    public void onClick(View view) {
        if(R.id.butagregarIntegrante_eqp_trabajo == view.getId()){
            if(editTextNombreIngresado.length() > 0){
                JSONObject object = new JSONObject();
                try {
                    object.put("nombre",editTextNombreIngresado.getText().toString());
                    String idUsuario;
                    JSONArray array = new JSONArray();
                    if(jsonDatos.length() > 0){
                        if(jsonDatos.has(getString(R.string.equipoDeTrabajo))) {
                            for (int i = 0; i < jsonDatos.getJSONObject(getString(R.string.equipoDeTrabajo)).names().length(); i++){
                                array.put(jsonDatos.getJSONObject(getString(R.string.equipoDeTrabajo)).names().getString(i));
                            }
                        }
                    }
                    idUsuario =  generateUniqueID(array);
                    object.put("idUsuario", idUsuario);
                    object.put("nuevo", "");
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                adapEquipoDeTrabajo.add(object);
            }
        } else if (R.id.butGuarda_equipoDetrabajo == view.getId()) {
            if(adapEquipoDeTrabajo.getItemCount() > 0){

                JSONArray array = adapEquipoDeTrabajo.getArray();
                JSONObject object_usuarios   = new JSONObject();

                for (int x = 0; x < array.length(); x++){
                    try {
                        if(array.getJSONObject(x).has("nuevo")){
                            array.getJSONObject(x).remove("nuevo");
                        }
                        object_usuarios.put(array.getJSONObject(x).getString("idUsuario"), array.getJSONObject(x));

                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
                try {
                    String id_device = generales.loadData_sharedPreferences(getApplicationContext(), "id_mensaje", "dispositivo");
                    JSONObject object = new JSONObject();
                    object.put("huella", editar_articulos.generarID());
                    object.put("emisor", id_device);
                    object_usuarios.put("huella", object);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                documenRef("datos/" + getString(R.string.equipoDeTrabajo)).
                        set(new Gson().fromJson(
                                object_usuarios.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                            @Override
                            public void onSuccess(Void unused) {

                                try {
                                    jsonDatos.put(getString(R.string.equipoDeTrabajo), object_usuarios);
                                    actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), getApplicationContext());
                                    adapEquipoDeTrabajo.init(true);
                                    animation_check.setVisibility(View.VISIBLE);
                                    animation_check.playAnimation();
                                    new Handler().postDelayed(() -> {
                                        animation_check.pauseAnimation(); // Detiene la animación
                                        animation_check.setVisibility(View.GONE);
                                    }, 3000);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }
                        });

            }
        } else {
            String id = getResources().getResourceEntryName(view.getId());
            adapUnoSelecImagen(id);
        }
    }
    int indexSeleccionImagen = 0;
    public void getIndexSeleccionImagen(int index){indexSeleccionImagen = index;}
    public void adapUnoSelecImagen(String name){
        try {
            adapEquipoDeTrabajo.getDrawableString(indexSeleccionImagen, name);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void editarVerDatos(int index, String idUsuario, JSONObject object){
        Intent askIntent = new Intent(this, datos_equipo_de_trabajo.class);
        askIntent.putExtra("index", index);
        askIntent.putExtra("idUsuario", idUsuario);
        askIntent.putExtra("jsn", object.toString());
        someActivityResultLauncher.launch(askIntent);
    }

    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        // There are no request codes
                        Intent data = result.getData();

                        if(data != null){
                            if(data.hasExtra("jsn")){
                                try {
                                    adapEquipoDeTrabajo.actualizarDatosSinNotificiarAlAdaptador(data.getIntExtra(
                                            "index", 0), new JSONObject(data.getStringExtra("jsn")));
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }
                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });
    private BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if(intent.hasExtra("data")){
                if (adapEquipoDeTrabajo.getItemCount()>0){
                    adapEquipoDeTrabajo.init(true);
                }
            }
        }
    };
    @Override
    protected void onStart() {
        super.onStart();
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_equipoDeTrabajo");
        LocalBroadcastManager.getInstance(this).registerReceiver(updateReceiver, intentFilter);
    }

    @Override
    protected void onStop() {
        super.onStop();
        LocalBroadcastManager.getInstance(this).unregisterReceiver(updateReceiver);
    }
    private void initPantalla(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(getResources().getColor(R.color.blanco)); // Asegúrate de que el color esté definido en tus recursos.

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                insetsController.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }
}
