package pop;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import org.json.JSONException;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class pop_barcode_imprimir {
    AutoCompleteTextView autoCompleteTextView;
    EditText precio_registrado;
    EditText precio_no_reg;
    EditText cantidad_noReg;
    TextView txt_nomArt;
    Context  context;
    public void showPopupWindow(final View view , principal principal) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_barcode_layout_imprimir, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        context = popupView.getContext();
        autoCompleteTextView = (AutoCompleteTextView) popupView.findViewById(R.id.editTextText9);
        actualizarAutocomplete();
        selecItem_autoComplete_codigoArt();
        precio_registrado = (EditText)popupView.findViewById(R.id.editTextText10);
        precio_no_reg     = (EditText)popupView.findViewById(R.id.editTextText_precio);
        cantidad_noReg    = (EditText)popupView.findViewById(R.id.editTextText14);

        precio_registrado.setEnabled(false);

        ConstraintLayout consElegir       = (ConstraintLayout)popupView.findViewById(R.id.consElegir_noRe_reg_impriirCodigo);
        ConstraintLayout consNoRegistrado = (ConstraintLayout)popupView.findViewById(R.id.consNoRegistrado);
        ConstraintLayout consRegistrado   = (ConstraintLayout)popupView.findViewById(R.id.consRegistrado);
        Button btRegresar                 = (Button)popupView.findViewById(R.id.button46);
        txt_nomArt                        = (TextView)popupView.findViewById(R.id.textView285);
        txt_nomArt.setVisibility(View.GONE);

        //NO REGISTRADO
        ((Button)popupView.findViewById(R.id.button45)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                btRegresar      .setVisibility(View.VISIBLE);
                consElegir      .setVisibility(View.GONE);
                consNoRegistrado.setVisibility(View.VISIBLE);
            }
        });

        //SI REGISTRADO
        ((Button)popupView.findViewById(R.id.button44)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                btRegresar      .setVisibility(View.VISIBLE);
                consElegir      .setVisibility(View.GONE);
                consRegistrado  .setVisibility(View.VISIBLE);
            }
        });

        btRegresar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                btRegresar      .setVisibility(View.GONE);
                consElegir      .setVisibility(View.VISIBLE);
                consRegistrado  .setVisibility(View.GONE);
                consNoRegistrado.setVisibility(View.GONE);
                txt_nomArt.setVisibility(View.GONE);
                precio_no_reg.setText("");
                cantidad_noReg.setText("");
                autoCompleteTextView.setText("");
                precio_registrado.setText("");
                ((EditText)popupView.findViewById(R.id.editTextText11)).setText("");
            }
        });
        ((Button)popupView.findViewById(R.id.button42)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(autoCompleteTextView.length() > 0
                        &&
                        precio_registrado.length() > 0
                        &&
                        ((EditText)popupView.findViewById(R.id.editTextText11)).length() > 0)
                {
                    String codigo   = ((EditText)popupView.findViewById(R.id.editTextText9)).getText().toString();
                    String precio   = ((EditText)popupView.findViewById(R.id.editTextText10)).getText().toString();
                    String cantidad = ((EditText)popupView.findViewById(R.id.editTextText11)).getText().toString();
                    principal.sendCodigo_registrado(precio, codigo, cantidad);
                }
            }
        });
        ((Button)popupView.findViewById(R.id.button43)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(precio_no_reg.length() > 0
                        &&
                        cantidad_noReg.length() > 0)
                {
                    String precio   = precio_no_reg .getText().toString();
                    String cantidad = cantidad_noReg.getText().toString();
                    principal.sendCodigo_no_reg(precio, cantidad);
                }
            }
        });
    }
    public void selecItem_autoComplete_codigoArt(){
        autoCompleteTextView.setSingleLine();
        autoCompleteTextView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoCompleteTextView.length() > 0){
                        String cadena = autoCompleteTextView.getText().toString();
                        if(cadena.contains(" ")){
                            cadena = cadena.split(" ")[0];
                        }
                        if(jsonArticulos.has(cadena)){
                            autoCompleteTextView.setText(cadena);
                            try {
                                precio_registrado.setText(jsonArticulos.getJSONObject(cadena).getString("precioVenta"));
                                txt_nomArt       .setText(jsonArticulos.getJSONObject(cadena).getString("nombre"));
                                txt_nomArt.setVisibility(View.VISIBLE);
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }else txt_nomArt.setVisibility(View.GONE);
                    }
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoCompleteTextView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int i, long l) {
                if(autoCompleteTextView.length() > 0){
                    String cadena = autoCompleteTextView.getText().toString();
                    if(cadena.contains(" ")){
                        cadena = cadena.split(" ")[0];
                    }
                    if(jsonArticulos.has(cadena)){
                        autoCompleteTextView.setText(cadena);
                        try {
                            precio_registrado.setText(jsonArticulos.getJSONObject(cadena).getString("precioVenta"));
                            txt_nomArt       .setText(jsonArticulos.getJSONObject(cadena).getString("nombre"));
                            txt_nomArt.setVisibility(View.VISIBLE);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else txt_nomArt.setVisibility(View.GONE);
                }
            }
        });
    }

    public void actualizarAutocomplete(){

        ArrayList<String> arrayList = generales.init_getArrayList_AutocompleteCodigo();

        autoCompleteTextView.setAdapter(new ArrayAdapter<String>(context, android.R.layout.simple_list_item_1, arrayList));
        generales.toast(arrayList.get(0), context);
    }
}
