package propiedades_articulos;

import static com.example.nodo_1.generales.init_getArrayList_AutocompleteCodigo;
import static com.example.nodo_1.generales.toast;
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

import adapter.adap_mayoreo;
import pase_de_lista.actualizarArticulo_paseDeLista;
import pop.mensaje_antes_deSalir;
import pop.popBotonConfirmarDescuento;
import teclado.KeyboardAwareLinearLayout;

public class mayoreo_articulos extends AppCompatActivity {
    RecyclerView recyclerView;
    adapter.adap_mayoreo adap_mayoreo;
    AutoCompleteTextView autoCompleteTextView;
    SlidingUpPanelLayout sliding;
    PopupWindow popupWindow;
    LottieAnimationView animation_check_1, animationVacio;
    JSONObject arrayRespaldoComparacion = new JSONObject();
    TextInputEditText cantidad_Input;
    TextInputEditText precio_Input;
    String mayoreo      = "mayoreo";
    String cantMayoreo  = "cantMayoreo";
    Button but_ventas_this;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.descuento);
        ConstraintLayout constrainThis = (ConstraintLayout)findViewById(R.id.consMayore_layout_propiedades);
        constrainThis.setVisibility(View.VISIBLE);
        ConstraintLayout cons1 = (ConstraintLayout)findViewById(R.id.cons_3_x_n);
        cons1.setVisibility(View.GONE);
        ConstraintLayout cons2 = (ConstraintLayout)findViewById(R.id.conDescuento_layout_propiedades);
        cons2.setVisibility(View.GONE);
        ((TextView)findViewById(R.id.textVew_vistarArt_propiedades_encabezado)).setText("Aticulos mayoreo");

        generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());

        but_ventas_this     = (Button)findViewById(R.id.but_ver_ventas_con_propiedades);
        animation_check_1   = findViewById(R.id.animation_view);
        animation_check_1   .setVisibility(View.GONE);
        animationVacio      = findViewById(R.id.animation_vacio);
        animationVacio      .setVisibility(View.GONE);

        autoCompleteTextView    = (AutoCompleteTextView)findViewById(R.id.autoCompleteBusqedaAgrgarCliente5);
        sliding                 = (SlidingUpPanelLayout) findViewById(R.id.slidin_articulos_propiedades_1);
        cantidad_Input          = (TextInputEditText) findViewById(R.id.inputEditText_16);
        precio_Input            = (TextInputEditText) findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo);

        JSONArray array = statusHayMayoreo();
        if(array.length() == 0) {
            animationVacio.playAnimation();
            animationVacio.setVisibility(View.VISIBLE);
        }

        recyclerView    = (RecyclerView) findViewById(R.id.recycler_multi_propiedades_del_articulo);
        initRecyclerC(recyclerView);
        adap_mayoreo    = new adap_mayoreo(this, array);
        recyclerView.setAdapter(adap_mayoreo);

        autoCompleteId_busqueda_funcionse();
        keyboard();
        backPressed_sliding();
        slidingStatus();
        buttons();
    }

    private void onPanelCollapsed() {
        if (!cantidad_string.equals("") && !precio_string.equals("")){
            JSONObject object = null;
            try {
                boolean statusIgual = false;
                if(indexModificar < 0){
                    object = new JSONObject(jsonArticulos.getJSONObject(id_sliding).toString());
                    object.put("nuevo"    , "");
                }else {
                    object = new JSONObject(adap_mayoreo.getArray().getJSONObject(indexModificar).toString());
                    if(!object.getString("cantMayoreo").equals(cantidad_string) || ! object.getString("mayoreo").equals(precio_string)){
                        object.put("editado", "");
                    }else statusIgual = true;
                    String id = adap_mayoreo.getArray().getJSONObject(indexModificar).getString("id");
                    if(arrayRespaldoComparacion.has(id)){
                        if (arrayRespaldoComparacion.getJSONObject(id).has("cantMayoreo")){
                            if(arrayRespaldoComparacion.getJSONObject(id).getString("cantMayoreo").equals(cantidad_string)
                                    &&
                                    arrayRespaldoComparacion.getJSONObject(id).getString("mayoreo").equals(precio_string)){
                                object.remove("editado");
                            }
                        }
                    }
                    if (object.has("nuevo") && object.has("editado")){
                        object.remove("nuevo");
                    }
                }
                if (!statusIgual){
                    object.put("cantMayoreo", cantidad_string);
                    object.put("mayoreo"    , precio_string);
                    if (indexModificar < 0) {
                        adap_mayoreo.add(object);
                        if(animationVacio.getVisibility() == View.VISIBLE){
                            animationVacio.setVisibility(View.GONE);animationVacio.pauseAnimation();
                        }
                    } else {
                        adap_mayoreo.actualzarEdicionArt(indexModificar, object);
                    }
                }else toast("LOS CAMPOS SON IGUALES", getApplicationContext());

                ocultarTeclado(this);
                indexModificar = -1;
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else ocultarTeclado(this);
    }

    String id_sliding = "", cantidad_string, precio_string;
    public void buttons(){
        ((Button)findViewById(R.id.butagregar_propiedades)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {

                if (cantidad_Input.length() > 0 && precio_Input.length() > 0){
                    cantidad_string = cantidad_Input.getText().toString();
                    precio_string   = precio_Input.getText().toString();
                    status_slidind = true;
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                }else toast("FALTAN DATOS", getApplicationContext());
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
                    popBotonConfirmarDescuento.showPopupWindow(view, mayoreo_articulos.this);
                }
            }
        });
    }

    static int indexModificar = -1;
    public void editarArticulo(int index, JSONObject object){
        indexModificar = index;
        sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        TextInputEditText cantidad = (TextInputEditText) findViewById(R.id.inputEditText_16);
        TextInputEditText precio   = (TextInputEditText) findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo);
        try {
            ((TextView)findViewById(R.id.textViewPrecioActual_art_propiedades)).setText(object.getString("precioVenta"));
            cantidad.setText(object.getString("cantMayoreo"));
            precio  .setText(object.getString("mayoreo"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    static boolean status_slidind = false;
    private void clic(String id_){
        String id = siExiste(id_);
        if(!id.equals("")){
            JSONArray array = adap_mayoreo.getArray(); boolean status = false;
            for (int i = 0; i < array.length(); i++){
                try {
                    if (array.getJSONObject(i).getString("id").equals(id)){
                        adap_mayoreo.setClic(i); status = true; break;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            autoCompleteTextView.setText("");autoCompleteTextView.setCursorVisible(false);
            if (!status){
                try {
                    if(animationVacio.getVisibility() == View.VISIBLE){
                        animationVacio.setVisibility(View.GONE);animationVacio.pauseAnimation();
                    }
                    ((TextView)findViewById(R.id.textViewPrecioActual_art_propiedades)).setText(jsonArticulos.getJSONObject(id).getString("precioVenta"));
                    ((TextInputEditText) findViewById(R.id.inputEditText_16)).setText("");
                    ((TextInputEditText) findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo)).setText("");
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                indexModificar = -1;
                sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
                status_slidind = true;
                id_sliding          = id;
                ocultarTeclado(this);
            }else {
                recyclerView.scrollToPosition(0);
                adap_mayoreo.starAnimation();
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
                // Verifica si el clic fue en el drawable de la derecha
                if (event.getRawX() >= (autoCompleteTextView.getRight() - autoCompleteTextView.getCompoundDrawables()[2].getBounds().width())) {
                    photoBarcode(this);
                    return true;
                }
            }
            return false;
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Procesa el resultado del escaneo
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                toast("CANCELADO", getApplicationContext());
            } else {
                // Código escaneado
                String codigoEscaneado = result.getContents();
                autoCompleteTextView.setText(codigoEscaneado);
                clic(codigoEscaneado + " 1");
                // Aquí puedes manejar el código escaneado, por ejemplo, almacenarlo o procesarlo
            }
        }
    }
    private JSONArray statusHayMayoreo(){
        JSONArray array = new JSONArray();
        if (jsonArticulos.length() > 0){
            for (int i = 0; i < jsonArticulos.names().length(); i++){
                try {
                    if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("mayoreo")){
                        array.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                        arrayRespaldoComparacion.put(jsonArticulos.names().getString(i), jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        return array;
    }

    @Override
    protected void onResume(){
        super.onResume();
    }
    private void backPressed_sliding(){
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (sliding.getPanelState() == SlidingUpPanelLayout.PanelState.EXPANDED) {
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                } else {
                    if(!comprabar_si_hay_nuevos_o_editados()){
                        setEnabled(false);
                        finish();
                    }else {
                        barra_semiNegra_pop();
                        View rootView = findViewById(android.R.id.content);
                        pop.mensaje_antes_deSalir mensajeAntesDeSalir = new mensaje_antes_deSalir();
                        mensajeAntesDeSalir.showPopupWindow(rootView, mayoreo_articulos.this);
                    }
                }
            }
        });
    }
    private boolean comprabar_si_hay_nuevos_o_editados(){
        boolean status = false;
        JSONArray array = adap_mayoreo.getArray();
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
        for (int i = 0; i < adap_mayoreo.getItemCount(); i++){
            try {
                JSONObject object = adap_mayoreo.getArray().getJSONObject(i);
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
            int cambios = adap_mayoreo.getItemCount();
            for (int i = 0; i < adap_mayoreo.getItemCount(); i++){
                try {
                    JSONObject object = adap_mayoreo.getArray().getJSONObject(i);
                    if(object.has("nuevo") || object.has("editado") || object.has("remove")){
                        String id = object.getString("id");
                        boolean estado = false;
                        if (!jsonArticulos.getJSONObject(id).has(mayoreo)){
                            if(object.has("remove")){
                                estado = true;
                                cambios--;
                            }
                        }
                        if(!estado){
                            JSONObject artProv = new JSONObject(jsonArticulos.getJSONObject(id).toString());
                            if(!object.has("remove")) {
                                artProv.put(mayoreo, object.getString(mayoreo));
                                artProv.put(cantMayoreo, object.getString(cantMayoreo));
                            }
                            else {
                                artProv.remove(mayoreo);
                                artProv.remove(cantMayoreo);
                            }

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
                                                adap_mayoreo.reset();
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
                adap_mayoreo.reset();
            }
        }else {
            toast("NINGUN CAMBIO", getApplicationContext());
            adap_mayoreo.reset();
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
                // Este método se llama cuando el estado del panel cambia.
                if (newState == SlidingUpPanelLayout.PanelState.COLLAPSED) {
                    // El panel se ha colapsado completamente.
                    if (status_slidind){
                        status_slidind = false;
                        onPanelCollapsed();
                    }
                } else if (newState == SlidingUpPanelLayout.PanelState.EXPANDED) {
                    // El panel se ha expandido completamente.
                }
                // Puedes manejar otros estados si lo necesitas
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
