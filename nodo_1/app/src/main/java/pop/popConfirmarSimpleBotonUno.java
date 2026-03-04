package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.pedidosAgregarReg;

public class popConfirmarSimpleBotonUno {
    public void showPopupWindow(final View view, String procedencia, pedidosAgregarReg pedidosAgregarReg) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_confirmar_simple_boton_uno, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        Button confirmar = (Button) popupView.findViewById(R.id.butsimple_pop);
        if(procedencia.equals("pedidosAgrgarReg_CancelarReg")){
            confirmar.setText("Salir");
        }
        confirmar.setOnClickListener(view1 -> {
            switch (procedencia){
                case "agregarAp":
                    pedidosAgregarReg.ejecutarMandarRegistroA_verRegistro();
                    break;
                case "pedidosAgrgarReg_CancelarReg":
                    pedidosAgregarReg.salir();
                    break;
            }
        });

    }

}
