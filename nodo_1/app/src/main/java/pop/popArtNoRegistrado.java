package pop;

import static android.content.Context.MODE_PRIVATE;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.PopupWindow;

import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONException;
import org.json.JSONObject;

import adapter.adapterVerregistroParaPedido;

public class popArtNoRegistrado {

    boolean estadoApNombreIgualReservado = false;
    public void showPopupWindow(final View view,
                                final adapter.adapRegVenta adapRegVenta,
                                InputMethodManager imm) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_art_no_reg, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        EditText editReferencia = (EditText)popupView.findViewById(R.id.editRefProdNoReg);
        editReferencia.requestFocus();
        imm.showSoftInput(editReferencia, InputMethodManager.SHOW_IMPLICIT);
        final Button
                cancelar = popupView.findViewById(R.id.butCancelarNoReg),
                agregar  = popupView.findViewById(R.id.butAgregarNoReg);

        EditText editRefProdNoReg = (EditText)popupView.findViewById(R.id.editRefProdNoReg);
        // if(if_Ap.equals("ABONO APARTADO") || if_Ap.equals("INICIO APARTADO") || if_Ap.equals("LIQUIDACION APARTADO")){





        agregar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(((EditText)popupView.findViewById(R.id.editRefProdNoReg)).length()         > 0 &&
                        ((EditText)popupView.findViewById(R.id.editPrecioProdNoReg)).length() > 0 &&
                        ((EditText)popupView.findViewById(R.id.editCantProdNoReg)).length()   > 0 &&
                        !estadoApNombreIgualReservado
                ){
                    JSONObject object = new JSONObject();
                    try {
                        object.put("no_registrado", "");
                        object.put("id", "00000000");
                        object.put("precio",        ((EditText)popupView.findViewById(R.id.editPrecioProdNoReg)).getText().toString());
                        object.put("cantidad",      ((EditText)popupView.findViewById(R.id.editCantProdNoReg)).getText().toString());
                        object.put("nombrePublico", ((EditText)popupView.findViewById(R.id.editRefProdNoReg)).getText().toString());
                        object.put("descripcion",   ((EditText)popupView.findViewById(R.id.editRefProdNoReg)).getText().toString());

                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                                                                                                                    //9 10 ??
                    adapRegVenta.add_noReg(object);
                    popupWindow.dismiss();
                } else {
                    if(estadoApNombreIgualReservado){
                      generales.toast("DESIGNE OTRA REFERENCIA", popupView.getContext());
                    } else generales.toast("RELLENE LOS CAMPOS", popupView.getContext());
                }
            }
        });
        cancelar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                popupWindow.dismiss();
            }
        });
    }

}
