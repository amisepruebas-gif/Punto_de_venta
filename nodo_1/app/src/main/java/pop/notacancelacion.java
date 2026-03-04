package pop;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;

import java.util.HashMap;

public class notacancelacion {

    public void showPopupWindow(final View view, String nota, String id, String proviene) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.nota_cancelacion_ap, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        TextView nota_txt = (TextView) popupView.findViewById(R.id.nota_pedido);

        Button button = (Button) popupView.findViewById(R.id.but_guardarNota_cliente_ap);
        if(nota.equals("")){
            nota_txt.setHint("ESCRIBE UNA NOTA");
            button.setText("guardar");
        }
        else {
            nota_txt.setText(nota);
            button.setText("actualizar");
        }


        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(nota_txt.length() > 0){
                    if(proviene.equals("cliente")){
                        try {
                            jsonClientes.getJSONObject(id).put("nota", nota_txt.getText().toString());
                            fire.documenRef("cliente/" + id).
                                    update(new Gson().fromJson(
                                            jsonClientes.getJSONObject(id).toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener() {
                                        @Override
                                        public void onSuccess(Object o) {
                                            toast("DATOS ACTUALIZADOS", popupView.getContext());
                                        }
                                    });
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else {
                        try {
                            jsonPedido.getJSONObject(id).put("nota", nota_txt.getText().toString());
                            fire.documenRef("apartados/" + id).
                                    update(new Gson().fromJson(
                                            jsonPedido.getJSONObject(id).toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener() {
                                        @Override
                                        public void onSuccess(Object o) {
                                            toast("DATOS ACTUALIZADOS", popupView.getContext());
                                        }
                                    });
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
            }
        });

    }

}
