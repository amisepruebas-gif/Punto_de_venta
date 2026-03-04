package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.admin;
import com.example.nodo_1.generales;

import org.json.JSONException;
import org.json.JSONObject;

public class pop_informacionDeposito {

    public void showPopupWindow(final View view, admin admin) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_onformacion_deposito, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        EditText editBanco      = (EditText) popupView.findViewById(R.id.button2);
        EditText editNumTarjeta = (EditText) popupView.findViewById(R.id.button28);
        EditText editReferencia = (EditText) popupView.findViewById(R.id.button29);
        EditText editTitular    = (EditText) popupView.findViewById(R.id.button31);
        EditText editMotivo     = (EditText) popupView.findViewById(R.id.button32);

        if(!generales.loadData_sharedPreferences(
                popupView.getContext(),
                popupView.getContext().getString(R.string.transferencia_datos),
                popupView.getContext().getString(R.string.transferencia_datos)).equals("")){
            try {
                JSONObject object = new JSONObject(generales.loadData_sharedPreferences(
                        popupView.getContext(),
                        popupView.getContext().getString(R.string.transferencia_datos),
                        popupView.getContext().getString(R.string.transferencia_datos)));

                editBanco       .setText(object.getString("banco"));
                editNumTarjeta  .setText(object.getString("tarjeta"));
                editReferencia  .setText(object.getString("referencia"));
                editTitular     .setText(object.getString("titular"));
                editMotivo      .setText(object.getString("motivo"));


            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        Button button = (Button) popupView.findViewById(R.id.button33);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(editNumTarjeta.length() > 0 || editReferencia.length() > 0){
                    JSONObject object = new JSONObject();
                    try {
                        if (editBanco.length() > 0)         object.put("banco", editBanco.getText().toString());
                        else object.put("banco"," ");
                        if (editNumTarjeta.length() > 0)    object.put("tarjeta", editNumTarjeta.getText().toString());
                        else object.put("tarjeta"," ");
                        if (editReferencia.length() > 0)    object.put("referencia", editReferencia.getText().toString());
                        else object.put("referencia"," ");
                        if (editTitular.length() > 0)       object.put("titular", editTitular.getText().toString());
                        else object.put("titular"," ");
                        if (editMotivo.length() > 0)        object.put("motivo", editMotivo.getText().toString());
                        else object.put("motivo"," ");

                        admin.guardarDatosTransferencia(object);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        });

    }
    private boolean isUpdating;
}
