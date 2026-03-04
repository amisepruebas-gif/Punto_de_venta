package com.example.nodo_1;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.AutoCompleteTextView;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import adapter.adapVistaArticulos;
import barcodeCamara.MyCaptureActivity;
import teclado.KeyboardAwareLinearLayout;

public class vistaArticulosTodos extends AppCompatActivity implements View.OnClickListener {

    AutoCompleteTextView autoCompTxw_vistaArt;
    public SlidingUpPanelLayout sliding;


    adapVistaArticulos adapVistaArticulos;
    TextView textView;
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.vista_articulos_todos);
        window();
        autoCompTxw_vistaArt = (AutoCompleteTextView) findViewById(R.id.autoCompTxw_vistaArt);
        autoCompTxw_vistaArt.setEnabled(false);
        textView = (TextView) findViewById(R.id.textViewTitulo_vista_articulos);
        textView.setText("NINGÚN ARTICULO");
        if(jsonArticulos.length() > 0){
            autoCompTxw_vistaArt.setOnTouchListener((v, event) -> {
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    // Verifica si el clic fue en el drawable de la derecha
                    if (event.getRawX() >= (autoCompTxw_vistaArt.getRight() - autoCompTxw_vistaArt.getCompoundDrawables()[2].getBounds().width())) {
                        photoBarcode();
                        return true;
                    }
                }
                return false;
            });
            textView.setText("TODOS");
            sliding = (SlidingUpPanelLayout) findViewById(R.id.panelStateVista_Art_Todods);
            autoCompTxw_vistaArt.setEnabled(true);
            RecyclerView recyclerView = (RecyclerView) findViewById(R.id.recycler_vistaTodos_articulos);
            ((ConstraintLayout) findViewById(R.id.cons_aun_no_hay_elementos)).setVisibility(View.VISIBLE );
            adapVistaArticulos = new adapVistaArticulos(
                    getApplicationContext(),
                    ((ConstraintLayout) findViewById(R.id.cons_aun_no_hay_elementos)),
                    this);
            generales.recyclerVertical(recyclerView, getApplicationContext());
            recyclerView.setAdapter(adapVistaArticulos);

            KeyboardAwareLinearLayout layout = findViewById(R.id.keyboardAwareLayout);
            layout.setKeyboardVisibilityListener(new KeyboardAwareLinearLayout.KeyboardVisibilityListener() {
                @Override
                public void onVisibilityChanged(boolean isVisible) {
                    ViewGroup.LayoutParams params = autoCompTxw_vistaArt.getLayoutParams();
                    if (isVisible) {
                        params.width = 0;
                    } else {
                        params.width = ViewGroup.LayoutParams.WRAP_CONTENT;
                    }
                    autoCompTxw_vistaArt.setLayoutParams(params);
                }
            });
            getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (sliding.getPanelState() == SlidingUpPanelLayout.PanelState.EXPANDED) {
                        sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                    } else {
                        setEnabled(false);
                        finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
                    }
                }
            });


        }else toast("NO HAY ARTICULOS REGISTRADOS", getApplicationContext());
    }
    public void verPorID(String idArt){
        Intent askIntent = new Intent(this, buscar_por_id.class);
        askIntent.putExtra("idArt", idArt);
        someActivityResultLauncher.launch(askIntent);
    }
    private void window(){
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

    @Override
    public void onClick(View view) {
        boolean estado = false;
        if(R.id.but_tipos_de_vista_art_class== view.getId()){
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
            estado = true;
        } else if (R.id.but_tipo_de_busqueda_existencia == view.getId()) {
            adapVistaArticulos.filtro("existencia");    textView.setText("EN EXISTENCIA");
        } else if (R.id.but_tipo_de_busqueda_descuento == view.getId()) {
            adapVistaArticulos.filtro("descuento");     textView.setText("CON DESCUENTO");
        } else if (R.id.but_tipo_de_busqueda_mayoreo == view.getId()) {
            adapVistaArticulos.filtro("mayoreo");       textView.setText("CON MAYOREO");
        } else if (R.id.but_tipo_de_busqueda_2x1 == view.getId()) {
            adapVistaArticulos.filtro("2x1");           textView.setText("CON 2 X 1");
        } else if (R.id.but_tipo_de_busqueda_talla == view.getId()) {
            adapVistaArticulos.filtro("tallas");         textView.setText("TIENEN TALLA");
        } else if (R.id.but_tipo_de_busqueda_seña == view.getId()) {
            adapVistaArticulos.filtro("seña");          textView.setText("TIENEN UNA SEÑA");
        } else if (R.id.but_tipo_de_busqueda_ver_text_imput == view.getId()) {

        }
       if(!estado)sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
    }

    public void setativity(String direccion, String data){
        if (direccion.equals("ventas")){
            Intent askIntent = new Intent(this, editar_articulos.class);
            askIntent.putExtra("id", data);
            someActivityResultLauncher.launch(askIntent);
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
                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });

    public void photoBarcode(){
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES);
        integrator.setPrompt("Escanea un código de barras");
        integrator.setCameraId(0);  // Usa la cámara trasera
        integrator.setBeepEnabled(true);
        integrator.setCaptureActivity(MyCaptureActivity.class); // Usa tu actividad personalizada
        integrator.setOrientationLocked(true); // Bloquea la orientación
        integrator.initiateScan();

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
                autoCompTxw_vistaArt.setText(codigoEscaneado);
                // Aquí puedes manejar el código escaneado, por ejemplo, almacenarlo o procesarlo
            }
        }
    }
}
