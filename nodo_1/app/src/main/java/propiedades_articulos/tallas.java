package propiedades_articulos;


import static com.example.nodo_1.generales.initPantalla_barra_blanca_texto_negro;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.example.nodo_1.R;
import com.example.nodo_1.editar_articulos;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Objects;

import adapter.adapTallas;
import pop.confiremar_eleiminar_generico;


public class tallas extends AppCompatActivity {

    PopupWindow popupWindow;
    adapTallas adapTallas_principal;
    adapter.adap_grupos_horiziontal adap_grupos_horiziontal;
    JSONObject arrayRespaldoComparacion = new JSONObject();
    JSONObject  json_Copia_edicion      = new JSONObject();
    String tallas = "tallas";
    RecyclerView recyclerView, recyclerView_grupos;
    LottieAnimationView animation_check_1, animationVacio;
    TextView grupoName;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.tallas);
        initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());


        animation_check_1   = findViewById(R.id.animation_view);
        animation_check_1   .setVisibility(View.GONE);
        animationVacio      = findViewById(R.id.animation_vacio);
        animationVacio      .setVisibility(View.GONE);

        grupoName = (TextView)findViewById(R.id.text_view_enc_tall_prop);

        json_Copia_edicion = initJSON();


        recyclerView = (RecyclerView) findViewById(R.id.recycler_multi_propiedades_del_articulo);
        adapTallas_principal = new adapTallas(new JSONArray(), false);
        generales.recyclerVertical(recyclerView, getApplicationContext());

        recyclerView_grupos = (RecyclerView)findViewById(R.id.horizontal_recyclerView_grup_rexy_simple);
        generales.recyclerHorizontal_2(recyclerView_grupos, getApplicationContext());


        if(json_Copia_edicion.length() == 0){
            animationVacio.setVisibility(View.VISIBLE); animationVacio.playAnimation();
            adap_grupos_horiziontal =   new adapter.adap_grupos_horiziontal(new JSONArray(), this, getApplicationContext());
        }
        else {
            try {
                grupoName                   .setText(                   json_Copia_edicion.names().getString(0));
                adapTallas_principal        .actualizarRegistro(        json_Copia_edicion.getJSONArray(json_Copia_edicion.names().getString(0)));
                adap_grupos_horiziontal =   new adapter.adap_grupos_horiziontal(json_Copia_edicion.names(), this, getApplicationContext());
                index_color(json_Copia_edicion.names().getString(json_Copia_edicion.names().length()-1));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        recyclerView.setAdapter(adapTallas_principal);
        recyclerView_grupos.setAdapter(adap_grupos_horiziontal);


        backPressed_sliding();
        buttons();
    }

    private void backPressed_sliding(){
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                setEnabled(false);
                finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
            }
        });
    }
    private void buttons(){
        /**PRIMERA VEZ**/
        ((Button)findViewById(R.id.but_agregar_crearGrupo)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent askIntent = new Intent(tallas.this, agregar_tallas_etc.class);
                askIntent.putExtra("existencia",  json_Copia_edicion.toString());
                someActivityResultLauncher.launch(askIntent);
            }
        });

        /**CREAR GRUPO**/
        ((Button)findViewById(R.id.but_crear_grupo_)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent askIntent = new Intent(tallas.this, agregar_tallas_etc.class);
                someActivityResultLauncher.launch(askIntent);
            }
        });
        /**EDITAR GRUPO**/
        ((Button)findViewById(R.id.but_ver_ventas_con_propiedades)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (adapTallas_principal.getItemCount() > 0){
                    Intent askIntent = new Intent(tallas.this, agregar_tallas_etc.class);
                    try {
                        askIntent.putExtra("editar",        "");
                        askIntent.putExtra("editar_name",   grupoName.getText().toString());
                        askIntent.putExtra("editar_array",  json_Copia_edicion.getJSONArray(grupoName.getText().toString()).toString());
                        editName    = grupoName.getText().toString();
                    } catch (JSONException e) {
                        toast("error", getApplicationContext());
                        throw new RuntimeException(e);
                    }
                    someActivityResultLauncher.launch(askIntent);
                }
            }
        });

        /**GUARDAR**/
        ((Button)findViewById(R.id.but_guardarCambios_descuento)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(json_Copia_edicion.length() > 0){
                    if (arrayRespaldoComparacion.length() > 0){
                        if(arrayRespaldoComparacion.equals(json_Copia_edicion)){
                           return;
                        }
                    }
                    JSONObject object = new JSONObject();
                    try {
                        for (int i = 0; i < json_Copia_edicion.names().length(); i++){

                            JSONObject obj = new JSONObject();
                            obj.put(json_Copia_edicion.names().getString(i), json_Copia_edicion.getJSONArray(json_Copia_edicion.names().getString(i)));
                            if (i < arrayApuntador.length()){
                                object.put(arrayApuntador.getString(i), obj);
                            }else {
                                object.put(editar_articulos.generarID(), obj);
                            }
                        }

                        String id_device = generales.loadData_sharedPreferences(getApplicationContext(), "id_mensaje", "dispositivo");
                        JSONObject object_1 = new JSONObject();
                        object_1.put("huella", editar_articulos.generarID());
                        object_1.put("emisor", id_device);
                        object.put("huella", object_1);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }

                    fire.documenRef("datos/"+ "tallas").
                            set(new Gson().fromJson(object.toString(), HashMap.class)).addOnCompleteListener(new OnCompleteListener() {
                                @Override
                                public void onComplete(@NonNull Task task) {
                                    try {
                                        arrayRespaldoComparacion = new JSONObject(object.toString());
                                        jsonDatos.put("tallas", object);
                                        generales.actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), getApplicationContext());
                                        animation_check_1.setVisibility(View.VISIBLE);
                                        animation_check_1.playAnimation();
                                        new Handler().postDelayed(() -> {
                                            animation_check_1.pauseAnimation(); // Detiene la animación
                                            animation_check_1.setVisibility(View.GONE);
                                        }, 2000);
                                    } catch (JSONException e) {
                                        throw new RuntimeException(e);
                                    }
                                }
                            }).addOnFailureListener(new OnFailureListener() {
                                @Override
                                public void onFailure(@NonNull Exception e) {
                                    toast("PROBLEMA AL ACTUALIZAR", getApplicationContext());
                                }
                            });
                }
            }
        });
    }

    String editName = "";
    public void setGrupoVer(String nameGrupo){
        try {
            grupoName               .setText(nameGrupo);
            adapTallas_principal    .actualizarRegistro(json_Copia_edicion.getJSONArray(nameGrupo));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
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
                            if(data.hasExtra("agregar_tallas_etc")) {

                                recibirDatosDe_la_otra_clase(data, "agregar_tallas_etc");
                                if (animationVacio.getVisibility() == View.VISIBLE){
                                    animationVacio.setVisibility(View.GONE); animationVacio.pauseAnimation();
                                }
                            }else if (data.hasExtra("agregar_tallas_etc_edicion")){
                                if(!data.getStringExtra("agregar_tallas_etc_edicion").equals("")){
                                    recibirDatosDe_la_otra_clase(data, "agregar_tallas_etc_edicion");
                                }else {
                                    toast("DATOS IGUALES", getApplicationContext());
                                }
                            }
                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });

    private void recibirDatosDe_la_otra_clase(Intent data, String direcion_intent){
        JSONObject object = null;
        try {
            object = new JSONObject(Objects.requireNonNull(data.getStringExtra(direcion_intent)));
            String name = object.names().getString(0);
            grupoName               .setText(name);
            if(direcion_intent.equals("agregar_tallas_etc_edicion")){
                JSONObject objCopy = new JSONObject();
                for (int i = 0; i < json_Copia_edicion.names().length(); i++){
                    if(json_Copia_edicion.names().getString(i).equals(editName)){
                        objCopy.put(name, object.getJSONArray(name));
                    }else {
                        objCopy.put(json_Copia_edicion.names().getString(i), json_Copia_edicion.getJSONArray(json_Copia_edicion.names().getString(i)));
                    }
                }
                json_Copia_edicion = new JSONObject(objCopy.toString());
            }else {
                json_Copia_edicion      .put(name, object.getJSONArray(name));
            }
            adapTallas_principal    .actualizarRegistro(json_Copia_edicion.getJSONArray(name));
            adap_grupos_horiziontal .actualizarTodo(    json_Copia_edicion.names());
            if(direcion_intent.equals("agregar_tallas_etc"))index_color(name);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private void index_color(String name){
        int index  = -1;
        if (!name.equals("")){
            for (int i = 0; i < json_Copia_edicion.names().length(); i++){
                try {
                    if (name.equals(json_Copia_edicion.names().getString(i))){
                        index = i;break;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        adap_grupos_horiziontal .colorButton_index(index);
        if (!name.equals(""))recyclerView_grupos     .scrollToPosition(json_Copia_edicion.names().length()-1);
    }
    String nameEliminar = "";
    public void remove_pop(String nameGrupo){
        nameEliminar = nameGrupo;
        barra_semiNegra_pop();
        pop.confiremar_eleiminar_generico eleiminar_generico = new confiremar_eleiminar_generico();
        eleiminar_generico.showPopupWindow(getWindow().getDecorView(), this);
    }
    public void remove(){
        try {
            json_Copia_edicion.remove(nameEliminar);
            if (json_Copia_edicion.length() > 0){
                adapTallas_principal    .actualizarRegistro(json_Copia_edicion.getJSONArray(json_Copia_edicion.names().getString(0)));
                adap_grupos_horiziontal .actualizarTodo(    json_Copia_edicion.names());
                index_color(json_Copia_edicion.names().getString(0));
            }else {
                adapTallas_principal    .actualizarRegistro(new JSONArray());
                adap_grupos_horiziontal .actualizarTodo(    new JSONArray());
                index_color("");
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void getPopupWindow(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    public void initPop(){
        popupWindow.setOnDismissListener(new PopupWindow.OnDismissListener() {
            @Override
            public void onDismiss() {
                generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
            }
        });
    }
    JSONArray arrayApuntador;
    private JSONObject initJSON(){
        arrayApuntador = new JSONArray();
        JSONObject object = new JSONObject();
        if(jsonDatos.length()  > 0){
            if(jsonDatos.has(tallas)){//cons_aun_no_hay_elementos
                try {
                    for (int i = 0; i < jsonDatos.getJSONObject(tallas).names().length(); i++){
                        if(!jsonDatos.getJSONObject(tallas).names().getString(i).equals("huella")){
                            JSONObject objNameGrupo = jsonDatos.getJSONObject(tallas).getJSONObject(jsonDatos.getJSONObject(tallas).names().getString(i));
                            arrayApuntador.put(jsonDatos.getJSONObject(tallas).names().getString(i));
                            object.put(objNameGrupo.names().getString(0),
                                    objNameGrupo.getJSONArray(objNameGrupo.names().getString(0)));

                            arrayRespaldoComparacion.put(objNameGrupo.names().getString(0),
                                    objNameGrupo.getJSONArray(objNameGrupo.names().getString(0)));
                        }
                    }

                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        return object;
    }
    private void barra_semiNegra_pop(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#99000000"));
    }
}

