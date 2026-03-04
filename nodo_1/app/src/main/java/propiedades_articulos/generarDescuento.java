package propiedades_articulos;

import static com.example.nodo_1.generales.init_getArrayList_AutocompleteCodigo;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;

import static generales_1.recursos_1.ocultarTeclado;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
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
import androidx.annotation.Nullable;
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
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.Gson;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;

import adapter.adapterVErEditarDescuentos;
import pase_de_lista.actualizarArticulo_paseDeLista;
import pop.mensaje_antes_deSalir;
import pop.popBotonConfirmarDescuento;
import teclado.KeyboardAwareLinearLayout;

public class generarDescuento extends AppCompatActivity {

    RecyclerView recyclerViewVerEditar;
    adapter.adapterVErEditarDescuentos adapterVErEditarDescuentos;
    AutoCompleteTextView autoCompleteTextView;
    SlidingUpPanelLayout sliding;
    String id_sliding = "", precioDesc = "";
    static int indexModificar = -1;
    PopupWindow popupWindow;
    LottieAnimationView animation_check_1, animationVacio;
    TextView textView_precio_normal;
    TextInputEditText inputEditText_precio_con_desc;
    JSONObject arrayRespaldoComparacion = new JSONObject();
    Button but_ventas_this;
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.descuento);
        generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
        textView_precio_normal        = (TextView)findViewById(R.id.textView217);
        inputEditText_precio_con_desc = (TextInputEditText) findViewById(R.id.inputEditText_precioConDesc);

        animation_check_1 = findViewById(R.id.animation_view);
        animation_check_1.setVisibility(View.GONE);
        animationVacio = findViewById(R.id.animation_vacio);

        boolean existe = false;
        if(jsonArticulos.length() > 0){
            for (int x = 0; x < jsonArticulos.names().length(); x++){
                try {
                    if (jsonArticulos.getJSONObject(jsonArticulos.names().getString(x)).has("descuento")){
                        existe = true;
                        arrayRespaldoComparacion.put(jsonArticulos.names().getString(x),jsonArticulos.getJSONObject(jsonArticulos.names().getString(x)));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        but_ventas_this                 = (Button)findViewById(R.id.but_ver_ventas_con_propiedades);
        ConstraintLayout constrainThis  = (ConstraintLayout)findViewById(R.id.conDescuento_layout_propiedades);
        constrainThis                   .setVisibility(View.VISIBLE);
        ConstraintLayout cons1          = (ConstraintLayout)findViewById(R.id.cons_3_x_n);
        cons1                           .setVisibility(View.GONE);
        ConstraintLayout cons2          = (ConstraintLayout)findViewById(R.id.consMayore_layout_propiedades);
        cons2                           .setVisibility(View.GONE);
        animationVacio                  .setVisibility(View.GONE);

        sliding = (SlidingUpPanelLayout) findViewById(R.id.slidin_articulos_propiedades_1);
        autoCompleteTextView = (AutoCompleteTextView)findViewById(R.id.autoCompleteBusqedaAgrgarCliente5);


        adapterVErEditarDescuentos = new adapterVErEditarDescuentos(getApplicationContext(), this);
        recyclerViewVerEditar = (RecyclerView) findViewById(R.id.recycler_multi_propiedades_del_articulo);
        initRecyclerC(recyclerViewVerEditar);
        recyclerViewVerEditar.setAdapter(adapterVErEditarDescuentos);


        autoCompleteId_busqueda_funcionse();
        keyboard();
        backPressed_sliding();
        slidingStatus();
        buttons();
        if (!existe){
            animationVacio.setVisibility(View.VISIBLE);
            animationVacio.playAnimation();
            toast("NO HAY ARTICULOS REGISTRADOS", getApplicationContext());
        }
    }

    private void onPanelCollapsed() {
        if (!precioDesc.equals("")){
            JSONObject object = null;
            try {
                boolean statusIgual = false;
                if(indexModificar < 0){
                    object = new JSONObject(jsonArticulos.getJSONObject(id_sliding).toString());
                    object.put("nuevo"    , "");
                }else {
                    object = new JSONObject(adapterVErEditarDescuentos.getJsonArray().getJSONObject(indexModificar).toString());
                    object.put("editado", "");
                    if(object.getString("descuento").equals(precioDesc)){
                        statusIgual = true;
                    }
                    String id = adapterVErEditarDescuentos.getJsonArray().getJSONObject(indexModificar).getString("id");
                    if(arrayRespaldoComparacion.has(id)){
                        if (arrayRespaldoComparacion.getJSONObject(id).has("descuento")){
                            if(arrayRespaldoComparacion.getJSONObject(id).getString("descuento").equals(precioDesc)){
                                object.remove("editado");
                            }
                        }
                    }
                    if (object.has("nuevo") && object.has("editado")){
                        object.remove("nuevo");
                    }
                }
                if (!statusIgual){
                    object.put("descuento", precioDesc);
                    if (indexModificar < 0) {
                        adapterVErEditarDescuentos.add(object);
                        if(animationVacio.getVisibility() == View.VISIBLE){
                            animationVacio.setVisibility(View.GONE);animationVacio.pauseAnimation();
                        }
                    } else {
                        adapterVErEditarDescuentos.actualzarEdicionArt(indexModificar, object);
                    }
                }else {
                    toast("LOS CAMPOS SON IGUALES", getApplicationContext());
                }
                ocultarTeclado(this);
                indexModificar = -1;
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            ocultarTeclado(this);
        }
    }

    public void buttons(){
        ((Button)findViewById(R.id.butagregar_propiedades)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                /**AGREGAR REGISTRO**/
                if (inputEditText_precio_con_desc.length() > 0){
                    precioDesc = inputEditText_precio_con_desc.getText().toString();
                    status_slidind = true;
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                }else {
                    toast("FALTAN DATOS", getApplicationContext());
                }
            }
        });
        ((Button)findViewById(R.id.but_guardarCambios_descuento)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(!comprabar_si_hay_nuevos_o_editados()){
                    toast("AUN NO HAY EDICIONES", getApplicationContext());
                }else {
                    barra_semiNegra_pop();
                    popBotonConfirmarDescuento popBotonConfirmarDescuento = new popBotonConfirmarDescuento();
                    popBotonConfirmarDescuento.showPopupWindow(view, generarDescuento.this);
                }
            }
        });
    }
    public void getPopupWindow_confirmar(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    public void initPop_confirmar(){
        popupWindow.setOnDismissListener(new PopupWindow.OnDismissListener() {
            @Override
            public void onDismiss() {
                generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
            }
        });
    }

    int cont = 0;
    public void subirDatos(){
        for (int i = 0; i < adapterVErEditarDescuentos.getItemCount(); i++){
            try {
                JSONObject object = adapterVErEditarDescuentos.getJsonArray().getJSONObject(i);
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
            int cambios = adapterVErEditarDescuentos.getItemCount();
            for (int i = 0; i < adapterVErEditarDescuentos.getItemCount(); i++){
                try {
                    JSONObject object = adapterVErEditarDescuentos.getJsonArray().getJSONObject(i);
                    if(object.has("nuevo") || object.has("editado") || object.has("remove")){
                        String id = object.getString("id");
                        boolean estado = false;
                        if (!jsonArticulos.getJSONObject(id).has("descuento")){
                            if(object.has("remove")){
                                estado = true;
                                cambios--;
                            }
                        }
                        if(!estado){
                            JSONObject artProv = new JSONObject(jsonArticulos.getJSONObject(id).toString());
                            if(!object.has("remove")) artProv.put("descuento", object.getString("descuento"));
                            else artProv.remove("descuento");

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
                                                adapterVErEditarDescuentos.reset();
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
                                            toast("PROBLEMA AL ACTUALIZAR", getApplicationContext());
                                        }
                                    });
                        }
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            if(cambios==0){
                toast("NINGUN CAMBIO", getApplicationContext());
                adapterVErEditarDescuentos.reset();
            }
        }else {
            toast("NINGUN CAMBIO", getApplicationContext());
            adapterVErEditarDescuentos.reset();
        }
    }

    public void editarArticulo(int index, JSONObject object){
        indexModificar = index;
        sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        try {
            textView_precio_normal          .setText(object.getString("precioVenta"));
            inputEditText_precio_con_desc   .setText(object.getString("descuento"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    static boolean status_slidind = false;

    public static String siExiste(String id_){
        String id;
        if (id_.contains(" ")){
            id = id_.split(" ")[0];
        } else {
            id = id_;
        }
        if (!jsonArticulos.has(id)){
            id = "";
        }
        return id;
    }
    private void clic(String id_){
        String id = siExiste(id_);
       if(!id.equals("")){
           boolean status = false;

           JSONArray array = adapterVErEditarDescuentos.getJsonArray();
           for (int i = 0; i < array.length(); i++){
               try {
                   if (array.getJSONObject(i).getString("id").equals(id)){
                       adapterVErEditarDescuentos.setClic(i); status = true; break;
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
                   textView_precio_normal.setText(jsonArticulos.getJSONObject(id).getString("precioVenta"));
                   inputEditText_precio_con_desc.setText("");
               } catch (JSONException e) {
                   throw new RuntimeException(e);
               }
               indexModificar      = -1;
               id_sliding          = id;
               sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
               ocultarTeclado(this);
           }else {
               recyclerViewVerEditar.scrollToPosition(0);
               adapterVErEditarDescuentos.starAnimation();
               ocultarTeclado(this);
           }
       }else toast("ARTICULO NO ENCONTRADO", getApplicationContext());
    }

    private void autoCompleteId_busqueda_funcionse(){
        ArrayList<String> array_list = init_getArrayList_AutocompleteCodigo();

        autoCompleteTextView.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, array_list));
        autoCompleteTextView.setSingleLine();
        autoCompleteTextView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View view, int keyCode, KeyEvent event) {

                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoCompleteTextView.length() > 0)clic(autoCompleteTextView.getText().toString());
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoCompleteTextView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> adapterView, View view, int i, long l) {
                if(autoCompleteTextView.length() > 0)clic(autoCompleteTextView.getText().toString());
            }
        });
        autoCompleteTextView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                Drawable rightDrawable = autoCompleteTextView.getCompoundDrawables()[2];
                if (rightDrawable != null && event.getRawX() >= (autoCompleteTextView.getRight() - rightDrawable.getBounds().width())) {
                    generales_1.recursos_1.photoBarcode(generarDescuento.this);
                    return true;
                }
            }
            return false;
        });
    }
    @Override
    protected void onResume(){
        super.onResume();
    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                toast("CANCELADO", getApplicationContext());
            } else {
                // Código escaneado
                String codigoEscaneado = result.getContents();
                autoCompleteTextView.setText(codigoEscaneado);
                clic(codigoEscaneado + " 1");
            }
        }
    }
    private void backPressed_sliding(){
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (sliding.getPanelState() == SlidingUpPanelLayout.PanelState.EXPANDED) {
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                }else {
                    if(!comprabar_si_hay_nuevos_o_editados()){
                        setEnabled(false);
                        finish();
                    }else {
                        barra_semiNegra_pop();
                        View rootView = findViewById(android.R.id.content);
                        pop.mensaje_antes_deSalir mensajeAntesDeSalir = new mensaje_antes_deSalir();
                        mensajeAntesDeSalir.showPopupWindow(rootView, generarDescuento.this);
                    }
                }
            }
        });
    }

    private boolean comprabar_si_hay_nuevos_o_editados(){
        boolean status = false;
        JSONArray array = adapterVErEditarDescuentos.getJsonArray();
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
    private void slidingStatus(){
        sliding.addPanelSlideListener(new SlidingUpPanelLayout.PanelSlideListener() {
            @Override
            public void onPanelSlide(View panel, float slideOffset) {
                // Este método se llama continuamente mientras el panel se desliza.
                // Puedes usarlo para animaciones o actualizaciones en tiempo real.
            }
            @Override
            public void onPanelStateChanged(View panel,
                                            SlidingUpPanelLayout.PanelState previousState,
                                            SlidingUpPanelLayout.PanelState newState) {
                if (newState == SlidingUpPanelLayout.PanelState.COLLAPSED) {
                    // El panel se ha colapsado completamente.
                    if (status_slidind){
                        status_slidind = false;
                        onPanelCollapsed();
                    }
                } else if (newState == SlidingUpPanelLayout.PanelState.EXPANDED) {

                }
            }
        });
    }
    private void barra_semiNegra_pop(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#99000000"));
    }
    private void initRecyclerC(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new GridLayoutManager(getApplicationContext(), 2));
    }
}
