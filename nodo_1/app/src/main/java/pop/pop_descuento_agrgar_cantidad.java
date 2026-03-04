package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import org.json.JSONException;
import org.json.JSONObject;

import propiedades_articulos.generarDescuento;

public class pop_descuento_agrgar_cantidad {
    public void showPopupWindow(final View view,
                                generarDescuento generarDescuento,
                                JSONObject object,
                                InputMethodManager imm,
                                adapter.adapterVErEditarDescuentos adapterVErEditarDescuentos) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_descuento_ingrsar, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        if(principal.jsonArticulos.length() > 0){

            TextView precioActual   = (TextView)popupView.findViewById(R.id.textView588);
            EditText editText = (EditText) popupView.findViewById(R.id.textView590);
            try {
                ((TextView)popupView.findViewById(R.id.textView584)).setText(object.getString("id"));
                ((TextView)popupView.findViewById(R.id.textView585)).setText(object.getString("nombre"));
                ((TextView)popupView.findViewById(R.id.textView591)).setText(object.getString("referencia"));
                if(generarDescuento == null)editText.setHint(object.getString("descuento"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

            try {
                precioActual.setText(object.getString("precioVenta"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

            editText.requestFocus();
            imm.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT);

            ((Button)popupView.findViewById(R.id.button190)).setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if(editText.length() > 0){
                        /*
                        try {
                            object.put("descuento", editText.getText().toString());
                            object.put("nuevo", "");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        if(generarDescuento != null){
                            generarDescuento.agrgarcifra(object);
                        }else {
                            try {
                                adapterVErEditarDescuentos.actualizarPrecio(editText.getText().toString(), Integer.parseInt(object.getString("index")));
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                         */
                        popupWindow.dismiss();
                    }
                }
            });
        }else generales.toast("NO HAY ARTICULOS REGISTRADOS", popupView.getContext());
    }
}
