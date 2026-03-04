package propiedades_articulos;

import static com.example.nodo_1.principal.jsonArticulos;
import static generales_1.recursos_1.ocultarTeclado;
import static generales_1.recursos_1.photoBarcode;
import static propiedades_articulos.generarDescuento.siExiste;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;

import pase_de_lista.actualizarArticulo_paseDeLista;
import pop.mensaje_antes_deSalir;
import teclado.KeyboardAwareLinearLayout;

public class seña extends AppCompatActivity {

    adapter.adap_reg_seña adap_reg_seña;
    AutoCompleteTextView autoCompleteTextView;
    LottieAnimationView animation_check_1, animationVacio;
    JSONObject arrayRespaldoComparacion = new JSONObject();
    RecyclerView  recyclerView;
    Button but_ventas_this;
    PopupWindow popupWindow;
    String seña = "seña";

    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.descuento);
        generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());

        autoCompleteTextView = (AutoCompleteTextView) findViewById(R.id.autoCompleteBusqedaAgrgarCliente5);

        but_ventas_this     = (Button)findViewById(R.id.but_ver_ventas_con_propiedades);
        animation_check_1   = findViewById(R.id.animation_view);
        animation_check_1   .setVisibility(View.GONE);
        animationVacio      = findViewById(R.id.animation_vacio);
        animationVacio      .setVisibility(View.GONE);

        recyclerView = (RecyclerView) findViewById(R.id.recycler_multi_propiedades_del_articulo);
        initRecyclerC(recyclerView);
        adap_reg_seña = new adapter.adap_reg_seña(new JSONArray(), getApplicationContext());
        recyclerView.setAdapter(adap_reg_seña);

        ConstraintLayout cons1 = (ConstraintLayout)findViewById(R.id.consMayore_layout_propiedades);
        ConstraintLayout cons2 = (ConstraintLayout)findViewById(R.id.conDescuento_layout_propiedades);
        ConstraintLayout cons3 = (ConstraintLayout)findViewById(R.id.cons_3_x_n);
        cons1.setVisibility(View.GONE);cons2.setVisibility(View.GONE);cons3.setVisibility(View.VISIBLE);

        JSONArray array = new JSONArray();
        if(jsonArticulos.length() > 0){
            for (int i =0 ; i < jsonArticulos.names().length(); i ++){
                try {
                    if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has(seña)){
                        JSONObject object = new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString());
                        array.put(object);
                        arrayRespaldoComparacion.put(jsonArticulos.names().getString(i), jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        if(array.length() > 0){
            adap_reg_seña.actualizarTodo(array);
        }else {
            animationVacio.setVisibility(View.VISIBLE);
            animationVacio.playAnimation();
        }
        autoCompleteId_busqueda_funcionse();
        keyboard();
        backPressed_sliding();
        buttons();
    }
    private void clic(String id_){
        String id = siExiste(id_);
        if (!id.equals("")){
            JSONArray array = adap_reg_seña.getArray(); boolean status = false;
            for (int i = 0; i < array.length(); i++){
                try {
                    if (array.getJSONObject(i).getString("id").equals(id)){
                        adap_reg_seña.setClic(i);
                        status = true; break;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            autoCompleteTextView.setText("");autoCompleteTextView.setCursorVisible(false);
            if (!status){
                if(animationVacio.getVisibility() == View.VISIBLE){
                    animationVacio.setVisibility(View.GONE);animationVacio.pauseAnimation();
                }
                try {
                    JSONObject object = new JSONObject(jsonArticulos.getJSONObject(id).toString());
                    object.put("nuevo", "");
                    adap_reg_seña.add(object);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                ocultarTeclado(this);
            }else {
                recyclerView.scrollToPosition(0);
                adap_reg_seña.starAnimation();
                ocultarTeclado(this);
            }
        }
    }

    private void buttons(){
        ((Button)findViewById(R.id.but_guardarCambios_descuento)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                subirDatos();
            }
        });
    }
    int cont = 0;
    public void subirDatos(){
        for (int i = 0; i < adap_reg_seña.getItemCount(); i++){
            try {
                JSONObject object = adap_reg_seña.getArray().getJSONObject(i);
                boolean status = false;
                if(object.has("remove")){
                    if (!arrayRespaldoComparacion.has(object.getString("id"))){
                        status =  true;
                    }
                }
                if (!status){
                    if(object.has("nuevo") || object.has("editado") || object.has("remove")){
                        cont++;
                    }
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        if(cont > 0){
            int cambios = adap_reg_seña.getItemCount();
            for (int i = 0; i < adap_reg_seña.getItemCount(); i++){
                try {
                    JSONObject object = adap_reg_seña.getArray().getJSONObject(i);
                    if(object.has("nuevo") || object.has("editado") || object.has("remove")){
                        String id = object.getString("id");
                        boolean estado = false;
                        if (!jsonArticulos.getJSONObject(id).has(seña)){
                            if(object.has("remove")){
                                estado = true;
                                cambios--;
                            }
                        }

                        if(!estado){
                            JSONObject artProv = new JSONObject(jsonArticulos.getJSONObject(id).toString());
                            if(!object.has("remove")) {
                                artProv.put("seña", "");
                            }
                            else artProv.remove("seña");

                            fire.documenRef("articulosUno/"+ id).
                                    set(new Gson().fromJson(artProv.toString(), HashMap.class)).addOnCompleteListener(new OnCompleteListener() {
                                        @Override
                                        public void onComplete(@NonNull Task task) {
                                            try {
                                                jsonArticulos.put(id, artProv);
                                                generales.actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), getApplicationContext());
                                                cont--;
                                                actualizarArticulo_paseDeLista.actualizaArticulos(id, getApplicationContext(), cont);
                                            } catch (JSONException e) {
                                                throw new RuntimeException(e);
                                            }
                                            if (cont == 0){
                                                adap_reg_seña.reset();
                                                animation_check_1.setVisibility(View.VISIBLE);
                                                animation_check_1.playAnimation();
                                                new Handler().postDelayed(() -> {
                                                    animation_check_1.pauseAnimation(); // Detiene la animación
                                                    animation_check_1.setVisibility(View.GONE);
                                                }, 2000);
                                            }
                                        }
                                    }).addOnFailureListener(new OnFailureListener() {
                                        @Override
                                        public void onFailure(@NonNull Exception e) {
                                            generales.toast("PROBLEMA AL ACTUALIZAR", getApplicationContext());
                                        }
                                    });
                        }
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            if(cambios==0){
                generales.toast("NINGUN CAMBIO", getApplicationContext());
                adap_reg_seña.reset();
            }
        }else {
            generales.toast("NINGUN CAMBIO", getApplicationContext());
            adap_reg_seña.reset();
        }
    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Procesa el resultado del escaneo
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                generales.toast("CANCELADO", getApplicationContext());
            } else {
                // Código escaneado
                String codigoEscaneado = result.getContents();
                autoCompleteTextView.setText(codigoEscaneado);
                clic(codigoEscaneado + " " + "0");
                // Aquí puedes manejar el código escaneado, por ejemplo, almacenarlo o procesarlo
            }
        }
    }
    private void keyboard(){
        KeyboardAwareLinearLayout layout = findViewById(R.id.keyboardAwareLayout_descuento);
        TextView textView = (TextView)findViewById(R.id.textView235);
        layout.setKeyboardVisibilityListener(new KeyboardAwareLinearLayout.KeyboardVisibilityListener() {
            @Override
            public void onVisibilityChanged(boolean isVisible) {
                ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) textView.getLayoutParams();

                if (isVisible) {
                    params.verticalBias   = 100f;
                    params.horizontalBias = 100f;
                } else {
                    params.verticalBias   =  0.29f; // Valor entre 0 y 1
                    params.horizontalBias =  0.50f; // Valor entre 0 y 1
                }

                textView.setLayoutParams(params);

                float height = isVisible ? 0.1f : 55f;
                int heightInPx = (int) TypedValue.applyDimension(
                        TypedValue.COMPLEX_UNIT_DIP,
                        height,
                        getResources().getDisplayMetrics()
                );
                ViewGroup.LayoutParams params_but = but_ventas_this.getLayoutParams();
                params_but.height = heightInPx;
                but_ventas_this.setLayoutParams(params_but);
                if (isVisible)but_ventas_this.setVisibility(View.GONE);
                else but_ventas_this.setVisibility(View.VISIBLE);
            }
        });
    }
    private void backPressed_sliding(){
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if(!comprabar_si_hay_nuevos_o_editados()){
                    setEnabled(false);
                    finish();
                }else {
                    barra_semiNegra_pop();
                    View rootView = findViewById(android.R.id.content);
                    pop.mensaje_antes_deSalir mensajeAntesDeSalir = new mensaje_antes_deSalir();
                    mensajeAntesDeSalir.showPopupWindow(rootView, seña.this);
                }
            }
        });
    }
    private boolean comprabar_si_hay_nuevos_o_editados(){
        boolean status = false;
        JSONArray array = adap_reg_seña.getArray();
        for (int i = 0; i < array.length(); i++){
            try {
                if (array.getJSONObject(i).has("nuevo") || array.getJSONObject(i).has("editado") || array.getJSONObject(i).has("remove")){
                    status = true;
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        return status;
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
    public void finishclass() {
        finish();
    }
    private void barra_semiNegra_pop(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#99000000"));
    }
    private void autoCompleteId_busqueda_funcionse(){
        ArrayList<String> array_list = generales.init_getArrayList_AutocompleteCodigo();
        autoCompleteTextView.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, array_list));
        autoCompleteTextView.setSingleLine();
        autoCompleteTextView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View view, int keyCode, KeyEvent event) {

                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoCompleteTextView.length() > 0){
                        clic(autoCompleteTextView.getText().toString());
                    }
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoCompleteTextView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> adapterView, View view, int i, long l) {
                if(autoCompleteTextView.length() > 0){
                    clic(autoCompleteTextView.getText().toString());
                }
            }
        });
        autoCompleteTextView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                // Verifica si el clic fue en el drawable de la derecha
                if (event.getRawX() >= (autoCompleteTextView.getRight() - autoCompleteTextView.getCompoundDrawables()[2].getBounds().width())) {
                    photoBarcode(this);
                    return true;
                }
            }
            return false;
        });
    }
    private void initRecyclerC(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new GridLayoutManager(getApplicationContext(), 2));
    }

}
