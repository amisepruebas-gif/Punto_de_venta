package propiedades_articulos;

import static com.example.nodo_1.generales.initPantalla_barra_blanca_texto_negro;
import static com.example.nodo_1.generales.toast;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Objects;

import adapter.adapTallas;
import pop.simple_boton_confirmar_generico;
import teclado.KeyboardAwareLinearLayout;

public class agregar_tallas_etc extends AppCompatActivity implements View.OnClickListener {

    adapTallas adapTallas_sliding;
    JSONObject objectComp = new JSONObject();
    JSONObject objExistencia_coparar_titulo = new JSONObject();
    PopupWindow popupWindow;
    Button butAgregar_propiedades;
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.pop_art_tallas_3xn);
        initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());

        butAgregar_propiedades = (Button)findViewById(R.id.butagregar_propiedades);

        RecyclerView recyclerView = (RecyclerView) findViewById(R.id.recycler_propiedades_1);
        generales.recyclerVertical(recyclerView, getApplicationContext());
        adapTallas_sliding = new adapTallas(new JSONArray(), true);

        recyclerView.setAdapter(adapTallas_sliding);

        Intent intent = getIntent();

        if (intent != null){
            if(intent.hasExtra("editar")){
                try {
                    JSONArray array = new JSONArray(Objects.requireNonNull(intent.getStringExtra("editar_array")));
                    String    name  = intent.getStringExtra("editar_name");
                    objectComp.put(name, array);
                    adapTallas_sliding.actualizarRegistro(array);
                    ((TextInputEditText) findViewById(R.id.inputEditText_precioConDesc)).setText(name);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            } else if (intent.hasExtra("existencia")) {
                try {
                    objExistencia_coparar_titulo = new JSONObject(Objects.requireNonNull(intent.getStringExtra("existencia")));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        keyboard();
    }
    public void salir_Guardar_Confirmar(){
        try {
            TextInputEditText n = (TextInputEditText) findViewById(R.id.inputEditText_precioConDesc);
            String name = n.getText().toString();
            Intent askIntent = new Intent(this, tallas.class);
            boolean statusIgual = false, statusEdicion = false;
            JSONObject object = new JSONObject();
            object.put(name, adapTallas_sliding.getArray());

            if (objExistencia_coparar_titulo.has(name)){

            }else {
                if(objectComp.length() > 0){
                    statusEdicion = true;
                    if(objectComp == object){
                        statusIgual = true;
                    }
                }
                if (statusEdicion){
                    if (!statusIgual) {
                        askIntent.putExtra("agregar_tallas_etc_edicion"     , object.toString());
                    }else  askIntent.putExtra("agregar_tallas_etc_edicion"  , "");
                }else {
                    askIntent.putExtra("agregar_tallas_etc"                 , object.toString());
                }
                setResult(Activity.RESULT_OK, askIntent);
                finish();
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public void onClick(View view) {
        if(R.id.butagregar_propiedades == view.getId()){
            TextInputEditText inputEditText_Grupo = (TextInputEditText) findViewById(R.id.inputEditText_precioConDesc);
            if(inputEditText_Grupo.length() > 0 && adapTallas_sliding.getItemCount() > 0){
                try {
                    JSONObject object = new JSONObject(); object.put(inputEditText_Grupo.getText().toString(), adapTallas_sliding.getArray());
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                barra_semiNegra_pop();
                pop.simple_boton_confirmar_generico simpleBotonConfirmarGenerico = new simple_boton_confirmar_generico();
                simpleBotonConfirmarGenerico.showPopupWindow(view, this);
            }else toast("FALTAN DATOS", getApplicationContext());
        } else if (R.id.but_agregar_art_prop == view.getId()) {
            EditText editText = (EditText) findViewById(R.id.editTextText_lisding_art_prop_1);
            if(editText.length() > 0){
                adapTallas_sliding.add(editText.getText().toString());
                editText.setText("");
            }
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
                            if(data.hasExtra("registroExitoso"))
                            {

                            }
                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });
    private void keyboard() {
        KeyboardAwareLinearLayout layout = findViewById(R.id.keyboardAwareLayout_tallas);

        if (butAgregar_propiedades != null) {
            layout.setKeyboardVisibilityListener(new KeyboardAwareLinearLayout.KeyboardVisibilityListener() {
                @Override
                public void onVisibilityChanged(boolean isVisible) {
                    float height = isVisible ? 0.1f : 55f;
                    int heightInPx = (int) TypedValue.applyDimension(
                            TypedValue.COMPLEX_UNIT_DIP,
                            height,
                            getResources().getDisplayMetrics()
                    );
                    ViewGroup.LayoutParams params = butAgregar_propiedades.getLayoutParams();
                    params.height = heightInPx;
                    butAgregar_propiedades.setLayoutParams(params);
                    if (isVisible)butAgregar_propiedades.setVisibility(View.GONE);
                    else butAgregar_propiedades.setVisibility(View.VISIBLE);
                }
            });
        } else {
            // Manejar el caso en que el botón no se encuentra
        }
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
    private void barra_semiNegra_pop(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#99000000"));
    }
}
