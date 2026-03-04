package pop;

import static com.example.nodo_1.principal.jsonArticulos;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.pedidosAgregarReg;
import com.example.nodo_1.principal;

import org.json.JSONException;

import adapter.adapRegVenta;
import adapter.adpPopTalla;

public class popVariacion_venta {

    String tallaSelec = "";
    boolean igual = false;
    public void showPopupWindow(
            final View view,
            principal principal,
            String id,
            int indexRepetido,
            adapRegVenta adapRegVenta,
            pedidosAgregarReg pedidosAgregarReg
            ) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_variacion_venta, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);


        RecyclerView recyclerView = (RecyclerView)popupView.findViewById(R.id.recyclerVariacionPop);
        generales.recyclerHorizontal(recyclerView, popupView.getContext());
        adpPopTalla adpPopTalla = new adpPopTalla(popVariacion_venta.this, id, popupView.getContext());
        recyclerView.setAdapter(adpPopTalla);

        EditText editTextSeña = (EditText)popupView.findViewById(R.id.editTextText);
        Button butConfirmar = (Button) popupView.findViewById(R.id.button);

        Button x_borrarCampoPopVarVenta = (Button) popupView.findViewById(R.id.x_borrarCampoPopVarVenta);


        try {
            if(jsonArticulos.getJSONObject(id).has("seña")){
                editTextSeña.setVisibility(View.VISIBLE);
            }else {
                editTextSeña.setVisibility(View.GONE);
                x_borrarCampoPopVarVenta.setVisibility(View.GONE);
            }
            if(jsonArticulos.getJSONObject(id).has("talla")){
                recyclerView.setVisibility(View.VISIBLE);
            }else recyclerView.setVisibility(View.GONE);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }


        x_borrarCampoPopVarVenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                editTextSeña.setText("");
            }
        });

        butConfirmar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    String talla = "", seña = "";

                    int cant = 0;
                    if(jsonArticulos.getJSONObject(id).has("talla")){
                      cant++;
                    }
                    if(jsonArticulos.getJSONObject(id).has("seña")){
                        cant++;
                    }
                    if(jsonArticulos.getJSONObject(id).has("talla")){
                        if(!tallaSelec.equals("")){
                            talla = tallaSelec;
                            cant--;
                        }
                    }
                    if(jsonArticulos.getJSONObject(id).has("seña")){
                        if(editTextSeña.length() > 0){
                           seña = editTextSeña.getText().toString();
                           cant--;
                        }
                    }
                    if(cant == 0){
                        if(principal != null){
                            principal.venta_seleccion_(id, talla, seña, igual);
                        }else {
                            pedidosAgregarReg.venta_seleccion_(id, talla, seña, igual);
                        }
                        popupWindow.dismiss();
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }

            }
        });
    }
    public void setTallaSelec(String s){tallaSelec = s;}
}
