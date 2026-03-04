package pop;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.pedidos;

public class pop_liquidar_cancelar {
    Context context;
    public void showPopupWindow(View view, String estado, pedidos pedidos) {

        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_confirmar_simple_boton_uno, null);
        context = popupView.getContext();
        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;
        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        Button but = (Button) popupView.findViewById(R.id.butsimple_pop);

        if(pedidos.equals("liquidar"))but.setText("liquidar");
        else but.setText("cancelar");
        but.setText(estado);
        but.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(estado.equals("liquidar")){
                    pedidos.liquidarPedido();
                }else {
                    pedidos.liquidarPedido();
                }
                popupWindow.dismiss();
            }
        });

    }
}
