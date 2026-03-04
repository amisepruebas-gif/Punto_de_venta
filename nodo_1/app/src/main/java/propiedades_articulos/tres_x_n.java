package propiedades_articulos;

import static com.example.nodo_1.generales.init_getArrayList_AutocompleteCodigo;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;
import static generales_1.recursos_1.ocultarTeclado;
import static propiedades_articulos.generarDescuento.siExiste;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.text.Editable;
import android.text.TextWatcher;
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
import android.widget.EditText;
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
import com.example.nodo_1.principal;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;

import pase_de_lista.actualizarArticulo_paseDeLista;
import pop.mensaje_antes_deSalir;
import pop.popBotonConfirmarDescuento;
import teclado.KeyboardAwareLinearLayout;


public class tres_x_n extends AppCompatActivity{

    RecyclerView recyclerView;
    adapter.adapter_3_x_n adapter_3_x_n;

    SlidingUpPanelLayout sliding;
    AutoCompleteTextView autoCompleteTextView;
    static boolean status_nuevos_editados = false;
    String id_sliding = "";
    static int indexModificar = -1;
    JSONObject arrayRespaldoComparacion = new JSONObject();
    PopupWindow popupWindow;
    TextView precionCon, precioSin, precioCompra, precioVenta;
    TextView valorCompra_1, valorCompra_2;
    TextView cabeceraSliding;
    EditText edit_izq, edit_der;
    LottieAnimationView animation_check_1, animationVacio;
    Button but_ventas_this;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.descuento);
        generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());

        ConstraintLayout cons1 = (ConstraintLayout)findViewById(R.id.consMayore_layout_propiedades);
        ConstraintLayout cons2 = (ConstraintLayout)findViewById(R.id.conDescuento_layout_propiedades);
        ConstraintLayout consThis = (ConstraintLayout)findViewById(R.id.cons_3_x_n);
        cons2.setVisibility(View.GONE);cons1.setVisibility(View.GONE);
        consThis.setVisibility(View.VISIBLE);

        ((TextView)findViewById(R.id.textVew_vistarArt_propiedades_encabezado)).setText("2 X 1");
        ((Button)findViewById(R.id.butagregar_propiedades)).setText("APLICAR");

        but_ventas_this     = (Button)findViewById(R.id.but_ver_ventas_con_propiedades);
        animation_check_1   = findViewById(R.id.animation_view);
        animation_check_1   .setVisibility(View.GONE);
        animationVacio      = findViewById(R.id.animation_vacio);
        animationVacio      .setVisibility(View.GONE);

        edit_izq = (EditText)findViewById(R.id.editTextText2);
        edit_der = (EditText)findViewById(R.id.editTextText6);

        precionCon      = (TextView)findViewById(R.id.textView281_);
        precioSin       = (TextView)findViewById(R.id.textView281);
        precioCompra    = (TextView)findViewById(R.id.textView284_compra);
        precioVenta     = (TextView)findViewById(R.id.textView288_venta);
        valorCompra_1   = (TextView)findViewById(R.id.can_valo_de_compra_1);
        valorCompra_2   = (TextView)findViewById(R.id.can_valo_de_compra_2);

        cabeceraSliding = (TextView)findViewById(R.id.textView202_cab_slidins_prop_art);

        sliding = (SlidingUpPanelLayout) findViewById(R.id.slidin_articulos_propiedades_1);
        autoCompleteTextView = (AutoCompleteTextView) findViewById(R.id.autoCompleteBusqedaAgrgarCliente5);

        JSONArray array = initArray();

        recyclerView = (RecyclerView) findViewById(R.id.recycler_multi_propiedades_del_articulo);
        initRecyclerC(recyclerView);
        adapter_3_x_n = new adapter.adapter_3_x_n(array, getApplicationContext(), this);
        recyclerView.setAdapter(adapter_3_x_n);

        if(array.length() == 0){
            animationVacio.setVisibility(View.VISIBLE);animationVacio.playAnimation();
            techWacher("");
        } else {
            try {
                String id = array.getJSONObject(0).getString("id");
                techWacher(id);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        autoCompleteId_busqueda_funcionse();
        keyboard();
        backPressed_sliding();
        slidingStatus();
        buttons();
    }
    private void onPanelCollapsed() {
        if(!string_izq.equals("") && !string_der.equals("")){
            JSONObject object = null;
            try {
                boolean statusIgual = false;
                if(indexModificar < 0){
                    object = new JSONObject(jsonArticulos.getJSONObject(id_sliding).toString());
                    object.put("nuevo"    , "");
                }else {
                    object = new JSONObject(adapter_3_x_n.getArray().getJSONObject(indexModificar).toString());
                    if(!object.getString("izq").equals(string_izq) || ! object.getString("der").equals(string_der)){
                        object.put("editado", "");
                    }else statusIgual = true;
                    String id = adapter_3_x_n.getArray().getJSONObject(indexModificar).getString("id");
                    if(arrayRespaldoComparacion.has(id)){
                        if (arrayRespaldoComparacion.getJSONObject(id).has("izq")){
                            if(arrayRespaldoComparacion.getJSONObject(id).getString("izq").equals(string_izq)
                                    &&
                                    arrayRespaldoComparacion.getJSONObject(id).getString("der").equals(string_der)){
                                object.remove("editado");
                            }
                        }
                    }
                    if (object.has("nuevo") && object.has("editado")){
                        object.remove("nuevo");
                    }
                }
                if (!statusIgual){
                    object.put("izq", string_izq);
                    object.put("der", string_der);
                    if (indexModificar < 0) {
                        adapter_3_x_n.add(object);
                        if(animationVacio.getVisibility() == View.VISIBLE){
                            animationVacio.setVisibility(View.GONE);animationVacio.pauseAnimation();
                        }
                    } else {
                        adapter_3_x_n.actualzarEdicionArt(indexModificar, object);
                    }
                }else toast("LOS CAMPOS SON IGUALES", getApplicationContext());

                ocultarTeclado(this);
                indexModificar = -1;
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            ocultarTeclado(this);
        }
    }
    String string_izq = "", string_der = "";
    public void buttons(){
        ((Button)findViewById(R.id.butagregar_propiedades)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (edit_izq.length() > 0 && edit_der.length() > 0){
                    if(!edit_izq.getText().toString().equals("0") && !edit_der.getText().toString().equals("0")){
                        string_izq  = edit_izq.getText().toString();
                        string_der   = edit_der.getText().toString();
                        status_slidind = true;
                        sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                    }
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
                    popBotonConfirmarDescuento.showPopupWindow(view, tres_x_n.this);
                }
            }
        });
    }
    public void guardarCambios_pop(){
        JSONArray array = new JSONArray();

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
                        mensajeAntesDeSalir.showPopupWindow(rootView, tres_x_n.this);
                    }
                }
            }
        });
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
    private boolean comprabar_si_hay_nuevos_o_editados(){
        boolean status = false;
        JSONArray array = adapter_3_x_n.getArray();
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
    public void getPopupWindow(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    public void initPop(){
        popupWindow.setOnDismissListener(new PopupWindow.OnDismissListener() {
            @Override
            public void onDismiss() {
                generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
            }
        });
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
    String izq = "izq", der = "der";
    int cont = 0;
    public void subirDatos(){
        for (int i = 0; i < adapter_3_x_n.getItemCount(); i++){
            try {
                JSONObject object = adapter_3_x_n.getArray().getJSONObject(i);
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
            int cambios = adapter_3_x_n.getItemCount();
            for (int i = 0; i < adapter_3_x_n.getItemCount(); i++){
                try {
                    JSONObject object = adapter_3_x_n.getArray().getJSONObject(i);
                    if(object.has("nuevo") || object.has("editado") || object.has("remove")){
                        String id = object.getString("id");
                        boolean estado = false;
                        if (!jsonArticulos.getJSONObject(id).has(izq)){
                            if(object.has("remove")){
                                estado = true;
                                cambios--;
                            }
                        }
                        if(!estado){
                            JSONObject artProv = new JSONObject(jsonArticulos.getJSONObject(id).toString());
                            if(!object.has("remove")) {
                                artProv.put(izq, object.getString(izq));
                                artProv.put(der, object.getString(der));
                            }
                            else {
                                artProv.remove(izq);
                                artProv.remove(der);
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
                                                adapter_3_x_n.reset();
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
                adapter_3_x_n.reset();
            }
        }else {
            toast("NINGUN CAMBIO", getApplicationContext());
            adapter_3_x_n.reset();
        }
    }
    public void setOnclick(int index, JSONObject object){
        try {
            indexModificar = index;
            status_slidind = true;
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
            cabeceraSliding.setText("EDITAR VALORES");
            id_sliding = object.getString("id");
            edit_izq.setText(object.getString("izq"));
            edit_der.setText(object.getString("der"));
            precioCompra.setText(object.getString("preciCompra"));
            precioVenta .setText(object.getString("precioVenta"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    static boolean status_slidind = false;
    private void clic(String id_){
        String id = siExiste(id_);
        if(!id.equals("")){
            JSONArray array = adapter_3_x_n.getArray(); boolean status = false;
            for (int i = 0; i < array.length(); i++){
                try {
                    if (array.getJSONObject(i).getString("id").equals(id)){
                        adapter_3_x_n.setClic(i); status = true; break;
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            autoCompleteTextView.setText("");autoCompleteTextView.setCursorVisible(false);
            if (!status){
                edit_izq.setText("");edit_der.setText("");
                cabeceraSliding.setText("ARTICULO NO ENCONTRADO");
                techWacher(id);
                indexModificar = -1;
                id_sliding     = id;
                ocultarTeclado(this);
                sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
            }else {
                recyclerView.scrollToPosition(0);
                adapter_3_x_n.starAnimation();
                ocultarTeclado(this);
            }
        }else toast("ARTICULO NO ENCONTRADO", getApplicationContext());
    }
    private void techWacher(String id){
        try {
            if(!id.equals("")){
                String compra = jsonArticulos.getJSONObject(id).getString("preciCompra");
                String venta  = jsonArticulos.getJSONObject(id).getString("precioVenta");
                String diferencia = String.valueOf(Integer.parseInt(venta) - Integer.parseInt(compra));
                precioVenta.setText(venta);
                precioCompra.setText(compra);
                precioSin   .setText(diferencia);

                int dos = Integer.parseInt(compra) * 2;
                diferencia = String.valueOf(Integer.parseInt(venta) - dos);
                precionCon .setText(diferencia);

                techWacher_init(compra, venta);
            }else techWacher_init("", "");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    private void techWacher_init(String compra, String venta){
        edit_izq.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override
            public void afterTextChanged(Editable editable) {
                if (!compra.equals("") && !venta.equals("")){
                    if (edit_izq.length() > 0 && edit_der.length() > 0){
                        if(!edit_izq.getText().toString().equals("0") && !edit_der.getText().toString().equals("0")){
                            interEditTest(edit_izq, edit_der, compra, venta);
                        }
                    }
                }
            }
        });
        edit_der.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override
            public void afterTextChanged(Editable editable) {
                if (!compra.equals("") && !venta.equals("")){
                    if (edit_der.length() > 0 && edit_izq.length() > 0){
                        if(!edit_der.getText().toString().equals("0") && !edit_izq.getText().toString().equals("0")){
                            interEditTest(edit_izq, edit_der, compra, venta);
                        }
                    }
                }
            }
        });
    }
    private void interEditTest(EditText edit_izq, EditText edit_der, String compra, String venta){
        int var =
                (Integer.parseInt(venta) * Integer.parseInt(edit_der.getText().toString()))
                        -
                        (Integer.parseInt(edit_izq.getText().toString()) * Integer.parseInt(compra));
        int res = var/Integer.parseInt(edit_izq.getText().toString());
        precionCon.setText(String.valueOf(res));

        try {
            String pt1 = calcularCadena(Double.parseDouble(String.valueOf(Integer.parseInt(venta)-Integer.parseInt(compra))), Double.parseDouble(compra)).getString("cadena");
            String pt2 = "TU ARTICULO COSTO $" + compra + "\n" +"SIN APLICAR LA MODIFICACÓN"+"\n"+"TENDRAS UNA GANACIA"+"\n"+"POR ARTICULO DE $"
                    + String.valueOf(Integer.parseInt(venta) - Integer.parseInt(compra));
            valorCompra_1.setText(pt1 + "\n" + pt2);

            pt1 = calcularCadena(Double.parseDouble(String.valueOf(res)), Double.parseDouble(compra)).getString("cadena");
            pt2 = "TU ARTICULO COSTO $" + compra + "\n" +"CON ESTA MODIFICACÓN TENDRAS UNA GANACIA"+"\n"+"POR ARTICULO DE $" + String.valueOf(res);

            valorCompra_2.setText(pt1 + "\n" + pt2);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public JSONObject calcularCadena(double a, double b) {
        JSONObject jsonObject = new JSONObject();
        String cadena = "";
        double diferencia = a - b;

        if (a < b) {
            cadena = "Por debajo del valor de compra";
        } else if (a == b) {
            cadena = "Igual al valor de compra";
        } else {
            int k = (int) (a / b);
            double resto = a % b;

            if (k == 1) {
                cadena = "Un poco por encima del valor de compra";
            } else {
                if (resto == 0) {
                    cadena = k + " veces el valor de compra";
                } else {
                    cadena = k + " veces y un poco más";
                }
            }
        }

        try {
            jsonObject.put("cadena", cadena);
            jsonObject.put("diferencia", diferencia);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        return jsonObject;
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
                    generales_1.recursos_1.photoBarcode(tres_x_n.this);
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
                clic(codigoEscaneado + " " + "0");
                ocultarTeclado(this);
                // Aquí puedes manejar el código escaneado, por ejemplo, almacenarlo o procesarlo
            }
        }
    }
    private JSONArray initArray(){
        JSONArray array = new JSONArray();
        if(jsonArticulos.length() > 0){
            try {
                for (int i = 0; i < jsonArticulos.names().length(); i++){
                    if (jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("izq")){
                        JSONObject object = new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString());
                        array.put(object);
                        arrayRespaldoComparacion.put(jsonArticulos.names().getString(i), jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)));
                    }
                }
            }catch (JSONException e){
                throw new RuntimeException(e);
            }
        }
        return array;
    }
    private void initRecyclerC(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new GridLayoutManager(getApplicationContext(), 2));
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
}
